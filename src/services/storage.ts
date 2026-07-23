import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Current SecureStore / localStorage keys (Firebase session snapshot). */
const TOKEN_KEY = 'firebase_id_token';
const USER_KEY = 'firebase_user';

/** Legacy keys from the Directus-era client; cleared on write/clear. */
const LEGACY_TOKEN_KEY = 'directus_token';
const LEGACY_USER_KEY = 'directus_user';

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

async function writeRaw(key: string, value: string): Promise<void> {
  try {
    const store = getStorage();
    if (Platform.OS === 'web' && 'setItem' in store) {
      store.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error(`Error writing ${key}:`, error);
  }
}

async function deleteRaw(key: string): Promise<void> {
  try {
    const store = getStorage();
    if (Platform.OS === 'web' && 'removeItem' in store) {
      store.removeItem(key);
      return;
    }
    if (typeof SecureStore.deleteItemAsync === 'function') {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, '');
    }
  } catch (error) {
    console.error(`Error deleting ${key}:`, error);
  }
}

/**
 * Secure session cache for Firebase ID token + user snapshot.
 * Firebase Auth remains the source of truth for the signed-in user.
 */
export const storage = {
  async setToken(token: string): Promise<void> {
    await writeRaw(TOKEN_KEY, token);
    await deleteRaw(LEGACY_TOKEN_KEY);
  },

  async setUser(user: unknown): Promise<void> {
    await writeRaw(USER_KEY, JSON.stringify(user));
    await deleteRaw(LEGACY_USER_KEY);
  },

  async clear(): Promise<void> {
    await Promise.allSettled([
      deleteRaw(TOKEN_KEY),
      deleteRaw(USER_KEY),
      deleteRaw(LEGACY_TOKEN_KEY),
      deleteRaw(LEGACY_USER_KEY),
    ]);
  },
};
