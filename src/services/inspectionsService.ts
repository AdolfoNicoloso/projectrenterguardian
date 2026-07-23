import { backendClient } from './backendClient';
import type { Inspection, InspectionStep } from '../types';

/**
 * Input type for creating an inspection.
 */
export interface CreateInspectionInput {
  property_id: string;
  inspection_type: string;
}

/**
 * Domain service for inspection operations.
 * All inspection operations go through Firebase Functions backend.
 */
class InspectionsService {
  /**
   * Get all inspections for the current user.
   * @param {object} filters Optional filters.
   * @param {string} filters.status Filter by inspection_status.
   * @return {Promise<Inspection[]>}
   */
  async getMyInspections(filters?: { status?: 'in_progress' | 'completed' }): Promise<Inspection[]> {
    let query = 'getInspections';
    if (filters?.status) {
      query += `?status=${encodeURIComponent(filters.status)}`;
    }
    const response = await backendClient.call<{ data: Inspection[] }>(query, {
      method: 'GET',
    });
    return response.data || [];
  }

  /**
   * Get a single inspection by ID.
   * Only returns if it belongs to the current user.
   * @param {string} id Inspection ID.
   * @return {Promise<Inspection>}
   */
  async getInspection(id: string): Promise<Inspection> {
    const encodedId = encodeURIComponent(id);
    const response = await backendClient.call<{ data: Inspection }>(
      `getInspectionById?id=${encodedId}`,
      {
        method: 'GET',
      }
    );
    return response.data;
  }

  /**
   * Create a new inspection.
   * Creates inspection + all 7 steps server-side.
   * @param {CreateInspectionInput} input Inspection data.
   * @return {Promise<Inspection>}
   */
  async createInspection(input: CreateInspectionInput): Promise<Inspection> {
    const response = await backendClient.call<{ data: Inspection }>(
      'createInspection',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Get all steps for an inspection.
   * @param {string} inspectionId Inspection ID.
   * @return {Promise<InspectionStep[]>}
   */
  async getInspectionSteps(inspectionId: string): Promise<InspectionStep[]> {
    const encodedId = encodeURIComponent(inspectionId);
    const response = await backendClient.call<{ data: InspectionStep[] }>(
      `getInspectionSteps?inspectionId=${encodedId}`,
      {
        method: 'GET',
      }
    );
    return response.data || [];
  }

  /**
   * Get a single step by inspection ID and step_key.
   * @param {string} inspectionId Inspection ID.
   * @param {string} stepKey Step key.
   * @return {Promise<InspectionStep>}
   */
  async getInspectionStep(inspectionId: string, stepKey: string): Promise<InspectionStep> {
    const encodedInspectionId = encodeURIComponent(inspectionId);
    const encodedStepKey = encodeURIComponent(stepKey);
    const response = await backendClient.call<{ data: InspectionStep }>(
      `getInspectionStep?inspectionId=${encodedInspectionId}&stepKey=${encodedStepKey}`,
      {
        method: 'GET',
      }
    );
    return response.data;
  }

  /**
   * Update an inspection step (payload and/or status).
   * @param {string} stepId Step ID.
   * @param {object} updates Updates (payload_json, inspection_step_status).
   * @return {Promise<InspectionStep>}
   */
  async updateInspectionStep(
    stepId: string,
    updates: {
      payload_json?: any;
      inspection_step_status?: 'not_started' | 'in_progress' | 'completed';
    }
  ): Promise<InspectionStep> {
    const response = await backendClient.call<{ data: InspectionStep }>(
      'updateInspectionStep',
      {
        method: 'PATCH',
        body: JSON.stringify({ id: stepId, ...updates }),
      }
    );
    return response.data;
  }

  /**
   * Update an inspection (last_step, progress, completion).
   * @param {string} inspectionId Inspection ID.
   * @param {object} updates Updates (last_step, inspections_progress, inspection_status, completed_at).
   * @return {Promise<Inspection>}
   */
  async updateInspection(
    inspectionId: string,
    updates: {
      last_step?: string | null;
      inspections_progress?: number;
      inspection_status?: 'in_progress' | 'completed';
      completed_at?: string | null;
    }
  ): Promise<Inspection> {
    const response = await backendClient.call<{ data: Inspection }>(
      'updateInspection',
      {
        method: 'PATCH',
        body: JSON.stringify({ id: inspectionId, ...updates }),
      }
    );
    return response.data;
  }

  /**
   * Check if a property has any inspections.
   * @param {string} propertyId Property ID.
   * @return {Promise<boolean>} True if property has inspections, false otherwise.
   */
  async propertyHasInspections(propertyId: string): Promise<boolean> {
    try {
      const encodedId = encodeURIComponent(propertyId);
      const response = await backendClient.call<{ hasInspections: boolean }>(
        `propertyHasInspections?propertyId=${encodedId}`,
        {
          method: 'GET',
        }
      );
      return response.hasInspections || false;
    } catch (error) {
      console.error('Error checking if property has inspections:', error);
      // Default to false on error (safe MVP behavior)
      return false;
    }
  }

  /**
   * Delete an in-progress or completed inspection and its steps.
   */
  async deleteInspection(inspectionId: string): Promise<void> {
    await backendClient.call<{ ok: boolean; message: string }>(
      'deleteInspection',
      {
        method: 'DELETE',
        body: JSON.stringify({ id: inspectionId }),
      }
    );
  }
}

export const inspectionsService = new InspectionsService();

