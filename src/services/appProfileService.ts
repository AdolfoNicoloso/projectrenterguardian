import { backendClient } from './backendClient';
import type { AppProfile } from '../types';

/**
 * Domain service for app profile operations.
 * All operations go through Firebase Functions backend.
 */
class AppProfileService {
  /**
   * Get the current user's app profile.
   * @return {Promise<AppProfile | null>}
   */
  async getAppProfile(): Promise<AppProfile | null> {
    const response = await backendClient.call<{ data: AppProfile | null }>(
      'getAppProfile',
      {
        method: 'GET',
      }
    );
    return response.data || null;
  }

  /**
   * Update app profile.
   * @param {Partial<AppProfile>} updates Profile fields to update.
   * @return {Promise<AppProfile>}
   */
  async updateAppProfile(updates: { name?: string; onboarding_completed?: boolean }): Promise<AppProfile> {
    const response = await backendClient.call<{ data: AppProfile }>(
      'updateAppProfile',
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
    return response.data;
  }
}

export const appProfileService = new AppProfileService();


