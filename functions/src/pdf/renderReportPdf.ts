/**
 * Orchestrate report PDF generation from Firestore snapshot + Storage photos.
 */

import sharp from "sharp";
import {db, nowIso, snapToDoc} from "../firestore/db";
import {requirePropertyAccess, fetchPhotoById} from "../firestore/access";
import {downloadByFileId, uploadBinary} from "../firestore/storage";
import {mapReportToClient} from "../firestore/mappers";
import {getAppProfile} from "../firestore/profiles";
import {
  TEMPLATE_VERSION,
  buildReportPdf,
  type ReportPdfContext,
  type ReportPdfSpaceSection,
  type ReportPdfPhoto,
} from "./reportTemplate";
import {
  buildReportPdfHtml,
  HTML_TEMPLATE_VERSION,
} from "./renderHtmlReportPdf";

const MAX_PHOTOS = 40;
const MAX_IMAGE_EDGE = 720;

type SpacesData = Record<
  string,
  {
    photo_ids?: string[];
    notes?: string;
    comparison_notes?: Array<{note?: string; created_at?: string}>;
  }
>;

/**
 * Generate a PDF for a report, store it, set reports.pdf_file.
 * Requires view access on the property.
 * @param {string} appProfileId Caller profile id.
 * @param {string} reportId Report id.
 * @return {Promise<Record<string, unknown>>} Updated client report.
 */
export async function generateReportPdfForReport(
  appProfileId: string,
  reportId: string
): Promise<Record<string, unknown>> {
  const ref = db().collection("reports").doc(reportId);
  const doc = snapToDoc(await ref.get());
  if (!doc) {
    throw new Error("NOT_FOUND");
  }
  const propertyId = String(doc.property_id || "");
  if (!propertyId) {
    throw new Error("NOT_FOUND");
  }
  const access = await requirePropertyAccess(appProfileId, propertyId, "view");
  const property = access.property;
  const snap =
    doc.snapshot_json && typeof doc.snapshot_json === "object" ?
      (doc.snapshot_json as Record<string, unknown>) :
      {};

  let tenantName = "Renter";
  try {
    const profile = await getAppProfile(appProfileId);
    const name = profile && typeof profile.name === "string" ?
      profile.name.trim() :
      "";
    if (name) tenantName = name;
  } catch {
    // ignore
  }

  const propSnap =
    snap.property && typeof snap.property === "object" ?
      (snap.property as Record<string, unknown>) :
      {};
  const insp =
    snap.inspection && typeof snap.inspection === "object" ?
      (snap.inspection as Record<string, unknown>) :
      {};
  const countsRaw =
    snap.counts && typeof snap.counts === "object" ?
      (snap.counts as Record<string, number>) :
      {};
  const counts = {
    spaces_count: Number(countsRaw.spaces_count || 0),
    photos_count: Number(
      countsRaw.photos_count || countsRaw.total_photos_count || 0
    ),
    notes_count: Number(countsRaw.notes_count || 0),
  };
  const spacesData =
    snap.spaces_data && typeof snap.spaces_data === "object" ?
      (snap.spaces_data as SpacesData) :
      {};
  const spacesCovered = Array.isArray(snap.spaces_covered) ?
    snap.spaces_covered.map(String) :
    Object.keys(spacesData);

  const spaceNameById = await loadSpaceNames(propertyId, spacesCovered);
  const orderedPhotoIds: string[] = [];
  const seen = new Set<string>();
  for (const spaceId of spacesCovered) {
    const entry = spacesData[spaceId];
    for (const pid of entry?.photo_ids || []) {
      const id = String(pid);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      orderedPhotoIds.push(id);
    }
  }
  if (Array.isArray(snap.photo_ids)) {
    for (const pid of snap.photo_ids) {
      const id = String(pid);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      orderedPhotoIds.push(id);
    }
  }
  const truncated = orderedPhotoIds.length > MAX_PHOTOS;
  const limitedIds = orderedPhotoIds.slice(0, MAX_PHOTOS);
  const jpegByPhotoId = await loadPhotoJpegs(limitedIds);

  const spaces: ReportPdfSpaceSection[] = [];
  let used = 0;
  for (const spaceId of spacesCovered) {
    const entry = spacesData[spaceId] || {};
    const photos: ReportPdfPhoto[] = [];
    for (const pid of entry.photo_ids || []) {
      if (used >= MAX_PHOTOS) break;
      const id = String(pid);
      const jpeg = jpegByPhotoId.get(id);
      if (!jpeg) continue;
      photos.push({photoId: id, jpeg});
      used += 1;
    }
    spaces.push({
      spaceId,
      displayName: spaceNameById.get(spaceId) || spaceId,
      notes: entry.notes,
      photos,
      comparisonNotes: entry.comparison_notes,
    });
  }

  // Orphan overview photos not tied to a space in spaces_data
  const assigned = new Set(
    spaces.flatMap((s) => s.photos.map((p) => p.photoId))
  );
  const orphanPhotos: ReportPdfPhoto[] = [];
  for (const id of limitedIds) {
    if (assigned.has(id)) continue;
    if (used >= MAX_PHOTOS) break;
    const jpeg = jpegByPhotoId.get(id);
    if (!jpeg) continue;
    orphanPhotos.push({photoId: id, jpeg});
    used += 1;
  }
  if (orphanPhotos.length > 0) {
    spaces.push({
      spaceId: "_overview",
      displayName: "Overview / unassigned photos",
      photos: orphanPhotos,
    });
  }

  const address =
    String(propSnap.address || property.address_free_text || "").trim() ||
    "—";
  const nickname =
    String(propSnap.nickname || property.nickname || "").trim() || undefined;
  const typeLabel =
    String(insp.type_label || insp.type || doc.report_type || "Report").trim();
  const disclaimer = String(
    snap.disclaimer ||
      "This is a user-created documentation record and does not constitute " +
      "legal advice, a professional property inspection, or a guarantee of " +
      "legal admissibility."
  );

  const ctx: ReportPdfContext = {
    title: `${typeLabel} — ${nickname || address}`,
    reportTypeLabel: typeLabel,
    tenantName,
    address,
    nickname,
    generatedAt: new Date().toISOString(),
    summaryNotes:
      typeof snap.user_summary_notes === "string" ?
        snap.user_summary_notes :
        undefined,
    counts,
    baselineInspectionId:
      snap.baseline_inspection_id != null ?
        String(snap.baseline_inspection_id) :
        null,
    spaces,
    disclaimer,
    photosTruncated: truncated,
    photoLimit: MAX_PHOTOS,
  };

  let pdfBuffer: Buffer;
  let usedVersion = HTML_TEMPLATE_VERSION;
  try {
    pdfBuffer = await buildReportPdfHtml(ctx);
  } catch (htmlErr) {
    console.error(
      "[renderReportPdf] HTML template_v4 failed, falling back to pdfkit:",
      htmlErr
    );
    pdfBuffer = await buildReportPdf(ctx);
    usedVersion = TEMPLATE_VERSION;
  }
  const fileId = await uploadBinary(
    appProfileId,
    pdfBuffer,
    `report-${reportId}.pdf`,
    "application/pdf"
  );

  const ts = nowIso();
  await ref.update({
    pdf_file: fileId,
    pdf_template_version: usedVersion,
    date_updated: ts,
  });
  const updated = snapToDoc(await ref.get());
  if (!updated) {
    throw new Error("UPDATE: update report pdf failed");
  }
  return mapReportToClient(updated);
}

