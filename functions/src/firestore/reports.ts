/**
 * Reports (Firestore).
 */

import {db, nowIso, snapToDoc} from "./db";
import {requirePropertyAccess} from "./access";
import {mapReportToClient} from "./mappers";

/**
 * @param {string} appProfileId Owner profile id.
 * @param {object} input Create body from client.
 * @return {Promise<Record<string, unknown>>} Created report.
 */
export async function createReport(
  appProfileId: string,
  input: {
    property?: string;
    report_type?: string;
    status?: string;
    snapshot_json?: unknown;
    context_state_code?: string;
    disclaimer_version?: string;
  }
): Promise<Record<string, unknown>> {
  if (
    !input.property ||
    !input.report_type ||
    !input.status ||
    input.snapshot_json === undefined
  ) {
    throw new Error("VALIDATION");
  }
  await requirePropertyAccess(appProfileId, input.property, "edit");
  const ts = nowIso();
  const data: Record<string, unknown> = {
    property_id: input.property,
    report_type: input.report_type,
    status: input.status,
    snapshot_json: input.snapshot_json,
    generated_at: ts,
    date_created: ts,
    date_updated: ts,
  };
  if (input.context_state_code) {
    data.context_state_code = input.context_state_code;
  }
  if (input.disclaimer_version) {
    data.disclaimer_version = input.disclaimer_version;
  }
  const ref = db().collection("reports").doc();
  await ref.set(data);
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("Firestore: create report failed");
  }
  return mapReportToClient(doc);
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} propertyId Property id.
 * @return {Promise<Record<string, unknown>[]>} Reports for property.
 */
export async function listReportsForProperty(
  appProfileId: string,
  propertyId: string
): Promise<Record<string, unknown>[]> {
  await requirePropertyAccess(appProfileId, propertyId, "view");
  const snap = await db()
    .collection("reports")
    .where("property_id", "==", propertyId)
    .limit(100)
    .get();
  const rows = snap.docs
    .map((d) => snapToDoc(d))
    .filter((d): d is NonNullable<typeof d> => d != null);
  rows.sort((a, b) =>
    String(b.date_created || "").localeCompare(String(a.date_created || ""))
  );
  return rows.map((d) => mapReportToClient(d));
}

/**
 * @param {string} appProfileId Owner profile id.
 * @param {string} reportId Report id.
 * @return {Promise<Record<string, unknown>|null>} Report or null.
 */
export async function getReportById(
  appProfileId: string,
  reportId: string
): Promise<Record<string, unknown> | null> {
  const doc = snapToDoc(
    await db().collection("reports").doc(reportId).get()
  );
  if (!doc) {
    return null;
  }
  const propId = String(doc.property_id || "");
  if (!propId) {
    return null;
  }
  try {
    await requirePropertyAccess(appProfileId, propId, "view");
  } catch {
    return null;
  }
  return mapReportToClient(doc);
}

/**
 * Patch a report (e.g. attach generated PDF media id).
 * @param {string} appProfileId Caller profile id.
 * @param {string} reportId Report id.
 * @param {object} patch Allowed fields (pdf_file).
 * @return {Promise<Record<string, unknown>>} Updated report.
 */
export async function updateReport(
  appProfileId: string,
  reportId: string,
  patch: {pdf_file?: string | null}
): Promise<Record<string, unknown>> {
  const ref = db().collection("reports").doc(reportId);
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("NOT_FOUND");
  }
  const propId = String(doc.property_id || "");
  if (!propId) {
    throw new Error("NOT_FOUND");
  }
  await requirePropertyAccess(appProfileId, propId, "edit");
  const data: Record<string, unknown> = {
    date_updated: nowIso(),
  };
  if (Object.prototype.hasOwnProperty.call(patch, "pdf_file")) {
    const raw = patch.pdf_file;
    data.pdf_file =
      raw != null && String(raw).trim() ? String(raw).trim() : null;
  }
  await ref.update(data);
  const updated = snapToDoc(await ref.get());
  if (!updated) {
    throw new Error("Firestore: update report failed");
  }
  return mapReportToClient(updated);
}
