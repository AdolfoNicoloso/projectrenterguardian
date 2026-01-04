import { BackendError } from '../services/backendClient';

/**
 * Normalizes errors to user-safe messages.
 * Handles BackendError, generic Error, and unknown error types.
 * 
 * @param error - The error to handle
 * @returns A user-safe error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof BackendError) {
    // BackendError already has a user-safe message
    return error.message;
  }
  
  if (error instanceof Error) {
    // Generic Error - use message if available
    return error.message || 'An unexpected error occurred';
  }
  
  // Unknown error type - convert to string
  return String(error) || 'An unexpected error occurred';
}

/**
 * Handles errors by logging and returning a user-safe message.
 * Use this in try/catch blocks to normalize error handling.
 * 
 * @param error - The error to handle
 * @param context - Optional context for logging (e.g., 'loading properties')
 * @returns A user-safe error message string
 * 
 * @example
 * try {
 *   await propertiesService.getMyProperties();
 * } catch (error) {
 *   const message = handleError(error, 'loading properties');
 *   showToast(message, 'error');
 * }
 */
export function handleError(error: unknown, context?: string): string {
  const message = getErrorMessage(error);
  
  // Log error with context for debugging
  if (context) {
    console.error(`[Error in ${context}]:`, error);
  } else {
    console.error('[Error]:', error);
  }
  
  return message;
}

