import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'directus_token';
const USER_KEY = 'directus_user';

// Fallback to localStorage on web if SecureStore is not available
const getStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) => {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.error('Error setting item in localStorage:', error);
        }
      },
      removeItem: (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error('Error removing item from localStorage:', error);
        }
      },
    };
  }
  return SecureStore;
};

export const storage = {
  async getToken(): Promise<string | null> {
    try {
      const store = getStorage();
      if (Platform.OS === 'web' && 'getItem' in store) {
        return store.getItem(TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      const store = getStorage();
      if (Platform.OS === 'web' && 'setItem' in store) {
        store.setItem(TOKEN_KEY, token);
        return;
      }
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting token:', error);
    }
  },

  async removeToken(): Promise<void> {
    try {
      const store = getStorage();
      if (Platform.OS === 'web' && 'removeItem' in store) {
        store.removeItem(TOKEN_KEY);
        return;
      }
      // Check if deleteItemAsync exists before calling it
      if (typeof SecureStore.deleteItemAsync === 'function') {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } else {
        // Fallback: try to set to empty string or use removeItem if available
        try {
          await SecureStore.setItemAsync(TOKEN_KEY, '');
        } catch {
          // If that fails, just log and continue
          console.warn('Could not remove token from SecureStore');
        }
      }
    } catch (error) {
      console.error('Error removing token:', error);
    }
  },

  async getUser(): Promise<any | null> {
    try {
      const store = getStorage();
      if (Platform.OS === 'web' && 'getItem' in store) {
        const userStr = store.getItem(USER_KEY);
        return userStr ? JSON.parse(userStr) : null;
      }
      const userStr = await SecureStore.getItemAsync(USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  async setUser(user: any): Promise<void> {
    try {
      const store = getStorage();
      if (Platform.OS === 'web' && 'setItem' in store) {
        store.setItem(USER_KEY, JSON.stringify(user));
        return;
      }
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error setting user:', error);
    }
  },

  async clear(): Promise<void> {
    try {
      const store = getStorage();
      if (Platform.OS === 'web' && 'removeItem' in store) {
        store.removeItem(TOKEN_KEY);
        store.removeItem(USER_KEY);
        return;
      }
      // Use Promise.allSettled to handle cases where deleteItemAsync might not be available
      await Promise.allSettled([
        this.removeToken(),
        (async () => {
          try {
            if (typeof SecureStore.deleteItemAsync === 'function') {
              await SecureStore.deleteItemAsync(USER_KEY);
            } else {
              // Fallback: try to set to empty string
              try {
                await SecureStore.setItemAsync(USER_KEY, '');
              } catch {
                console.warn('Could not remove user from SecureStore');
              }
            }
          } catch (error) {
            console.error('Error removing user:', error);
          }
        })(),
      ]);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },
};