/**
 * @param {string} propertyId Property id.
 * @param {string[]} spaceIds Space ids.
 * @return {Promise<Map<string, string>>} id → display_name.
 */
async function loadSpaceNames(
  propertyId: string,
  spaceIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(spaceIds.filter(Boolean)));
  await Promise.all(
    unique.map(async (id) => {
      const snap = await db().collection("spaces").doc(id).get();
      const doc = snapToDoc(snap);
      if (!doc) return;
      if (String(doc.property_id || "") !== propertyId) return;
      const name = String(doc.display_name || id).trim();
      map.set(id, name || id);
    })
  );
  return map;
}

/**
 * @param {string[]} photoIds Photo document ids.
 * @return {Promise<Map<string, Buffer>>} photoId → jpeg buffer.
 */
async function loadPhotoJpegs(
  photoIds: string[]
): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  for (const photoId of photoIds) {
    try {
      const photo = await fetchPhotoById(photoId);
      const fileId = photo?.file ? String(photo.file) : "";
      if (!fileId) continue;
      const downloaded = await downloadByFileId(fileId, "display");
      if (!downloaded?.buffer?.length) continue;
      const jpeg = await sharp(downloaded.buffer)
        .rotate()
        .resize({
          width: MAX_IMAGE_EDGE,
          height: MAX_IMAGE_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({quality: 75})
        .toBuffer();
      out.set(photoId, jpeg);
    } catch (err) {
      console.warn("[renderReportPdf] photo skip:", photoId, err);
    }
  }
  return out;
}
