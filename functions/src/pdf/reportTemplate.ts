/**
 * Versioned report PDF layout (pdfkit). Fills from immutable snapshot context.
 */

import PDFDocument from "pdfkit";

export const TEMPLATE_VERSION = "1";

export type ReportPdfPhoto = {
  photoId: string;
  jpeg: Buffer;
  caption?: string;
};

export type ReportPdfSpaceSection = {
  spaceId: string;
  displayName: string;
  notes?: string;
  photos: ReportPdfPhoto[];
  comparisonNotes?: Array<{note?: string; created_at?: string}>;
};

export type ReportPdfContext = {
  title: string;
  reportTypeLabel: string;
  tenantName: string;
  address: string;
  nickname?: string;
  generatedAt: string;
  summaryNotes?: string;
  counts?: {
    spaces_count?: number;
    photos_count?: number;
    notes_count?: number;
  };
  baselineInspectionId?: string | null;
  spaces: ReportPdfSpaceSection[];
  disclaimer: string;
  photosTruncated: boolean;
  photoLimit: number;
};

const MARGIN = 48;
const PAGE_WIDTH = 612;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * Build a PDF buffer from report context.
 * @param {ReportPdfContext} ctx Filled template context.
 * @return {Promise<Buffer>} PDF bytes.
 */
export function buildReportPdf(ctx: ReportPdfContext): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      bufferPages: true,
      margins: {top: MARGIN, bottom: MARGIN + 24, left: MARGIN, right: MARGIN},
      info: {
        Title: ctx.title,
        Author: "Renter Guardian",
        Subject: "User documentation report",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Cover
    doc.fontSize(20).fillColor("#111111").text(ctx.title, {align: "left"});
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#333333");
    doc.text(`Type: ${ctx.reportTypeLabel}`);
    if (ctx.nickname) doc.text(`Property: ${ctx.nickname}`);
    doc.text(`Address: ${ctx.address || "—"}`);
    doc.text(`Tenant: ${ctx.tenantName}`);
    doc.text(`Generated: ${ctx.generatedAt}`);
    if (ctx.baselineInspectionId) {
      doc.text(`Baseline inspection: ${ctx.baselineInspectionId}`);
    }
    doc.moveDown();

    // Summary
    doc.fontSize(14).fillColor("#111111").text("Summary");
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#333333");
    const counts = ctx.counts || {};
    doc.text(`Spaces covered: ${Number(counts.spaces_count || 0)}`);
    doc.text(`Photos: ${Number(counts.photos_count || 0)}`);
    doc.text(`Notes: ${Number(counts.notes_count || 0)}`);
    if (ctx.photosTruncated) {
      doc.fillColor("#884400").text(
        `Note: PDF includes at most ${ctx.photoLimit} photos ` +
          "(remaining photos stay in the in-app report)."
      );
      doc.fillColor("#333333");
    }
    if (ctx.summaryNotes && String(ctx.summaryNotes).trim()) {
      doc.moveDown(0.4);
      doc.fontSize(11).fillColor("#111111").text("Your notes");
      doc.fontSize(10).fillColor("#333333").text(String(ctx.summaryNotes));
    }
    doc.moveDown();

    // Spaces
    for (const space of ctx.spaces) {
      const needed = 80 + (space.photos.length > 0 ? 200 : 0);
      if (doc.y > doc.page.height - MARGIN - needed) {
        doc.addPage();
      }
      doc.fontSize(13).fillColor("#111111").text(space.displayName);
      doc.moveDown(0.25);
      if (space.notes && String(space.notes).trim()) {
        doc.fontSize(10).fillColor("#333333").text(String(space.notes));
        doc.moveDown(0.25);
      }
      if (space.comparisonNotes && space.comparisonNotes.length > 0) {
        doc.fontSize(10).fillColor("#111111").text("Comparison notes");
        doc.fontSize(9).fillColor("#444444");
        for (const n of space.comparisonNotes) {
          const when = n.created_at ? ` (${n.created_at})` : "";
          doc.text(`• ${String(n.note || "").trim()}${when}`);
        }
        doc.moveDown(0.25);
      }
      for (const photo of space.photos) {
        try {
          const maxW = CONTENT_WIDTH;
          const maxH = 220;
          if (doc.y + maxH > doc.page.height - MARGIN - 40) {
            doc.addPage();
          }
          doc.image(photo.jpeg, {
            fit: [maxW, maxH],
            align: "center",
          });
          if (photo.caption) {
            doc.fontSize(8).fillColor("#666666").text(photo.caption, {
              align: "center",
            });
          }
          doc.moveDown(0.5);
        } catch (err) {
          console.warn("[reportTemplate] skip image:", photo.photoId, err);
        }
      }
      doc.moveDown(0.5);
    }

    // Disclaimer
    if (doc.y > doc.page.height - MARGIN - 100) {
      doc.addPage();
    }
    doc.fontSize(12).fillColor("#111111").text("Disclaimer");
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#555555").text(ctx.disclaimer, {
      align: "left",
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.save();
      doc.fontSize(8).fillColor("#666666");
      doc.text(
        `Template v${TEMPLATE_VERSION} · User documentation — not legal advice`,
        MARGIN,
        doc.page.height - 32,
        {
          width: CONTENT_WIDTH,
          align: "center",
          lineBreak: false,
        }
      );
      doc.restore();
    }

    doc.end();
  });
}
