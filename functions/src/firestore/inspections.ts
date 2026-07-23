/**
 * Inspections and inspection steps (Firestore).
 */

import {db, nowIso, snapToDoc, type FsDoc} from "./db";
import {getPropertyAccess, requirePropertyAccess} from "./access";
import {mapInspectionStepToClient, mapInspectionToClient} from "./mappers";
import {isValidInspectionType} from "./inspectionTypes";
import {canPropertyStartInspectionType} from "./propertyStatuses";
import {listPropertiesForAppProfile} from "./properties";

const STEP_KEYS = [
  "intro",
  "choose_property",
  "confirm_scope",
  "capture_overview",
  "capture_spaces",
  "review",
  "complete",
];

/**
 * @param {string} appProfileId Caller profile id.
 * @param {FsDoc} doc Inspection document.
 * @return {Promise<boolean>} Whether the caller may read the inspection.
 */
async function canAccessInspection(
  appProfileId: string,
  doc: FsDoc
): Promise<boolean> {
  if (doc.created_by_user_id === appProfileId) {
    return true;
  }
  const propertyId = String(doc.property_id || "");
  if (!propertyId) {
    return false;
  }
  const access = await getPropertyAccess(appProfileId, propertyId);
  return access != null;
}

/**
 * @param {string} appProfileId Caller profile id.
 * @param {FsDoc} doc Inspection document.
 * @return {Promise<boolean>} Whether the caller may mutate the inspection.
 */
async function canEditInspection(
  appProfileId: string,
  doc: FsDoc
): Promise<boolean> {
  if (doc.created_by_user_id === appProfileId) {
    return true;
  }
  const propertyId = String(doc.property_id || "");
  if (!propertyId) {
    return false;
  }
  const access = await getPropertyAccess(appProfileId, propertyId);
  return access != null && (access.role === "owner" || access.role === "edit");
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} propertyId Property id.
 * @param {string} inspectionType Inspection type string.
 * @return {Promise<Record<string, unknown>>} Created inspection.
 */
export async function createInspection(
  appProfileId: string,
  propertyId: string,
  inspectionType: string
): Promise<Record<string, unknown>> {
  if (!isValidInspectionType(inspectionType)) {
    throw new Error("BAD_INSPECTION_TYPE");
  }
  const access = await requirePropertyAccess(appProfileId, propertyId, "edit");
  const status = String(access.property.status || "").toLowerCase();
  if (!canPropertyStartInspectionType(status, inspectionType)) {
    throw new Error("PROPERTY_NOT_ELIGIBLE");
  }
  const ts = nowIso();
  const inspRef = db().collection("inspections").doc();
  await inspRef.set({
    property_id: propertyId,
    created_by_user_id: appProfileId,
    inspection_status: "in_progress",
    inspection_type: inspectionType,
    started_at: ts,
    completed_at: null,
    last_step: null,
    inspections_progress: 0,
    date_created: ts,
    date_updated: ts,
  });
  for (let i = 0; i < STEP_KEYS.length; i++) {
    const stepTs = nowIso();
    await db().collection("inspection_steps").doc().set({
      inspection_id: inspRef.id,
      step_key: STEP_KEYS[i],
      inspection_step_status: i === 0 ? "in_progress" : "not_started",
      payload_json: {},
      date_created: stepTs,
      date_updated: stepTs,
    });
  }
  const doc = snapToDoc(await inspRef.get());
  if (!doc) {
    throw new Error("Firestore: create inspection failed");
  }
  return mapInspectionToClient(doc);
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string|undefined} status Optional status filter.
 * @return {Promise<Record<string, unknown>[]>} Inspections.
 */
export async function listInspections(
  appProfileId: string,
  status?: string
): Promise<Record<string, unknown>[]> {
  const byId = new Map<string, ReturnType<typeof mapInspectionToClient>>();

  let ownQuery = db()
    .collection("inspections")
    .where("created_by_user_id", "==", appProfileId);
  if (status) {
    ownQuery = ownQuery.where("inspection_status", "==", status);
  }
  const ownSnap = await ownQuery.limit(200).get();
  for (const d of ownSnap.docs) {
    const doc = snapToDoc(d);
    if (!doc) continue;
    byId.set(doc.id, mapInspectionToClient(doc));
  }

  // Also include inspections on accessible properties.
  const props = await listPropertiesForAppProfile(appProfileId);
  const propertyIds = props.map((p) => String(p.id)).filter(Boolean);
  const chunkSize = 10;
  for (let i = 0; i < propertyIds.length; i += chunkSize) {
    const chunk = propertyIds.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    let q = db()
      .collection("inspections")
      .where("property_id", "in", chunk);
    if (status) {
      q = q.where("inspection_status", "==", status);
    }
    const snap = await q.limit(200).get();
    for (const d of snap.docs) {
      const doc = snapToDoc(d);
      if (!doc || byId.has(doc.id)) continue;
      byId.set(doc.id, mapInspectionToClient(doc));
    }
  }

  const rows = Array.from(byId.values());
  rows.sort((a, b) =>
    String(b.date_created || "").localeCompare(String(a.date_created || ""))
  );
  return rows;
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} inspectionId Inspection id.
 * @return {Promise<Record<string, unknown>|null>} Inspection or null.
 */
