/**
 * Route constants for navigation.
 * Use these constants instead of hardcoded route strings to ensure consistency.
 */

export const Routes = {
  // Auth routes
  AUTH: {
    WELCOME: '/welcome',
    LOGIN: '/(auth)/login',
    SIGNUP: '/(auth)/signup',
    FORGOT_PASSWORD: '/(auth)/forgot-password',
  },
  
  // Properties routes
  PROPERTIES: {
    LIST: '/(tabs)/properties',
    CREATE: '/(tabs)/properties/status-intent',
    TOURS_CALENDAR: '/(tabs)/properties/tours-calendar',
    DETAIL: (id: string) => `/(tabs)/properties/${id}`,
    PHOTOS: {
      UPLOAD: (propertyId: string, spaceId?: string) => 
        spaceId 
          ? `/(tabs)/properties/${propertyId}/photos/upload?spaceId=${spaceId}`
          : `/(tabs)/properties/${propertyId}/photos/upload`,
      DETAIL: (propertyId: string, photoId: string) => 
        `/(tabs)/properties/${propertyId}/photos/${photoId}`,
    },
    SPACES: {
      CREATE: (propertyId: string) => `/(tabs)/properties/${propertyId}/spaces/create`,
      DETAIL: (propertyId: string, spaceId: string) => 
        `/(tabs)/properties/${propertyId}/spaces/${spaceId}`,
    },
    ASSIGNMENTS: {
      BULK: (propertyId: string) => `/(tabs)/properties/${propertyId}/assignments/bulk`,
    },
    REPORTS: {
      DETAIL: (propertyId: string, reportId: string) => 
        `/(tabs)/properties/${propertyId}/reports/${reportId}`,
    },
    ADDRESS: {
      EDIT: (propertyId: string) => `/(tabs)/properties/${propertyId}/address`,
    },
  },
  
  // Inspections routes
  INSPECTIONS: {
    LIST: '/(tabs)/inspections',
    NEW: '/(tabs)/inspections/new',
    DETAIL: (id: string) => `/(tabs)/inspections/${id}`,
  },
  
  // Insights routes (user-facing name: Reports)
  REPORTS: {
    LIST: '/(tabs)/insights',
    DETAIL: (id: string) => `/(tabs)/insights/${id}`,
  },
  /** @deprecated Use Routes.REPORTS */
  INSIGHTS: {
    LIST: '/(tabs)/insights',
    DETAIL: (id: string) => `/(tabs)/insights/${id}`,
  },
  
  // Profile route
  PROFILE: '/(tabs)/profile',
} as const;

