/**
 * @deprecated - dev/mock only, not used in production
 * 
 * This store is only used when EXPO_PUBLIC_DIRECTUS_URL is not set (mock mode).
 * In production, all data comes from Firebase Functions → Directus.
 * 
 * Do not use this store for production code. Use domain services instead:
 * - propertiesService
 * - spacesService
 * - photosService
 */
import { create } from 'zustand';
import type { Property, Space, Photo } from '../types';

interface AppState {
  // Data
  properties: Property[];
  spaces: Space[];
  photos: Photo[];
  
  // Property actions
  addProperty: (property: Omit<Property, 'id' | 'date_created' | 'date_updated'>) => Property;
  updateProperty: (id: string, updates: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  getProperty: (id: string) => Property | undefined;
  
  // Space actions
  addSpace: (space: Omit<Space, 'id' | 'date_created' | 'date_updated'>) => Space;
  updateSpace: (id: string, updates: Partial<Space>) => void;
  deleteSpace: (id: string) => void;
  getSpace: (id: string) => Space | undefined;
  getSpacesByProperty: (propertyId: string) => Space[];
  
  // Photo actions
  addPhoto: (photo: Omit<Photo, 'id' | 'date_created' | 'date_updated'>) => Photo;
  updatePhoto: (id: string, updates: Partial<Photo>) => void;
  deletePhoto: (id: string) => void;
  getPhoto: (id: string) => Photo | undefined;
  getPhotosByProperty: (propertyId: string) => Photo[];
  getPhotosBySpace: (spaceId: string) => Photo[];
  
  // Initialize with mock data
  initializeMockData: () => void;
}

// Helper to generate IDs
const generateId = () => `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Mock data generator
const createMockData = () => {
  const property1: Property = {
    id: 'prop-1',
    app_profile_id: 'profile-1',
    address_free_text: '123 Main Street, San Francisco, CA 94102',
    lease_start_date: '2024-01-01',
    lease_end_date: '2024-12-31',
    nickname: 'Downtown Apartment',
    state_code: 'CA',
    status: 'active',
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  };

  const property2: Property = {
    id: 'prop-2',
    app_profile_id: 'profile-1',
    address_free_text: '456 Oak Avenue, Los Angeles, CA 90001',
    lease_start_date: '2024-02-01',
    nickname: 'Oak Street House',
    state_code: 'CA',
    status: 'active',
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  };

  const space1: Space = {
    id: 'space-1',
    property: 'prop-1',
    space_type: 'living_room',
    display_name: 'Living Room',
    ordinal: 1,
    is_default: true,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  };

  const space2: Space = {
    id: 'space-2',
    property: 'prop-1',
    space_type: 'kitchen',
    display_name: 'Kitchen',
    ordinal: 2,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  };

  const space3: Space = {
    id: 'space-3',
    property: 'prop-1',
    space_type: 'bedroom',
    display_name: 'Master Bedroom',
    ordinal: 3,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  };

  const photo1: Photo = {
    id: 'photo-1',
    property: 'prop-1',
    file: 'file-1',
    captured_at: new Date().toISOString(),
    assignment_status: 'unassigned',
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  };

  const photo2: Photo = {
    id: 'photo-2',
    property: 'prop-1',
    file: 'file-2',
    captured_at: new Date().toISOString(),
    assignment_status: 'confirmed',
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  };

  return {
    properties: [property1, property2],
    spaces: [space1, space2, space3],
    photos: [photo1, photo2],
  };
};

export const useAppStore = create<AppState>((set, get) => ({
  properties: [],
  spaces: [],
  photos: [],

  initializeMockData: () => {
    const mockData = createMockData();
    set({
      properties: mockData.properties,
      spaces: mockData.spaces,
      photos: mockData.photos,
    });
  },

  // Property actions
  addProperty: (propertyData) => {
    const newProperty: Property = {
      ...propertyData,
      id: generateId(),
      date_created: new Date().toISOString(),
      date_updated: new Date().toISOString(),
    };
    set((state) => ({
      properties: [...state.properties, newProperty],
    }));
    return newProperty;
  },

  updateProperty: (id, updates) => {
    set((state) => ({
      properties: state.properties.map((p) =>
        p.id === id ? { ...p, ...updates, date_updated: new Date().toISOString() } : p
      ),
    }));
  },

  deleteProperty: (id) => {
    set((state) => ({
      properties: state.properties.filter((p) => p.id !== id),
      spaces: state.spaces.filter((s) => s.property !== id),
      photos: state.photos.filter((ph) => ph.property !== id),
    }));
  },

  getProperty: (id) => {
    return get().properties.find((p) => p.id === id);
  },

  // Space actions
  addSpace: (spaceData) => {
    const newSpace: Space = {
      ...spaceData,
      id: generateId(),
      date_created: new Date().toISOString(),
      date_updated: new Date().toISOString(),
    };
    set((state) => ({
      spaces: [...state.spaces, newSpace],
    }));
    return newSpace;
  },

  updateSpace: (id, updates) => {
    set((state) => ({
      spaces: state.spaces.map((s) =>
        s.id === id ? { ...s, ...updates, date_updated: new Date().toISOString() } : s
      ),
    }));
  },

  deleteSpace: (id) => {
    set((state) => ({
      spaces: state.spaces.filter((s) => s.id !== id),
    }));
  },

  getSpace: (id) => {
    return get().spaces.find((s) => s.id === id);
  },

  getSpacesByProperty: (propertyId) => {
    return get().spaces.filter((s) => s.property === propertyId);
  },

  // Photo actions
  addPhoto: (photoData) => {
    const newPhoto: Photo = {
      ...photoData,
      id: generateId(),
      date_created: new Date().toISOString(),
      date_updated: new Date().toISOString(),
    };
    set((state) => ({
      photos: [...state.photos, newPhoto],
    }));
    return newPhoto;
  },

  updatePhoto: (id, updates) => {
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, ...updates, date_updated: new Date().toISOString() } : p
      ),
    }));
  },

  deletePhoto: (id) => {
    set((state) => ({
      photos: state.photos.filter((p) => p.id !== id),
    }));
  },

  getPhoto: (id) => {
    return get().photos.find((p) => p.id === id);
  },

  getPhotosByProperty: (propertyId) => {
    return get().photos.filter((p) => p.property === propertyId);
  },

  getPhotosBySpace: (spaceId) => {
    // For now, we'll need to track space assignments differently
    // This is a simplified version - in real app, you'd query PhotoSpaceAssignment
    return get().photos.filter((p) => {
      // This would need to check assignments in a real implementation
      // For mock, we'll return empty array and handle assignments separately
      return false;
    });
  },
}));

