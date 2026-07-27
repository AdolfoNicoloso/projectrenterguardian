/**
 * Data contract types for Cloud Functions → Firestore responses.
 */

export interface Property {
  id: string;
  app_profile_id: string;
  /** True owner profile id (same as app_profile_id for owned properties). */
  owner_app_profile_id?: string;
  /** Caller's role on this property. */
  my_role?: 'owner' | 'edit' | 'view';
  address_free_text: string;
  lease_start_date: string;
  lease_end_date?: string;
  lease_term?: number;
  /**
   * Personal tour date/time tracker (ISO). Not a landlord booking.
   * Used for Touring properties; null/undefined when unset.
   */
  tour_scheduled_at?: string | null;
  /**
   * When the user confirmed (or the system recorded) that this place was toured.
   * Distinct from schedule-based “past tour time.”
   */
  tour_completed_at?: string | null;
  /** How tour_completed_at was set. */
  tour_completed_source?:
    | 'confirmed'
    | 'inspection'
    | 'schedule_inferred'
    | null;
  /** Completed tour (or other) inspection used as the move-in baseline. */
  move_in_baseline_inspection_id?: string | null;
  /** Opt-in mid-tenancy check-in reminder (ISO). */
  next_check_in_at?: string | null;
  check_in_reminder_opt_in?: boolean | null;
  nickname?: string;
  state_code?: string;
  status?: string;
  street?: string;
  unit?: string;
  city?: string;
  zip?: number;
  /** Optional listing / property link (http/https URL). */
  listing_url?: string;
  /**
   * Opaque media_files id for a submitted rental application PDF
   * (via createMediaUpload / getFile).
   */
  application_file?: string | null;
  /** Original filename for the application PDF (display only). */
  application_file_name?: string | null;
  /** When status became applied (ISO). */
  applied_at?: string | null;
  date_created?: string;
  date_updated?: string;
}

export type PropertyMemberRole = 'edit' | 'view';

export interface PropertyMember {
  id: string;
  property_id: string;
  app_profile_id: string;
  role: PropertyMemberRole;
  status: string;
  invited_by_app_profile_id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  date_created?: string;
  date_updated?: string;
}

export interface PropertyInvite {
  id: string;
  property_id: string;
  role: PropertyMemberRole;
  status: string;
  /** contact = email/phone bound; link = anyone with the link may join */
  invite_kind?: 'contact' | 'link';
  invite_email?: string | null;
  invite_phone?: string | null;
  token: string;
  share_url?: string | null;
  share_message?: string;
  invited_by_app_profile_id?: string;
  expires_at?: string | null;
  date_created?: string;
  date_updated?: string;
}

export interface PropertyPublicShare {
  id: string;
  property_id: string;
  status: string;
  token: string;
  share_url?: string | null;
  share_message?: string;
  expires_at?: string | null;
  date_created?: string;
  date_updated?: string;
}

export interface PropertyPeoplePayload {
  my_role: 'owner' | 'edit' | 'view';
  owner: {
    app_profile_id: string;
    role: 'owner';
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  members: PropertyMember[];
  invites: PropertyInvite[];
  public_share?: PropertyPublicShare | null;
}

export interface NoteEntry {
  id: string;
  body: string;
  created_at: string;
  created_by_app_profile_id: string;
  created_by_name: string;
  updated_at?: string | null;
  updated_by_app_profile_id?: string | null;
  updated_by_name?: string | null;
}

export interface Space {
  id: string;
  property: string;
  space_type:
    | 'bedroom'
    | 'bathroom'
    | 'kitchen'
    | 'living_room'
    | 'dining_room'
    | 'family_room'
    | 'office'
    | 'hallway'
    | 'entryway'
    | 'stairwell'
    | 'closet'
    | 'pantry'
    | 'laundry'
    | 'utility'
    | 'garage'
    | 'parking'
    | 'basement'
    | 'attic'
    | 'loft'
    | 'mudroom'
    | 'storage'
    | 'balcony'
    | 'patio'
    | 'deck'
    | 'porch'
    | 'yard'
    | 'custom_space_type';
  display_name: string;
  custom_space_type?: string;
  ordinal?: number;
  is_default?: boolean;
  /** Timestamped bullet notes (source of truth). */
  notes_entries?: NoteEntry[];
  /** @deprecated Prefer notes_entries. */
  notes?: string;
  date_created?: string;
  date_updated?: string;
}

export interface Photo {
  id: string;
  property: string;
  space: string;
  /** Opaque media id from uploadFile; used with getFile. */
  file: string;
  captured_at: string;
  exif_datetime_original?: string;
  assignment_status: 'unassigned' | 'confirmed';
  /** Timestamped bullet notes (source of truth). */
  notes_entries?: NoteEntry[];
  /** @deprecated Prefer notes_entries. */
  notes?: string;
  /** Display order within space (or unassigned tray). */
  ordinal?: number;
  date_created?: string;
  date_updated?: string;
}

export interface PhotoSpaceAssignment {
  id: string;
  photo: string;
  space: string;
  status: 'confirmed';
  date_created?: string;
  date_updated?: string;
}

export interface Report {
  id: string;
  property: string;
  snapshot_json?: unknown;
  status: 'draft' | 'generating' | 'ready' | 'failed';
  pdf_file?: string;
  date_created?: string;
  date_updated?: string;
}

export interface AppProfile {
  id: string;
  name?: string;
  onboarding_completed?: boolean;
}

export interface Inspection {
  id: string;
  property_id: string;
  created_by_user_id: string;
  inspection_status: 'in_progress' | 'completed';
  inspection_type: string; // move_in | move_out | tour | periodic | damage_assessment
  started_at: string;
  completed_at?: string;
  last_step?: string | null;
  inspections_progress: number;
  date_created?: string;
  date_updated?: string;
}

export interface InspectionStep {
  id: string;
  inspection_id: string;
  step_key: string;
  inspection_step_status: 'not_started' | 'in_progress' | 'completed';
  payload_json?: unknown;
  date_created?: string;
  date_updated?: string;
}

export interface UserPreferences {
  id: string;
  app_profile_id: string;
  theme_preference: 'light' | 'dark' | 'auto';
  preferred_language?: string;
  date_created?: string;
  date_updated?: string;
}

export type AppNotificationType =
  | 'property_invite'
  | 'tour_reminder_1d'
  | 'tour_reminder_30m'
  | 'check_in_reminder'
  | string;

export interface AppNotification {
  id: string;
  app_profile_id: string;
  property_id?: string | null;
  type: AppNotificationType;
  title: string;
  body: string;
  invite_id?: string | null;
  invite_token?: string | null;
  tour_scheduled_at?: string | null;
  read_at?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
}
