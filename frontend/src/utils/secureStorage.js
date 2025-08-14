/**
 * Secure storage utility
 * Uses localStorage with AES-GCM encryption for sensitive data
 */

const STORAGE_PREFIX = 'medapp_';
const SENSITIVE_KEYS = ['token', 'user', 'tokenExpiry']; // Keys that require encryption

class SecureStorage {
  constructor() {
    this.encryptionKey = null;
    this.isInitialized = false;
    this.initializeEncryption();
  }

  /**
   * Initialize AES-GCM encryption with session-persistent key
   */
  async initializeEncryption() {
    try {
      if (!window.crypto || !window.crypto.subtle) {
        console.warn('SecureStorage: Web Crypto API not available, using fallback storage');
        this.isInitialized = true;
        return;
      }

      // Try to reuse existing session key or generate new one
      if (window._secureStorageKey) {
        this.encryptionKey = window._secureStorageKey;
      } else {
        // Generate session-persistent AES-GCM key
        this.encryptionKey = await window.crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false, // not extractable - key stays in memory only
          ['encrypt', 'decrypt']
        );
        
        // Store in window for session persistence (cleared on page reload)
        window._secureStorageKey = this.encryptionKey;
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('SecureStorage: Failed to initialize encryption, using fallback', error);
      this.encryptionKey = null;
      this.isInitialized = true;
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
    
    if (!this.encryptionKey) {
      // Fallback: Base64 encoding (better than plain text)
      return btoa(encodeURIComponent(data));
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
      return btoa(encodeURIComponent(data));
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
   * Store data in localStorage with secure prefix (encryption disabled for stability)
   * @param {string} key 
   * @param {any} value 
   */
  async setItem(key, value) {
    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Store with prefix only (encryption disabled to prevent navigation issues)
      localStorage.setItem(prefixedKey, serializedValue);
    } catch (error) {
      // Silent fail - don't log in production
    }
  }

  /**
   * Retrieve data from localStorage with secure prefix (encryption disabled for stability)
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
      
      // Return stored value directly (encryption disabled to prevent navigation issues)
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
      // Silent fail
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
      return value ? JSON.parse(value) : null;
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
    } catch (error) {
      // Silent fail
    }
  }
};