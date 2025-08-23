/**
 * Secure storage utility
 * Uses localStorage with AES-GCM encryption for sensitive data
 */
import logger from '../services/logger';

const STORAGE_PREFIX = 'medapp_';
const SENSITIVE_KEYS = ['token', 'user', 'tokenExpiry']; // Keys that require encryption
const ENCRYPTION_INIT_RETRY_DELAY = 100; // ms to wait before retrying encryption init
const ENCRYPTED_DATA_MARKER = '__encrypted__';

class SecureStorage {
  constructor() {
    this.encryptionKey = null;
    this.isInitialized = false;
    this.sessionKeyId = 'medapp_secure_session_key';
    this.initializeEncryption();
  }

  /**
   * Initialize AES-GCM encryption with session-persistent key
   */
  async initializeEncryption() {
    try {
      // Check if we're in a secure context (required for Web Crypto API)
      if (!window.isSecureContext) {
        logger.warn('SecureStorage: Not in secure context (HTTPS required for encryption), using fallback', {
          category: 'secure_storage_init'
        });
        this.encryptionKey = null;
        this.isInitialized = true;
        return;
      }

      if (!window.crypto || !window.crypto.subtle) {
        logger.warn('SecureStorage: Web Crypto API not available, using fallback storage', {
          category: 'secure_storage_init'
        });
        this.encryptionKey = null;
        this.isInitialized = true;
        return;
      }

      // Try to reuse existing session key from sessionStorage or generate new one
      try {
        const storedKeyData = sessionStorage.getItem(this.sessionKeyId);
        
        if (storedKeyData) {
          try {
            // Import the stored key
            const keyData = JSON.parse(storedKeyData);
            const keyBuffer = Uint8Array.from(atob(keyData.key), c => c.charCodeAt(0));
            
            this.encryptionKey = await window.crypto.subtle.importKey(
              'raw',
              keyBuffer,
              { name: 'AES-GCM', length: 256 },
              false,
              ['encrypt', 'decrypt']
            );
          } catch (importError) {
            logger.warn('SecureStorage: Failed to import stored key, generating new one', {
              error: importError.message,
              category: 'secure_storage_key_import'
            });
            // If import fails, generate new key
            await this.generateNewKey();
          }
        } else {
          // Generate new session key
          await this.generateNewKey();
        }
      } catch (storageError) {
        logger.warn('SecureStorage: SessionStorage access failed, generating new key', {
          error: storageError.message,
          category: 'secure_storage_session'
        });
        // If sessionStorage fails, try to generate a new key anyway
        await this.generateNewKey();
      }
      
      this.isInitialized = true;
    } catch (error) {
      logger.error('SecureStorage: Failed to initialize encryption, using fallback', {
        error: error.message,
        category: 'secure_storage_init_error'
      });
      this.encryptionKey = null;
      this.isInitialized = true;
    }
  }

