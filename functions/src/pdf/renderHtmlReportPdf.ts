/**
 * Render report PDF from HTML template_v4 via headless Chromium.
 */

import * as fs from "fs";
import * as path from "path";
import {launch} from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import {fillHandlebars} from "./fillHandlebars";
import type {ReportPdfContext} from "./reportTemplate";

export const HTML_TEMPLATE_VERSION = "4";

type HtmlPhoto = {photoId: string; src: string; caption?: string};
type HtmlSpace = {
  spaceId: string;
  displayName: string;
  notes?: string;
  comparisonNotes?: Array<{note?: string; created_at?: string}>;
  photos: HtmlPhoto[];
};
type HtmlContext = Omit<ReportPdfContext, "spaces"> & {spaces: HtmlSpace[]};

/**
 * Resolve packaged templates directory (works from lib/pdf or src/pdf).
 * @return {string} Absolute templates dir containing template_v4.*.
 */
function templateDir(): string {
  const candidates = [
    path.join(__dirname, "../../templates"),
    path.join(__dirname, "../../../templates"),
    path.join(process.cwd(), "templates"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "template_v4.html"))) {
      return dir;
    }
  }
  throw new Error("Report HTML template_v4 not found on disk");
}

/**
 * @param {string} filePath Absolute file path.
 * @param {string} mime MIME type.
 * @return {string} data URI.
 */
function fileToDataUri(filePath: string, mime: string): string {
  const buf = fs.readFileSync(filePath);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * Inline local fonts + logo into CSS/HTML for Chromium setContent.
 * @param {string} css Raw CSS.
 * @param {string} html Filled HTML body fragment.
 * @param {string} dir Template directory.
 * @return {string} Full HTML document.
 */
function assembleDocument(css: string, html: string, dir: string): string {
  const regular = fileToDataUri(
    path.join(dir, "fonts/OpenSans-Regular.ttf"),
    "font/ttf"
  );
  const semi = fileToDataUri(
    path.join(dir, "fonts/OpenSans-SemiBold.ttf"),
    "font/ttf"
  );
  const bold = fileToDataUri(
    path.join(dir, "fonts/OpenSans-Bold.ttf"),
    "font/ttf"
  );
  const logo = fileToDataUri(
    path.join(dir, "assets/logo.png"),
    "image/png"
  );

  const nextCss = css
    .replace(
      /url\("fonts\/OpenSans-Regular\.ttf"\)/g,
      `url("${regular}")`
    )
    .replace(
      /url\("fonts\/OpenSans-SemiBold\.ttf"\)/g,
      `url("${semi}")`
    )
    .replace(
      /url\("fonts\/OpenSans-Bold\.ttf"\)/g,
      `url("${bold}")`
    );

  const nextHtml = html.replace(/src="assets\/logo\.png"/g, `src="${logo}"`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>${nextCss}</style>
</head>
<body>${nextHtml}</body>
</html>`;
}

/**
 * Map pdfkit context buffers → HTML data-URI photo srcs + display dates.
 * @param {ReportPdfContext} ctx Pdfkit context.
 * @return {HtmlContext} HTML fill context.
 */
export function toHtmlContext(ctx: ReportPdfContext): HtmlContext {
  const formatWhen = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    try {
      return d.toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  return {
    ...ctx,
    generatedAt: formatWhen(ctx.generatedAt),
    counts: {
      spaces_count: Number(ctx.counts?.spaces_count || 0),
      photos_count: Number(
        ctx.counts?.photos_count ||
          (ctx.counts as {total_photos_count?: number} | undefined)
            ?.total_photos_count ||
          0
      ),
      notes_count: Number(ctx.counts?.notes_count || 0),
    },
    spaces: ctx.spaces.map((space) => ({
      spaceId: space.spaceId,
      displayName: space.displayName,
      notes: space.notes,
      comparisonNotes: (space.comparisonNotes || []).map((n) => ({
        note: n.note,
        created_at: n.created_at ? formatWhen(n.created_at) : n.created_at,
      })),
      photos: space.photos.map((p) => ({
        photoId: p.photoId,
        src: `data:image/jpeg;base64,${p.jpeg.toString("base64")}`,
        caption: p.caption,
      })),
    })),
  };
}

/**
 * Build PDF bytes from HTML template_v4.
 * @param {ReportPdfContext} ctx Report context with JPEG buffers.
 * @return {Promise<Buffer>} PDF bytes.
 */
export async function buildReportPdfHtml(
  ctx: ReportPdfContext
): Promise<Buffer> {
  const dir = templateDir();
  const templateHtml = fs.readFileSync(
    path.join(dir, "template_v4.html"),
    "utf8"
  );
  const templateCss = fs.readFileSync(
    path.join(dir, "template_v4.css"),
    "utf8"
  );
  const htmlCtx = toHtmlContext(ctx);
  const filled = fillHandlebars(templateHtml, htmlCtx);
  const documentHtml = assembleDocument(templateCss, filled, dir);

  const executablePath = await chromium.executablePath();
  const browser = await launch({
    args: chromium.args,
    defaultViewport: {width: 816, height: 1056, deviceScaleFactor: 1},
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(documentHtml, {
      waitUntil: "load",
      timeout: 60000,
    });
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {top: "0", right: "0", bottom: "0", left: "0"},
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
