import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  User,
  ApplicationVerifier,
  ConfirmationResult,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { storage } from './storage';

// Firebase configuration - these should be set in your .env file
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Validate Firebase configuration
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
const missingFields = requiredFields.filter(
  (field) => !firebaseConfig[field] || firebaseConfig[field] === ''
);

if (missingFields.length > 0) {
  console.warn(
    `⚠️  Firebase configuration is missing required fields: ${missingFields.join(', ')}. ` +
    `Please check your .env file and ensure all EXPO_PUBLIC_FIREBASE_* variables are set.`
  );
}

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  try {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw new Error(
      'Firebase initialization failed. Please check your .env configuration.'
    );
  }
} else {
  app = getApps()[0];
}

// Initialize Auth with proper persistence
// - On web: uses getAuth (defaults to browser localStorage)
// - On native: uses initializeAuth with AsyncStorage for persistence
let auth: Auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  // On React Native, use initializeAuth with AsyncStorage for persistence
  // This prevents the warning and ensures auth state persists between app sessions
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error: any) {
    // If auth is already initialized (e.g., hot reload), use the existing instance
    if (error.code === 'auth/already-initialized') {
      auth = getAuth(app);
    } else {
      throw error;
    }
  }
}
export { auth };
export const googleProvider = new GoogleAuthProvider();

// Convert Firebase User to our user format
const firebaseUserToUser = (firebaseUser: User) => ({
  id: firebaseUser.uid,
  email: firebaseUser.email || '',
  phoneNumber: firebaseUser.phoneNumber || '',
  displayName: firebaseUser.displayName || '',
  photoURL: firebaseUser.photoURL || null,
});

export const firebaseAuth = {
  // Email/Password Auth
  async signInWithEmail(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    const user = firebaseUserToUser(userCredential.user);
    
    await storage.setToken(idToken);
    await storage.setUser(user);
    
    return { user, token: idToken };
  },

  async signUpWithEmail(email: string, password: string) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    const user = firebaseUserToUser(userCredential.user);
    
    await storage.setToken(idToken);
    await storage.setUser(user);
    
    return { user, token: idToken };
  },

  // Google Sign-In
  async signInWithGoogle(idToken: string) {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const token = await userCredential.user.getIdToken();
    const user = firebaseUserToUser(userCredential.user);
    
    await storage.setToken(token);
    await storage.setUser(user);
    return { user, token };
  },

  /**
   * Start phone sign-in. Pass a Recaptcha / FirebaseRecaptcha verifier.
   */
  async startPhoneSignIn(
    phoneE164: string,
    appVerifier: ApplicationVerifier
  ): Promise<ConfirmationResult> {
    return signInWithPhoneNumber(auth, phoneE164, appVerifier);
  },

  /**
   * Confirm SMS code from startPhoneSignIn.
   */
  async confirmPhoneCode(confirmation: ConfirmationResult, code: string) {
    const userCredential = await confirmation.confirm(code);
    const token = await userCredential.user.getIdToken();
    const user = firebaseUserToUser(userCredential.user);
    await storage.setToken(token);
    await storage.setUser(user);
    return { user, token };
  },

  /**
   * Confirm with verificationId + code (alternate path).
   */
  async confirmPhoneCredential(verificationId: string, code: string) {
    const credential = PhoneAuthProvider.credential(verificationId, code);
    const userCredential = await signInWithCredential(auth, credential);
    const token = await userCredential.user.getIdToken();
    const user = firebaseUserToUser(userCredential.user);
    await storage.setToken(token);
    await storage.setUser(user);
    return { user, token };
  },

  /**
   * Sends a password-reset email via Firebase Auth.
   * Does not reveal whether the email exists (Firebase may still return user-not-found).
   */
  async sendPasswordReset(email: string) {
    await sendPasswordResetEmail(auth, email.trim());
  },

  // Sign Out
  async signOut() {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Firebase signOut error:', error);
      // Continue even if Firebase signOut fails
    }
    // Note: storage.clear() is handled by the authStore to ensure proper state management
  },

  // Get current user
  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  // Auth state observer
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },
};

export { app as firebaseApp };

