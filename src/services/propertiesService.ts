import { backendClient } from './backendClient';
import type { Property } from '../types';

/**
 * Input type for creating a property.
 * app_profile is NOT included - it's enforced server-side.
 */
export interface CreatePropertyInput {
  address_free_text: string;
  lease_start_date?: string;
  lease_end_date?: string;
  lease_term?: number;
  /** Personal tour tracker ISO datetime (Touring only). */
  tour_scheduled_at?: string | null;
  nickname?: string;
  state_code?: string;
  street?: string;
  unit?: string;
  city?: string;
  zip?: number;
  /** Optional listing / property link (http/https URL). */
  listing_url?: string;
  /** Defaults to active. Use touring for places under consideration. */
  status?: 'draft' | 'touring' | 'applied' | 'active' | 'archived';
}

/**
 * Domain service for property operations.
 * Calls Firebase Cloud Functions only (Firestore on the server).
 */
class PropertiesService {
  /**
   * Get all properties belonging to the current user.
   * Properties are filtered by app_profile on the backend.
   * @return {Promise<Property[]>}
   */
  async getMyProperties(): Promise<Property[]> {
    const response = await backendClient.call<{ data: Property[] }>(
      'getMyProperties',
      {
        method: 'GET',
      }
    );
    return response.data || [];
  }

  /**
   * Create a new property for the current user.
   * Ownership (app_profile) is enforced server-side.
   * @param {CreatePropertyInput} input Property data (without app_profile).
   * @return {Promise<Property>} The created property.
   */
  async createProperty(input: CreatePropertyInput): Promise<Property> {
    const response = await backendClient.call<{ data: Property }>(
      'createProperty',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Get a single property by ID.
   * Only returns the property if it belongs to the current user.
   * @param {string} id Property ID.
   * @return {Promise<Property>} The property.
   */
  async getProperty(id: string): Promise<Property> {
    const encodedId = encodeURIComponent(id);
    const response = await backendClient.call<{ data: Property }>(
      `getProperty?id=${encodedId}`,
      {
        method: 'GET',
      }
    );
    return response.data;
  }

  /**
   * Update a property.
   * Only updates if the property belongs to the current user.
   */
  async updateProperty(
    id: string,
    updates: Partial<Property> & {
      lease_term?: number | null;
      lease_end_date?: string | null;
      state_code?: string | null;
      listing_url?: string | null;
      application_file?: string | null;
      application_file_name?: string | null;
      applied_at?: string | null;
      tour_scheduled_at?: string | null;
      tour_completed_at?: string | null;
      tour_completed_source?: Property['tour_completed_source'];
      move_in_baseline_inspection_id?: string | null;
      next_check_in_at?: string | null;
      check_in_reminder_opt_in?: boolean | null;
    }
  ): Promise<Property> {
    const response = await backendClient.call<{ data: Property }>(
      'updateProperty',
      {
        method: 'PATCH',
        body: JSON.stringify({ id, ...updates }),
      }
    );
    return response.data;
  }

  /**
   * Delete a property.
   * Only deletes if the property belongs to the current user.
   * The Cloud Function removes related spaces, photos, and reports, and Storage objects.
   * @param {string} id Property ID.
   * @return {Promise<void>}
   */
  async deleteProperty(id: string): Promise<void> {
    await backendClient.call<{ ok: boolean; message: string }>(
      'deleteProperty',
      {
        method: 'DELETE',
        body: JSON.stringify({ propertyId: id }),
      }
    );
  }
}

export const propertiesService = new PropertiesService();

