import { backendClient } from './backendClient';
import type { UserPreferences } from '../types';

/**
 * Domain service for user preferences operations.
 * All operations go through Firebase Functions backend.
 */
class UserPreferencesService {
  /**
   * Get user preferences for the current user.
   * @return {Promise<UserPreferences | null>}
   */
  async getUserPreferences(): Promise<UserPreferences | null> {
    const response = await backendClient.call<{ data: UserPreferences | null }>(
      'getUserPreferences',
      {
        method: 'GET',
      }
    );
    return response.data || null;
  }

  /**
   * Update user preferences.
   * Creates if doesn't exist.
   * @param {Partial<UserPreferences>} updates Preferences to update.
   * @return {Promise<UserPreferences>}
   */
  async updateUserPreferences(updates: { theme_preference?: 'light' | 'dark' | 'auto'; preferred_language?: string }): Promise<UserPreferences> {
    const response = await backendClient.call<{ data: UserPreferences }>(
      'updateUserPreferences',
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
    return response.data;
  }
}

export const userPreferencesService = new UserPreferencesService();

