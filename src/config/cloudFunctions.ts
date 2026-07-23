/**
 * Base URL for Firebase Cloud Functions (emulator or production).
 * Keep in sync with any code that builds function URLs (e.g. file proxy).
 */
export function getFunctionsBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || 'localhost';
    const port = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_PORT || '5001';
    return `http://${host}:${port}/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/us-central1`;
  }
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'project-renter-guardian';
  return `https://us-central1-${projectId}.cloudfunctions.net`;
}
