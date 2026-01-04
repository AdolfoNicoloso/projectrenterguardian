/**
 * Data contract types matching Directus collections.
 * These types represent the structure of data stored in Directus CMS.
 */

/**
 * Property entity - represents a rental property.
 */
export interface Property {
  id: string;
  app_profile_id: string;
  address_free_text: string;
  lease_start_date: string;
  lease_end_date?: string;
  lease_term?: number;
  nickname?: string;
  state_code?: string;
  status?: string;
  street?: string;
  unit?: string;
  city?: string;
  zip?: number;
  date_created?: string;
  date_updated?: string;
}

/**
 * Space entity - represents a room or area within a property.
 */
export interface Space {
  id: string;
  property: string;
  space_type: 'living_room' | 'kitchen' | 'hallway' | 'bedroom' | 'bathroom' | 'garage' | 'dining_room' | 'custom_space_type';
  display_name: string;
  custom_space_type?: string; // Custom type name when space_type is 'custom_space_type' (max 255 chars)
  ordinal?: number;
  is_default?: boolean;
  date_created?: string;
  date_updated?: string;
}

/**
 * Photo entity - represents a photo associated with a property and space.
 */
export interface Photo {
  id: string;
  property: string;
  space: string; // required in Directus
  file: string; // directus_files id
  captured_at: string;
  exif_datetime_original?: string;
  assignment_status: 'unassigned' | 'confirmed';
  notes?: string;
  date_created?: string;
  date_updated?: string;
}

/**
 * Photo-space assignment - links a photo to a specific space.
 */
export interface PhotoSpaceAssignment {
  id: string;
  photo: string;
  space: string;
  status: 'confirmed';
  date_created?: string;
  date_updated?: string;
}

/**
 * Report entity - represents a move-in or inspection report.
 */
export interface Report {
  id: string;
  property: string;
  snapshot_json?: any;
  status: 'draft' | 'generating' | 'ready' | 'failed';
  pdf_file?: string;
  date_created?: string;
  date_updated?: string;
}

/**
 * Disclaimer block - legal disclaimers displayed in reports (CMS content).
 */
export interface DisclaimerBlock {
  id: string;
  title: string;
  content: string; // markdown
  order?: number;
  is_active?: boolean;
}

/**
 * Jurisdiction context - state-specific educational content (CMS content).
 */
export interface JurisdictionContext {
  id: string;
  state_code: string;
  educational_content?: string; // markdown
}

/**
 * Directus file metadata - represents a file stored in Directus.
 */
export interface DirectusFile {
  id: string;
  filename_download: string;
  type?: string;
  filesize?: number;
  width?: number;
  height?: number;
}

/**
 * App profile - links Firebase user to Directus user profile.
 * Used for data ownership and isolation.
 */
export interface AppProfile {
  id: string;
  directus_users_id: string;
  name?: string;
  onboarding_completed?: boolean;
  // Add other profile fields as needed
}

/**
 * Inspection entity - represents a guided inspection workflow.
 * Note: Uses property_id instead of property (inconsistent with other entities).
 */
export interface Inspection {
  id: string;
  property_id: string;
  created_by_user_id: string;
  inspection_status: 'in_progress' | 'completed';
  inspection_type: string;
  started_at: string;
  completed_at?: string;
  last_step?: string | null;
  inspections_progress: number; // 0-100
  date_created?: string;
  date_updated?: string;
}

/**
 * Inspection step - represents a single step in a guided inspection.
 * Note: Uses inspection_id instead of inspection (inconsistent with other entities).
 */
export interface InspectionStep {
  id: string;
  inspection_id: string;
  step_key: string;
  inspection_step_status: 'not_started' | 'in_progress' | 'completed';
  payload_json?: any;
  date_created?: string;
  date_updated?: string;
}

/**
 * User preferences - stores user-specific settings (e.g., theme preference).
 */
export interface UserPreferences {
  id: string;
  app_profile_id: string;
  theme_preference: 'light' | 'dark' | 'auto';
  preferred_language?: string;
  date_created?: string;
  date_updated?: string;
}


