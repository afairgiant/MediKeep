/**
 * Secure storage utility
 * Uses localStorage for persistence but with security measures
 */

const STORAGE_PREFIX = 'medapp_';

class SecureStorage {
  /**
   * Store data in localStorage with prefix
   * @param {string} key 
   * @param {any} value 
   */
  setItem(key, value) {
    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(prefixedKey, serializedValue);
    } catch (error) {
      console.error('SecureStorage: Failed to store item', { key, error });
    }
  }

  /**
   * Retrieve data from localStorage
   * @param {string} key 
   * @returns {string|null}
   */
  getItem(key) {
    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      return localStorage.getItem(prefixedKey);
    } catch (error) {
      console.error('SecureStorage: Failed to retrieve item', { key, error });
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
      console.error('SecureStorage: Failed to remove item', { key, error });
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
      console.error('SecureStorage: Failed to clear storage', { error });
    }
  }

  /**
   * Store JSON data safely
   * @param {string} key 
   * @param {object} data 
   */
  setJSON(key, data) {
    try {
      this.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('SecureStorage: Failed to store JSON', { key, error });
    }
  }

  /**
   * Retrieve JSON data safely
   * @param {string} key 
   * @returns {object|null}
   */
  getJSON(key) {
    try {
      const value = this.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('SecureStorage: Failed to parse JSON', { key, error });
      return null;
    }
  }
}

export const secureStorage = new SecureStorage();

// Legacy localStorage fallback for backward compatibility
// TODO: Remove this after migration is complete
export const legacyMigration = {
  migrateFromLocalStorage() {
    try {
      // Migrate token
      const token = localStorage.getItem('token');
      if (token) {
        secureStorage.setItem('token', token);
        localStorage.removeItem('token');
      }

      // Migrate user data
      const user = localStorage.getItem('user');
      if (user) {
        secureStorage.setItem('user', user);
        localStorage.removeItem('user');
      }

      // Migrate token expiry
      const tokenExpiry = localStorage.getItem('tokenExpiry');
      if (tokenExpiry) {
        secureStorage.setItem('tokenExpiry', tokenExpiry);
        localStorage.removeItem('tokenExpiry');
      }
    } catch (error) {
      console.error('Failed to migrate from localStorage', error);
    }
  }
};