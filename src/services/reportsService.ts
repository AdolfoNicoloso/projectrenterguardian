import { backendClient } from './backendClient';
import type { Report } from '../types';

/**
 * Input type for creating a report.
 */
export interface CreateReportInput {
  property: string;
  report_type: string;
  status: 'draft' | 'generating' | 'ready' | 'failed';
  snapshot_json: any;
  context_state_code?: string;
  disclaimer_version?: string;
}

/**
 * Domain service for report operations.
 * All report operations go through Firebase Functions backend.
 */
class ReportsService {
  /**
   * Get all reports for a property.
   * @param {string} propertyId Property ID.
   * @return {Promise<Report[]>}
   */
  async getReports(propertyId: string): Promise<Report[]> {
    const encodedId = encodeURIComponent(propertyId);
    const response = await backendClient.call<{ data: Report[] }>(
      `getReports?propertyId=${encodedId}`,
      {
        method: 'GET',
      }
    );
    return response.data || [];
  }

  /**
   * Get a single report by ID.
   * Only returns if property belongs to the current user.
   * @param {string} id Report ID.
   * @return {Promise<Report>}
   */
  async getReport(id: string): Promise<Report> {
    const encodedId = encodeURIComponent(id);
    const response = await backendClient.call<{ data: Report }>(
      `getReportById?id=${encodedId}`,
      {
        method: 'GET',
      }
    );
    return response.data;
  }

  /**
   * Create a new report.
   * @param {CreateReportInput} input Report data.
   * @return {Promise<Report>}
   */
  async createReport(input: CreateReportInput): Promise<Report> {
    const response = await backendClient.call<{ data: Report }>(
      'createReport',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Update a report (e.g. attach generated PDF media id).
   */
  async updateReport(
    id: string,
    updates: { pdf_file?: string | null }
  ): Promise<Report> {
    const response = await backendClient.call<{ data: Report }>(
      'updateReport',
      {
        method: 'PATCH',
        body: JSON.stringify({ id, ...updates }),
      }
    );
    return response.data;
  }

  /**
   * Generate (or regenerate) a server PDF for a report snapshot.
   */
  async generateReportPdf(reportId: string): Promise<Report> {
    const response = await backendClient.call<{ data: Report }>(
      'generateReportPdf',
      {
        method: 'POST',
        body: JSON.stringify({ reportId }),
      }
    );
    return response.data;
  }
}

export const reportsService = new ReportsService();

