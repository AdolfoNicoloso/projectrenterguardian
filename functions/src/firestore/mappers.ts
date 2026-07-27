/**
 * Maps Firestore documents to the JSON shapes the Expo app expects.
 */

import {toDateOnly, toIso, type FsDoc} from "./db";
import {
  normalizeNotesEntries,
  notesEntriesToLegacyText,
} from "./notes";

/**
 * @param {FsDoc} doc Profile document.
 * @return {Record<string, unknown>} Client app profile.
 */
export function mapAppProfileToClient(
  doc: FsDoc
): Record<string, unknown> {
  return {
    id: doc.id,
    name: doc.name ?? undefined,
    onboarding_completed: doc.onboarding_completed ?? false,
    date_created: toIso(doc.date_created),
    date_updated: toIso(doc.date_updated),
  };
}

/**
 * @param {FsDoc} doc Property document.
 * @param {string} appProfileId Owner profile id.
 * @return {Record<string, unknown>} Client property.
 */
export function mapPropertyToClient(
  doc: FsDoc,
  appProfileId: string
): Record<string, unknown> {
  return {
    id: doc.id,
    app_profile_id: appProfileId,
    address_free_text: doc.address_free_text ?? "",
    lease_start_date: toDateOnly(doc.lease_start_date) ?? "",
    lease_end_date: toDateOnly(doc.lease_end_date),
    lease_term: doc.lease_term ?? undefined,
    /** Personal tour tracker (ISO); not a landlord booking. */
    tour_scheduled_at: toIso(doc.tour_scheduled_at) ?? null,
    tour_completed_at: toIso(doc.tour_completed_at) ?? null,
    tour_completed_source: doc.tour_completed_source ?? null,
    move_in_baseline_inspection_id:
      doc.move_in_baseline_inspection_id ?? null,
    next_check_in_at: toIso(doc.next_check_in_at) ?? null,
    check_in_reminder_opt_in:
      typeof doc.check_in_reminder_opt_in === "boolean" ?
        doc.check_in_reminder_opt_in :
        null,
    nickname: doc.nickname ?? undefined,
    state_code: doc.state_code ?? undefined,
    status: doc.status ?? "active",
    street: doc.street ?? undefined,
    unit: doc.unit ?? undefined,
    city: doc.city ?? undefined,
    zip: doc.zip ?? undefined,
    listing_url: doc.listing_url ?? undefined,
    application_file: doc.application_file ?? null,
    application_file_name: doc.application_file_name ?? null,
    applied_at: toIso(doc.applied_at) ?? null,
    date_created: toIso(doc.date_created),
    date_updated: toIso(doc.date_updated),
  };
}

/**
 * @param {FsDoc} doc Space document.
 * @return {Record<string, unknown>} Client space.
 */
export function mapSpaceToClient(doc: FsDoc): Record<string, unknown> {
  const notesEntries = normalizeNotesEntries(doc.notes_entries, doc.notes);
  return {
    id: doc.id,
    property: doc.property_id ?? "",
    space_type: doc.space_type ?? "",
    display_name: doc.display_name ?? "",
    custom_space_type: doc.custom_space_type ?? undefined,
    ordinal: doc.ordinal ?? undefined,
    is_default: doc.is_default ?? undefined,
    notes_entries: notesEntries,
    /** @deprecated Prefer notes_entries; kept for older clients. */
    notes: notesEntriesToLegacyText(notesEntries) ?? undefined,
    date_created: toIso(doc.date_created),
    date_updated: toIso(doc.date_updated),
  };
}

/**
 * @param {FsDoc} doc Photo document.
 * @return {Record<string, unknown>} Client photo.
 */
export function mapPhotoToClient(doc: FsDoc): Record<string, unknown> {
  const notesEntries = normalizeNotesEntries(doc.notes_entries, doc.notes);
  return {
    id: doc.id,
    property: doc.property_id ?? "",
    space: doc.space_id ?? "",
    file: doc.file ?? "",
    captured_at: toIso(doc.captured_at) ?? "",
    exif_datetime_original: toIso(doc.exif_datetime_original),
    assignment_status: doc.assignment_status ?? "unassigned",
    notes_entries: notesEntries,
    /** @deprecated Prefer notes_entries; kept for older clients. */
    notes: notesEntriesToLegacyText(notesEntries) ?? undefined,
    ordinal: typeof doc.ordinal === "number" ? doc.ordinal : undefined,
    date_created: toIso(doc.date_created),
    date_updated: toIso(doc.date_updated),
  };
}