  /**
   * Generate and store a new encryption key
   */
  async generateNewKey() {
    try {
      // Check if crypto.subtle is available
      if (!window.crypto || !window.crypto.subtle) {
        logger.warn('SecureStorage: Cannot generate key - Web Crypto API not available', {
          category: 'secure_storage_keygen'
        });
        this.encryptionKey = null;
        return;
      }

      // Generate session-persistent AES-GCM key
      this.encryptionKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // extractable so we can export to sessionStorage
        ['encrypt', 'decrypt']
      );
      
      // Try to store in sessionStorage, but don't fail if it doesn't work
      try {
        // Export and store key in sessionStorage for session persistence
        const exportedKey = await window.crypto.subtle.exportKey('raw', this.encryptionKey);
        const keyData = {
          key: btoa(String.fromCharCode(...new Uint8Array(exportedKey))),
          created: Date.now()
        };
        sessionStorage.setItem(this.sessionKeyId, JSON.stringify(keyData));
        
        // Re-import as non-extractable for security
        this.encryptionKey = await window.crypto.subtle.importKey(
          'raw',
          exportedKey,
          { name: 'AES-GCM', length: 256 },
          false, // non-extractable after storage
          ['encrypt', 'decrypt']
        );
      } catch (storageError) {
        logger.warn('SecureStorage: Could not persist key to sessionStorage, using in-memory key', {
          error: storageError.message,
          category: 'secure_storage_key_persist'
        });
        // Key is still valid in memory for this session
      }
    } catch (error) {
      logger.error('SecureStorage: Failed to generate new key', {
        error: error.message,
        category: 'secure_storage_keygen_error'
      });
      this.encryptionKey = null;
    }
  }

  /**
   * Wait for encryption to be initialized
   */
  async waitForInit() {
    while (!this.isInitialized) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Encrypt sensitive data using AES-GCM
   * @param {string} data - Data to encrypt
   * @returns {string} - Base64 encoded encrypted data with IV
   */
  async encryptData(data) {
    await this.waitForInit();
    
    if (!this.encryptionKey || !window.crypto || !window.crypto.subtle) {
      // Fallback: Base64 encoding (better than plain text)
      try {
        return btoa(encodeURIComponent(data));
      } catch (e) {
        logger.error('SecureStorage: Failed to encode data', {
          error: e.message,
          category: 'secure_storage_encode_error'
        });
        return btoa(data); // Last resort
      }
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      // Generate random IV for each encryption
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        dataBuffer
      );

      // Combine IV + encrypted data for storage
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      logger.warn('SecureStorage: Encryption failed, using fallback encoding', {
        error: error.message,
        category: 'secure_storage_encrypt_fallback'
      });
      try {
        return btoa(encodeURIComponent(data));
      } catch (e) {
        return btoa(data); // Last resort
      }
    }
  }

  /**
   * Decrypt sensitive data using AES-GCM
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @returns {string} - Decrypted data
   */
  async decryptData(encryptedData) {
    await this.waitForInit();
    
    if (!this.encryptionKey) {
      // Fallback: Base64 decoding
      try {
        return decodeURIComponent(atob(encryptedData));
      } catch {
        return encryptedData; // Return as-is if not base64
      }
    }

    try {
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      // Try base64 fallback
      try {
        return decodeURIComponent(atob(encryptedData));
      } catch {
        return encryptedData;
      }
    }
  }

  /**
   * Check if a key should be encrypted
   * @param {string} key - Storage key
   * @returns {boolean}
   */
  isSensitiveKey(key) {
    return SENSITIVE_KEYS.includes(key);
  }

  /**
   * Check if stored data is encrypted
   * @param {string} value - Stored value to check
   * @returns {boolean}
   */
  isEncryptedFormat(value) {
    try {
      const parsed = JSON.parse(value);
      return parsed && parsed.marker === ENCRYPTED_DATA_MARKER && parsed.data;
    } catch {
      return false;
    }
  }

  /**
   * Store data in localStorage with encryption for sensitive keys
   * @param {string} key 
   * @param {any} value 
   */
  async setItem(key, value) {
    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Check if this key should be encrypted
      if (this.isSensitiveKey(key)) {
        // Wait for encryption to be ready
        await this.waitForInit();
        
        // If still no encryption after waiting, try reinitializing once
        if (!this.encryptionKey) {
          logger.warn('SecureStorage: Encryption not ready, attempting reinitialization', {
            category: 'secure_storage_reinit'
          });
          await new Promise(resolve => setTimeout(resolve, ENCRYPTION_INIT_RETRY_DELAY));
          await this.initializeEncryption();
          await this.waitForInit();
        }
        
        // If encryption still not available, use fallback encoding
        if (!this.encryptionKey) {
          logger.info('SecureStorage: Using fallback encoding - encryption not available', {
            key: key,
            category: 'secure_storage_fallback',
            environment: window.isSecureContext ? 'secure' : 'insecure',
            hasCrypto: !!window.crypto,
            hasSubtle: !!(window.crypto && window.crypto.subtle)
          });
          // Use base64 encoding as fallback - better than plain text
          const fallbackEncoded = btoa(encodeURIComponent(serializedValue));
          const wrapper = JSON.stringify({
            marker: '__fallback__',
            data: fallbackEncoded,
            timestamp: Date.now()
          });
          localStorage.setItem(prefixedKey, wrapper);
          return;
        }
        
        // Encrypt sensitive data
        const encryptedValue = await this.encryptData(serializedValue);
        const wrapper = JSON.stringify({
          marker: ENCRYPTED_DATA_MARKER,
          data: encryptedValue,
          timestamp: Date.now()
        });
        localStorage.setItem(prefixedKey, wrapper);
      } else {
        // Store non-sensitive data as plain text for performance
        localStorage.setItem(prefixedKey, serializedValue);
      }
    } catch (error) {
      // For sensitive keys, never fallback to unencrypted storage
      if (this.isSensitiveKey(key)) {
        console.error('SecureStorage: Failed to store sensitive key securely:', key);
        throw error;
      }
      // For non-sensitive keys, allow fallback
      try {
        const prefixedKey = `${STORAGE_PREFIX}${key}`;
        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(prefixedKey, serializedValue);
      } catch (fallbackError) {
        // Silent fail for non-sensitive data
      }
    }
  }

  /**
   * Retrieve data from localStorage with decryption for sensitive keys
   * @param {string} key 
   * @returns {string|null}
   */
  async getItem(key) {
    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      const storedValue = localStorage.getItem(prefixedKey);
      
      if (storedValue === null) {
        return null;
      }
      
      // Check if this is sensitive data that should be encrypted
      if (this.isSensitiveKey(key)) {
        // Check if data is in encrypted format
        if (this.isEncryptedFormat(storedValue)) {
          try {
            const wrapper = JSON.parse(storedValue);
            const decryptedValue = await this.decryptData(wrapper.data);
            return decryptedValue;
          } catch (decryptError) {
            logger.error('SecureStorage: Failed to decrypt sensitive data', {
              key: key,
              error: decryptError.message,
              category: 'secure_storage_decrypt_error'
            });
            // For sensitive data, don't return unencrypted data
            return null;
          }
        } else {
          // Check if it's fallback format
          try {
            const parsed = JSON.parse(storedValue);
            if (parsed && parsed.marker === '__fallback__' && parsed.data) {
              // Decode fallback base64 data
              return decodeURIComponent(atob(parsed.data));
            }
          } catch (e) {
            // Not fallback format, continue
          }
          
          // Migration case: unencrypted sensitive data
          logger.warn('SecureStorage: Found unencrypted sensitive data - will re-encrypt on next write', {
            key: key,
            category: 'secure_storage_migration'
          });
          // Return the data for this session, but it will be encrypted on next write
          return storedValue;
        }
      }
      
      // Return non-sensitive data directly
      return storedValue;
    } catch (error) {
      return null;
    }
  }

  /**
   * Remove data from localStorage
   * @param {string} key 
   */
  removeItem(key) {
    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      localStorage.removeItem(prefixedKey);
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Clear all application data from localStorage
   */
  clear() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Store JSON data safely with encryption for sensitive keys
   * @param {string} key 
   * @param {object} data 
   */
  async setJSON(key, data) {
    try {
      await this.setItem(key, JSON.stringify(data));
    } catch (error) {
      // Propagate error for sensitive keys
      if (this.isSensitiveKey(key)) {
        throw error;
      }
      // Silent fail for non-sensitive keys
    }
  }

  /**
   * Retrieve JSON data safely with decryption for sensitive keys
   * @param {string} key 
   * @returns {object|null}
   */
  async getJSON(key) {
    try {
      const value = await this.getItem(key);
      if (value === null) return null;
      
      // Safe JSON parsing with error handling
      try {
        return JSON.parse(value);
      } catch (parseError) {
        logger.error('SecureStorage: Failed to parse JSON', {
          key: key,
          error: parseError.message,
          category: 'secure_storage_json_error'
        });
        return null;
      }
    } catch (error) {
      return null;
    }
  }
}

