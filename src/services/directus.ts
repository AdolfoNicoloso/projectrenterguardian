import { storage } from './storage';
import type {
  Property,
  Space,
  Photo,
  PhotoSpaceAssignment,
  Report,
  DisclaimerBlock,
  JurisdictionContext,
  DirectusFile,
} from '../types';

const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL || '';
const USE_MOCK = !DIRECTUS_URL;

// Mock data for development
const mockProperties: Property[] = [
  {
    id: '1',
    app_profile_id: 'profile-1',
    address_free_text: '123 Main St, San Francisco, CA 94102',
    lease_start_date: '2024-01-01',
    lease_end_date: '2024-12-31',
    nickname: 'Downtown Apartment',
    state_code: 'CA',
    status: 'active',
  },
];

const mockSpaces: Space[] = [
  { id: '1', property: '1', space_type: 'living_room', display_name: 'Living Room', is_default: true },
  { id: '2', property: '1', space_type: 'kitchen', display_name: 'Kitchen', is_default: true },
  { id: '3', property: '1', space_type: 'bedroom', display_name: 'Bedroom A', is_default: true },
];

const mockPhotos: Photo[] = [];
const mockAssignments: PhotoSpaceAssignment[] = [];
const mockReports: Report[] = [];

class DirectusClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = DIRECTUS_URL.endsWith('/') ? DIRECTUS_URL.slice(0, -1) : DIRECTUS_URL;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await storage.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (USE_MOCK) {
      return this.mockRequest<T>(endpoint, options);
    }

    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      // Handle empty responses (204 No Content or empty body)
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      // If status is 204 No Content, return empty object
      if (response.status === 204) {
        return {} as T;
      }

      // If content-length is 0 or no content-type, return empty object
      if (contentLength === '0' || !contentType) {
        return {} as T;
      }

      // Only parse JSON if content-type indicates JSON
      if (contentType.includes('application/json')) {
        const text = await response.text();
        // If response body is empty, return empty object
        if (!text || text.trim() === '') {
          return {} as T;
        }
        return JSON.parse(text) as T;
      }

      // For non-JSON responses, return empty object
      return {} as T;
    } catch (error) {
      console.error('Directus request error:', error);
      throw error;
    }
  }

  private async mockRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body as string) : null;

    // Mock endpoints
    if (endpoint.includes('/items/properties')) {
      if (method === 'GET') {
        return { data: mockProperties } as T;
      }
      if (method === 'POST') {
        const newProp: Property = {
          id: String(mockProperties.length + 1),
          ...body,
          date_created: new Date().toISOString(),
        };
        mockProperties.push(newProp);
        return { data: newProp } as T;
      }
    }

    if (endpoint.includes('/items/spaces')) {
      if (method === 'GET') {
        const propertyId = new URLSearchParams(endpoint.split('?')[1] || '').get('filter[property][_eq]');
        const filtered = propertyId ? mockSpaces.filter(s => s.property === propertyId) : mockSpaces;
        return { data: filtered } as T;
      }
      if (method === 'PATCH') {
        const id = endpoint.split('/').pop();
        const index = mockSpaces.findIndex(s => s.id === id);
        if (index >= 0) {
          mockSpaces[index] = { ...mockSpaces[index], ...body };
          return { data: mockSpaces[index] } as T;
        }
      }
    }

    if (endpoint.includes('/items/photos')) {
      if (method === 'GET') {
        const propertyId = new URLSearchParams(endpoint.split('?')[1] || '').get('filter[property][_eq]');
        const filtered = propertyId ? mockPhotos.filter(p => p.property === propertyId) : mockPhotos;
        return { data: filtered } as T;
      }
      if (method === 'POST') {
        const newPhoto: Photo = {
          id: String(mockPhotos.length + 1),
          ...body,
          assignment_status: 'unassigned',
          date_created: new Date().toISOString(),
        };
        mockPhotos.push(newPhoto);
        return { data: newPhoto } as T;
      }
    }

    if (endpoint.includes('/items/photo_space_assignments')) {
      if (method === 'GET') {
        return { data: mockAssignments } as T;
      }
      if (method === 'POST') {
        const newAssignment: PhotoSpaceAssignment = {
          id: String(mockAssignments.length + 1),
          ...body,
          status: 'confirmed',
          date_created: new Date().toISOString(),
        };
        mockAssignments.push(newAssignment);
        // Update photo status
        const photo = mockPhotos.find(p => p.id === body.photo);
        if (photo) {
          photo.assignment_status = 'confirmed';
        }
        return { data: newAssignment } as T;
      }
    }

    if (endpoint.includes('/items/reports')) {
      if (method === 'GET') {
        const propertyId = new URLSearchParams(endpoint.split('?')[1] || '').get('filter[property][_eq]');
        const filtered = propertyId ? mockReports.filter(r => r.property === propertyId) : mockReports;
        return { data: filtered } as T;
      }
      if (method === 'POST') {
        const newReport: Report = {
          id: String(mockReports.length + 1),
          ...body,
          status: 'draft',
          date_created: new Date().toISOString(),
        };
        mockReports.push(newReport);
        return { data: newReport } as T;
      }
      if (method === 'PATCH') {
        const id = endpoint.split('/').pop();
        const index = mockReports.findIndex(r => r.id === id);
        if (index >= 0) {
          mockReports[index] = { ...mockReports[index], ...body };
          return { data: mockReports[index] } as T;
        }
      }
    }

    if (endpoint.includes('/items/disclaimer_blocks')) {
      return {
        data: [
          {
            id: '1',
            title: 'Important Disclaimer',
            content: 'This report is for documentation purposes only. It does not constitute legal advice.',
            order: 1,
            is_active: true,
          },
        ],
      } as T;
    }

    if (endpoint.includes('/items/jurisdiction_context')) {
      return {
        data: [
          {
            id: '1',
            state_code: 'CA',
            educational_content: 'California renter rights information...',
          },
        ],
      } as T;
    }

    if (endpoint.includes('/files')) {
      if (method === 'POST') {
        return {
          data: {
            id: `file-${Date.now()}`,
            filename_download: body?.filename || 'photo.jpg',
          },
        } as T;
      }
    }

    return { data: null } as T;
  }

  // Auth methods
  async login(email: string, password: string) {
    if (USE_MOCK) {
      const mockUser = { id: '1', email };
      const mockToken = 'mock-token';
      await storage.setToken(mockToken);
      await storage.setUser(mockUser);
      return { access_token: mockToken, user: mockUser };
    }

    const response = await this.request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.access_token) {
      await storage.setToken(response.access_token);
      await storage.setUser(response.user);
    }

    return response;
  }

  async register(email: string, password: string) {
    if (USE_MOCK) {
      const mockUser = { id: '1', email };
      const mockToken = 'mock-token';
      await storage.setToken(mockToken);
      await storage.setUser(mockUser);
      return { access_token: mockToken, user: mockUser };
    }

    // Create user - response may be empty, which is fine
    await this.request('/users', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).catch((error) => {
      // If user already exists or other error, still try to login
      console.warn('User creation response:', error);
    });

    // Then login to get access token
    return this.login(email, password);
  }

  async logout() {
    await storage.clear();
  }

  // ============================================================================
  // PUBLIC CMS CONTENT ONLY
  // ============================================================================
  // This Directus client is ONLY used for PUBLIC CMS content.
  // All user-owned data (properties, spaces, photos, reports, assignments)
  // MUST go through Firebase Functions backend via domain services to enforce
  // ownership via app_profile.
  //
  // Use domain services for user-owned data:
  //   - propertiesService
  //   - spacesService
  //   - photosService
  //   - assignmentsService
  //   - reportsService
  //   - inspectionsService
  // ============================================================================

  // Disclaimers & Context
  async getDisclaimerBlocks(): Promise<DisclaimerBlock[]> {
    const response = await this.request<{ data: DisclaimerBlock[] }>(
      '/items/disclaimer_blocks?filter[is_active][_eq]=true&sort=order'
    );
    return response.data || [];
  }

  async getJurisdictionContext(stateCode: string): Promise<JurisdictionContext | null> {
    const response = await this.request<{ data: JurisdictionContext[] }>(
      `/items/jurisdiction_context?filter[state_code][_eq]=${stateCode}`
    );
    return response.data?.[0] || null;
  }
}

export const directus = new DirectusClient();

