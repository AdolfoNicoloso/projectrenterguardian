import { signInWithPopup, signInWithRedirect, getRedirectResult, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { Platform } from 'react-native';
import { storage } from './storage';

/**
 * Convert Firebase User to our user format
 */
const firebaseUserToUser = (firebaseUser: User) => ({
  id: firebaseUser.uid,
  email: firebaseUser.email || '',
  displayName: firebaseUser.displayName || '',
  photoURL: firebaseUser.photoURL || null,
});

/**
 * Sign in with Google
 * For web: Uses Firebase popup (better UX) with redirect fallback
 * Note: COOP (Cross-Origin-Opener-Policy) warnings in console are harmless
 *       - They occur because Firebase can't check if popup is closed
 *       - The sign-in still works correctly despite the warning
 * For mobile: Should use expo-auth-session (to be implemented)
 */
export const signInWithGoogle = async (): Promise<{ user: any; token: string }> => {
  if (Platform.OS === 'web') {
    try {
      // Try popup first (better UX)
      // Note: You may see COOP warnings in console - these are harmless
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const user = firebaseUserToUser(result.user);
      
      // Store token and user
      await storage.setToken(idToken);
      await storage.setUser(user);
      
      return { user, token: idToken };
    } catch (error: any) {
      // If popup is blocked or fails, fall back to redirect
      if (error.code === 'auth/popup-blocked' || 
          error.code === 'auth/popup-closed-by-user' ||
          error.code === 'auth/cancelled-popup-request') {
        // Use redirect as fallback
        await signInWithRedirect(auth, googleProvider);
        // The redirect result will be handled by checkGoogleRedirect on app reload
        throw new Error('Redirecting to Google sign-in...');
      }
      throw error;
    }
  } else {
    // For mobile, we'll need to implement expo-auth-session
    // For now, throw an error indicating it needs to be implemented
    throw new Error('Google sign-in on mobile requires additional setup with expo-auth-session');
  }
};

/**
 * Check for redirect result (call this on app load for web)
 */
export const checkGoogleRedirect = async (): Promise<{ user: any; token: string } | null> => {
  if (Platform.OS === 'web') {
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        const idToken = await result.user.getIdToken();
        const user = firebaseUserToUser(result.user);
        
        await storage.setToken(idToken);
        await storage.setUser(user);
        
        return { user, token: idToken };
      }
    } catch (error) {
      console.error('Error checking Google redirect:', error);
    }
  }
  return null;
};