/**
 * Lean photo DTO for grids (no notes payload).
 * @param {FsDoc} doc Photo document.
 * @return {Record<string, unknown>} Gallery photo.
 */
export function mapPhotoToGalleryClient(doc: FsDoc): Record<string, unknown> {
  return {
    id: doc.id,
    property: doc.property_id ?? "",
    space: doc.space_id ?? "",
    file: doc.file ?? "",
    captured_at: toIso(doc.captured_at) ?? "",
    assignment_status: doc.assignment_status ?? "unassigned",
    ordinal: typeof doc.ordinal === "number" ? doc.ordinal : undefined,
    date_created: toIso(doc.date_created),
    date_updated: toIso(doc.date_updated),
  };
}

/**
 * @param {FsDoc} doc Report document.
 * @return {Record<string, unknown>} Client report.
 */
export function mapReportToClient(doc: FsDoc): Record<string, unknown> {
  return {
    id: doc.id,
    property: doc.property_id ?? "",
    snapshot_json: doc.snapshot_json ?? undefined,
    status: doc.status ?? "draft",
    pdf_file: doc.pdf_file ?? undefined,
    report_type: doc.report_type ?? undefined,
    context_state_code: doc.context_state_code ?? undefined,
    disclaimer_version: doc.disclaimer_version ?? undefined,
    generated_at: toIso(doc.generated_at) ?? toIso(doc.date_created),
    date_created: toIso(doc.date_created),
    date_updated: toIso(doc.date_updated),
  };
}

/**
 * @param {FsDoc} doc Inspection document.
 * @return {Record<string, unknown>} Client inspection.
 */
export function mapInspectionToClient(
  doc: FsDoc
): Record<string, unknown> {
  return {
    id: doc.id,
    property_id: doc.property_id ?? "",
    created_by_user_id: doc.created_by_user_id ?? "",
    inspection_status: doc.inspection_status ?? "in_progress",
    inspection_type: doc.inspection_type ?? "",
    started_at: toIso(doc.started_at) ?? "",
    completed_at: toIso(doc.completed_at),
    last_step: doc.last_step ?? null,
    inspections_progress: doc.inspections_progress ?? 0,
    date_created: toIso(doc.date_created),
    date_updated: toIso(doc.date_updated),
  };
}

/**
 * @param {FsDoc} doc Inspection step document.
 * @return {Record<string, unknown>} Client step.
 */
export function mapInspectionStepToClient(
  doc: FsDoc
): Record<string, unknown> {
  return {
    id: doc.id,
    inspection_id: doc.inspection_id ?? "",
    step_key: doc.step_key ?? "",
    inspection_step_status: doc.inspection_step_status ?? "not_started",
    payload_json: doc.payload_json ?? undefined,
    date_created: toIso(doc.date_created),
    date_updated: toIso(doc.date_updated),
  };
}

/**
 * @param {FsDoc} doc Assignment document.
 * @return {Record<string, unknown>} Client assignment.
 */
export function mapAssignmentToClient(
  doc: FsDoc
): Record<string, unknown> {
  return {
    id: doc.id,
    photo: doc.photo_id ?? "",
    space: doc.space_id ?? "",
    status: doc.status ?? "confirmed",
    confirmed_at: toIso(doc.confirmed_at),
    confirmed_by_app_profile: doc.confirmed_by_app_profile ?? undefined,
    method: doc.method ?? "manual",
    date_created: toIso(doc.date_created),
    date_updated: toIso(doc.date_updated),
  };
}

/**
 * @param {FsDoc} doc Preferences document.
 * @return {Record<string, unknown>} Client preferences.
 */
export function mapUserPreferenceToClient(
  doc: FsDoc
): Record<string, unknown> {
  return {
    id: doc.id,
    app_profile_id: doc.app_profile_id ?? "",
    theme_preference: doc.theme_preference ?? "auto",
    preferred_language: doc.preferred_language ?? undefined,
    date_created: toIso(doc.date_created),
    date_updated: toIso(doc.date_updated),
  };
}
