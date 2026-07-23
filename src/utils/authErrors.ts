/**
 * Maps Firebase Auth error codes to clear, user-facing messages.
 * Never surfaces raw Firebase strings or stack traces in the UI.
 */

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact support for help.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Try again or use another browser.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
  'auth/requires-recent-login': 'For security, please sign in again and retry.',
  'auth/missing-email': 'Enter your email address.',
  'auth/invalid-action-code': 'This reset link is invalid or has expired. Request a new one.',
  'auth/expired-action-code': 'This reset link has expired. Request a new one.',
};

export function getAuthErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code || '')
      : '';

  if (code && AUTH_MESSAGES[code]) {
    return AUTH_MESSAGES[code];
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: string }).message || '');
    // Prefer mapped codes embedded in Firebase messages when present
    const match = message.match(/auth\/[\w-]+/);
    if (match && AUTH_MESSAGES[match[0]]) {
      return AUTH_MESSAGES[match[0]];
    }
    // Avoid dumping Firebase SDK wording that mentions "Firebase"
    if (message && !/firebase/i.test(message) && message.length < 160) {
      return message;
    }
  }

  return fallback;
}