export async function getInspectionById(
  appProfileId: string,
  inspectionId: string
): Promise<Record<string, unknown> | null> {
  const doc = snapToDoc(
    await db().collection("inspections").doc(inspectionId).get()
  );
  if (!doc || !(await canAccessInspection(appProfileId, doc))) {
    return null;
  }
  return mapInspectionToClient(doc);
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} inspectionId Inspection id.
 * @return {Promise<Record<string, unknown>[]>} Steps.
 */
export async function listInspectionSteps(
  appProfileId: string,
  inspectionId: string
): Promise<Record<string, unknown>[]> {
  if (!(await getInspectionById(appProfileId, inspectionId))) {
    throw new Error("NOT_FOUND");
  }
  const snap = await db()
    .collection("inspection_steps")
    .where("inspection_id", "==", inspectionId)
    .limit(50)
    .get();
  const steps = snap.docs
    .map((d) => snapToDoc(d))
    .filter((d): d is NonNullable<typeof d> => d != null)
    .map((d) => mapInspectionStepToClient(d));
  // Stable order by step_key position.
  const order = new Map(STEP_KEYS.map((k, i) => [k, i]));
  steps.sort((a, b) => {
    const ai = order.get(String(a.step_key)) ?? 99;
    const bi = order.get(String(b.step_key)) ?? 99;
    return ai - bi;
  });
  return steps;
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} inspectionId Inspection id.
 * @param {string} stepKey Step key.
 * @return {Promise<Record<string, unknown>|null>} Step or null.
 */
export async function getInspectionStep(
  appProfileId: string,
  inspectionId: string,
  stepKey: string
): Promise<Record<string, unknown> | null> {
  if (!(await getInspectionById(appProfileId, inspectionId))) {
    return null;
  }
  const snap = await db()
    .collection("inspection_steps")
    .where("inspection_id", "==", inspectionId)
    .where("step_key", "==", stepKey)
    .limit(1)
    .get();
  if (snap.empty) {
    return null;
  }
  const doc = snapToDoc(snap.docs[0]);
  return doc ? mapInspectionStepToClient(doc) : null;
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} stepId Step id.
 * @param {object} patch payload_json / status.
 * @return {Promise<Record<string, unknown>>} Updated step.
 */
export async function updateInspectionStep(
  appProfileId: string,
  stepId: string,
  patch: {payload_json?: unknown; inspection_step_status?: string}
): Promise<Record<string, unknown>> {
  const step = snapToDoc(
    await db().collection("inspection_steps").doc(stepId).get()
  );
  if (!step) {
    throw new Error("NOT_FOUND");
  }
  const inspectionId = String(step.inspection_id || "");
  const inspection = snapToDoc(
    await db().collection("inspections").doc(inspectionId).get()
  );
  if (!inspection || !(await canEditInspection(appProfileId, inspection))) {
    throw new Error("NOT_FOUND");
  }
  const data: Record<string, unknown> = {date_updated: nowIso()};
  if (patch.payload_json !== undefined) {
    data.payload_json = patch.payload_json;
  }
  if (patch.inspection_step_status !== undefined) {
    data.inspection_step_status = patch.inspection_step_status;
  }
  const ref = db().collection("inspection_steps").doc(stepId);
  await ref.update(data);
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: update step failed");
  }
  return mapInspectionStepToClient(doc);
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} inspectionId Inspection id.
 * @param {Record<string, unknown>} patch Partial inspection fields.
 * @return {Promise<Record<string, unknown>>} Updated inspection.
 */
export async function updateInspection(
  appProfileId: string,
  inspectionId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const existing = snapToDoc(
    await db().collection("inspections").doc(inspectionId).get()
  );
  if (!existing || !(await canEditInspection(appProfileId, existing))) {
    throw new Error("NOT_FOUND");
  }
  const data: Record<string, unknown> = {date_updated: nowIso()};
  if (patch.last_step !== undefined) {
    data.last_step = patch.last_step;
  }
  if (patch.inspections_progress !== undefined) {
    data.inspections_progress = patch.inspections_progress;
  }
  if (patch.inspection_status !== undefined) {
    data.inspection_status = patch.inspection_status;
  }
  if (patch.completed_at !== undefined) {
    data.completed_at = patch.completed_at;
  }
  const ref = db().collection("inspections").doc(inspectionId);
  await ref.update(data);
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: update inspection failed");
  }
  return mapInspectionToClient(doc);
}

/**
 * Deletes an inspection and its steps. Does not delete reports already created.
 * @param {string} appProfileId Owner profile id.
 * @param {string} inspectionId Inspection id.
 * @return {Promise<boolean>} True if deleted.
 */
export async function deleteInspectionForProfile(
  appProfileId: string,
  inspectionId: string
): Promise<boolean> {
  const raw = snapToDoc(
    await db().collection("inspections").doc(inspectionId).get()
  );
  if (!raw || !(await canEditInspection(appProfileId, raw))) {
    return false;
  }
  const existing = mapInspectionToClient(raw);
  if (String(existing.inspection_status || "") === "completed") {
    throw new Error("CANNOT_DELETE_COMPLETED");
  }

  const steps = await db()
    .collection("inspection_steps")
    .where("inspection_id", "==", inspectionId)
    .get();

  let batch = db().batch();
  let ops = 0;
  const commitIfNeeded = async () => {
    if (ops >= 400) {
      await batch.commit();
      batch = db().batch();
      ops = 0;
    }
  };

  for (const step of steps.docs) {
    batch.delete(step.ref);
    ops += 1;
    await commitIfNeeded();
  }

  batch.delete(db().collection("inspections").doc(inspectionId));
  await batch.commit();
  return true;
}
