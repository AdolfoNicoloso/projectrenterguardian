import { getFunctionsBaseUrl } from '../config/cloudFunctions';
import { auth } from './firebase';

/**
 * Get the current user's Firebase ID token.
 * @return {Promise<string>} The Firebase ID token.
 * @throws {Error} If user is not authenticated.
 */
async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User is not authenticated');
  }
  return await user.getIdToken();
}

/**
 * Backend API error types.
 */
export class BackendError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

/**
 * Make an authenticated request to a Firebase Function.
 * Automatically attaches Firebase ID token as Bearer token.
 * Centralizes error handling for 401, 403, 500, etc.
 *
 * @param {string} functionName The name of the Firebase Function.
 * @param {RequestInit} options Fetch options (method, body, etc.).
 * @return {Promise<T>} The JSON response.
 * @throws {BackendError} For HTTP errors with status code and message.
 */
async function request<T>(
  functionName: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getFunctionsBaseUrl();
  const url = `${baseUrl}/${functionName}`;

  let idToken: string;
  try {
    idToken = await getIdToken();
  } catch (error) {
    throw new BackendError(
      'Authentication required',
      401,
      error
    );
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      }
    } catch {
      // If JSON parsing fails, use status text
      errorMessage = response.statusText || errorMessage;
    }

    throw new BackendError(
      errorMessage,
      response.status
    );
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const text = await response.text();
    if (!text || text.trim() === '') {
      return {} as T;
    }
    return JSON.parse(text) as T;
  }

  return {} as T;
}

/**
 * Canonical backend API client for all Firebase Functions calls.
 * All requests are authenticated with Firebase ID tokens.
 * CMS (Firestore + Storage) is reached only through Cloud Functions, not from the app directly.
 */
class BackendClient {
  /**
   * Bootstrap or get the user's app_profile_id.
   * This creates the profile if it doesn't exist.
   * @return {Promise<{ app_profile_id: string }>}
   */
  async bootstrapProfile(): Promise<{ app_profile_id: string }> {
    return await request<{ app_profile_id: string }>('bootstrapProfile', {
      method: 'POST',
    });
  }

  /**
   * Generic request method for custom function calls.
   * Use domain services (e.g., propertiesService) instead when possible.
   * @param {string} functionName The function name.
   * @param {RequestInit} options Fetch options.
   * @return {Promise<T>} The response.
   */
  async call<T>(functionName: string, options: RequestInit = {}): Promise<T> {
    return await request<T>(functionName, options);
  }
}

export const backendClient = new BackendClient();










