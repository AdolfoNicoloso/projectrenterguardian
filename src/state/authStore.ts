import { create } from 'zustand';
import { storage, backendClient, BackendError } from '../services';
import { firebaseAuth } from '../services/firebase';
import { usePropertiesStore } from './propertiesStore';

function logBootstrapProfileFailure(err: unknown, context: string) {
  if (err instanceof BackendError) {
    console.error(
      `[auth] bootstrapProfile failed (${context}): ${err.statusCode} — ${err.message}`
    );
  } else {
    console.error(`[auth] bootstrapProfile failed (${context}):`, err);
  }
}

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  isLoading: boolean;
  logoutMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** After firebaseAuth.confirmPhoneCode succeeded and user is in storage. */
  completePhoneSignIn: () => Promise<void>;
  logout: (delayStateUpdate?: boolean) => Promise<void>;
  checkAuth: () => Promise<void>;
  setAuthState: (isAuthenticated: boolean, user: any | null) => void;
  setLogoutMessage: (message: string | null) => void;
  clearLogoutMessage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  logoutMessage: null,

  checkAuth: async () => {
    try {
      // Wait for Firebase Auth to restore the session from persistence
      // This is critical on app reload - Firebase Auth restoration is async
      const currentUser = await new Promise<any>((resolve) => {
        // Check if user is already available (fast path)
        const existingUser = firebaseAuth.getCurrentUser();
        if (existingUser) {
          resolve(existingUser);
          return;
        }

        // Wait for auth state to be restored via onAuthStateChanged
        // This will fire once Firebase has restored the session from AsyncStorage
        const unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
          unsubscribe(); // Clean up after first event
          resolve(user);
        });
      });

      if (currentUser) {
        const token = await currentUser.getIdToken();
        const user = {
          id: currentUser.uid,
          email: currentUser.email || '',
          phoneNumber: currentUser.phoneNumber || '',
          displayName: currentUser.displayName || '',
          photoURL: currentUser.photoURL || null,
        };
        await storage.setToken(token);
        await storage.setUser(user);
        set({ isAuthenticated: true, user, isLoading: false });
        // Ensure Firestore app_profile exists (Cloud Function bootstrapProfile)
        try {
          await backendClient.bootstrapProfile();
        } catch (profileError) {
          logBootstrapProfileFailure(profileError, 'checkAuth');
        }
      } else {
        // No Firebase user found - clear any stale storage data
        await storage.clear();
        set({ isAuthenticated: false, user: null, isLoading: false });
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      set({ isAuthenticated: false, user: null, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    try {
      const { user } = await firebaseAuth.signInWithEmail(email, password);
      set({ isAuthenticated: true, user });
      // Ensure Firestore app_profile exists (Cloud Function bootstrapProfile)
      try {
        await backendClient.bootstrapProfile();
      } catch (profileError) {
        logBootstrapProfileFailure(profileError, 'login');
      }
    } catch (error) {
      // Preserve Firebase error.code for UI mapping
      throw error;
    }
  },

  register: async (email: string, password: string) => {
    try {
      const { user } = await firebaseAuth.signUpWithEmail(email, password);
      set({ isAuthenticated: true, user });
      // Ensure Firestore app_profile exists (Cloud Function bootstrapProfile)
      try {
        await backendClient.bootstrapProfile();
      } catch (profileError) {
        // Log but don't fail registration if profile bootstrap fails
        console.warn('Failed to bootstrap profile:', profileError);
      }
    } catch (error) {
      throw error;
    }
  },

  signInWithGoogle: async () => {
    try {
      const { signInWithGoogle } = await import('../services/googleAuth');
      const { user } = await signInWithGoogle();
      set({ isAuthenticated: true, user });
      // Ensure Firestore app_profile exists (Cloud Function bootstrapProfile)
      try {
        await backendClient.bootstrapProfile();
      } catch (profileError) {
        logBootstrapProfileFailure(profileError, 'google');
      }
    } catch (error) {
      throw error;
    }
  },

  completePhoneSignIn: async () => {
    const currentUser = firebaseAuth.getCurrentUser();
    if (!currentUser) {
      throw new Error('Phone sign-in did not complete.');
    }
    const token = await currentUser.getIdToken();
    const user = {
      id: currentUser.uid,
      email: currentUser.email || '',
      phoneNumber: currentUser.phoneNumber || '',
      displayName: currentUser.displayName || '',
      photoURL: currentUser.photoURL || null,
    };
    await storage.setToken(token);
    await storage.setUser(user);
    set({ isAuthenticated: true, user });
    try {
      await backendClient.bootstrapProfile();
    } catch (profileError) {
      logBootstrapProfileFailure(profileError, 'phone');
    }
  },

  logout: async (delayStateUpdate: boolean = false) => {
    try {
      // Clear Firebase auth first
      await firebaseAuth.signOut();
    } catch (error) {
      console.error('Firebase logout error:', error);
    } finally {
      // Always clear local storage
      try {
        await storage.clear();
      } catch (error) {
        console.error('Error clearing storage:', error);
      }

      try {
        usePropertiesStore.getState().clear();
      } catch (error) {
        console.error('Error clearing properties cache:', error);
      }
      
      // Update state - delay if requested (for showing logout message)
      if (delayStateUpdate) {
        // State will be updated by the calling component after showing toast
        return;
      }
      // Update state to trigger redirect in tabs layout
      set({ isAuthenticated: false, user: null });
    }
  },

  setAuthState: (isAuthenticated: boolean, user: any | null) => {
    set({ isAuthenticated, user });
  },

  setLogoutMessage: (message: string | null) => {
    set({ logoutMessage: message });
  },

  clearLogoutMessage: () => {
    set({ logoutMessage: null });
  },
}));