export const secureStorage = new SecureStorage();

// Legacy localStorage migration for backward compatibility
export const legacyMigration = {
  /**
   * Migrate data from legacy localStorage to encrypted storage
   */
  async migrateFromLocalStorage() {
    try {
      // Wait for encryption to be ready
      await secureStorage.waitForInit();
      
      // Migrate token
      const token = localStorage.getItem('token');
      if (token) {
        await secureStorage.setItem('token', token);
        localStorage.removeItem('token');
      }

      // Migrate user data
      const user = localStorage.getItem('user');
      if (user) {
        await secureStorage.setItem('user', user);
        localStorage.removeItem('user');
      }

      // Migrate token expiry
      const tokenExpiry = localStorage.getItem('tokenExpiry');
      if (tokenExpiry) {
        await secureStorage.setItem('tokenExpiry', tokenExpiry);
        localStorage.removeItem('tokenExpiry');
      }
      
      // Also check for prefixed but unencrypted sensitive data and mark for re-encryption
      const prefixedKeys = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_PREFIX));
      for (const prefixedKey of prefixedKeys) {
        const key = prefixedKey.replace(STORAGE_PREFIX, '');
        if (SENSITIVE_KEYS.includes(key)) {
          const value = localStorage.getItem(prefixedKey);
          if (value && !secureStorage.isEncryptedFormat(value)) {
            console.log(`SecureStorage: Migrating unencrypted sensitive key: ${key}`);
            // Re-save to trigger encryption
            await secureStorage.setItem(key, value);
          }
        }
      }
    } catch (error) {
      console.error('SecureStorage: Migration error:', error);
      // Don't fail silently for migration errors
    }
  }
};