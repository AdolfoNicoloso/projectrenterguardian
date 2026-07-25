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

  // Primary hub tabs (split from former Home)
  RENTS: {
    LIST: '/(tabs)/rents',
  },
  TOURS: {
    LIST: '/(tabs)/tours',
  },
  
  // Properties routes (create / detail stack; list redirects to Rents)
  PROPERTIES: {
    /** @deprecated Prefer Routes.RENTS.LIST or Routes.TOURS.LIST */
    LIST: '/(tabs)/rents',
    CREATE: '/(tabs)/properties/status-intent',
    TOURS_CALENDAR: '/(tabs)/properties/tours-calendar',
    DETAIL: (id: string) => `/(tabs)/properties/${id}`,
    /** Post-create invite step (property already exists). */
    INVITE_COLLABORATORS: '/(tabs)/properties/invite-collaborators',
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

  /** In-app legal documents (Privacy, Terms, notices). */
  LEGAL: {
    DOC: (doc: 'privacy' | 'terms' | 'notices') => `/legal/${doc}`,
  },

  /** In-app notifications inbox (hidden tab). */
  NOTIFICATIONS: '/(tabs)/notifications',

  /** Public property preview (no login). */
  SHARE: {
    PREVIEW: (token: string) => `/share/${token}`,
  },
} as const;

