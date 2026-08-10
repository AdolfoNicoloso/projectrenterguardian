/**
 * Minimal Handlebars-compatible fill for report HTML templates.
 * Supports {{path}}, {{#if key}}…{{/if}}, {{#each key}}…{{/each}}.
 */

/**
 * @param {unknown} obj Object root.
 * @param {string} path Dot path.
 * @return {unknown} Value or undefined.
 */
function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce((o: unknown, k: string) => {
    if (o == null || typeof o !== "object") return undefined;
    return (o as Record<string, unknown>)[k];
  }, obj);
}

/**
 * @param {unknown} v Value.
 * @return {boolean} Truthy for template #if.
 */
function isTruthy(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== false && v !== "";
}

/**
 * @param {unknown} s Value to escape.
 * @return {string} HTML-escaped text.
 */
function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} template Template source.
 * @param {number} from Search start.
 * @param {string} kind Block kind (if|each).
 * @return {{start: number, end: number}} Body end + close tag end.
 */
function findBlockEnd(
  template: string,
  from: number,
  kind: string
): {start: number; end: number} {
  const openToken = "{{#" + kind;
  const closeToken = "{{/" + kind;
  let depth = 1;
  let pos = from;
  while (pos < template.length && depth > 0) {
    const slice = template.slice(pos);
    const nextOpen = slice.indexOf(openToken);
    const nextClose = slice.indexOf(closeToken);
    if (nextClose === -1) {
      return {start: template.length, end: template.length};
    }
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos += nextOpen + openToken.length;
      continue;
    }
    depth--;
    if (depth === 0) {
      const abs = pos + nextClose;
      return {start: abs, end: template.indexOf("}}", abs) + 2};
    }
    pos += nextClose + closeToken.length;
  }
  return {start: template.length, end: template.length};
}

/**
 * Fill a Handlebars-like template string.
 * @param {string} template Template HTML.
 * @param {unknown} data Context object.
 * @return {string} Rendered HTML.
 */
export function fillHandlebars(template: string, data: unknown): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("{{", i);
    if (open === -1) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const close = template.indexOf("}}", open);
    if (close === -1) {
      out += template.slice(open);
      break;
    }
    const tag = template.slice(open + 2, close).trim();
    i = close + 2;

    if (tag.startsWith("#each ")) {
      const eachKey = tag.slice(6).trim();
      const endEach = findBlockEnd(template, i, "each");
      const eachBody = template.slice(i, endEach.start);
      const arr = getPath(data, eachKey);
      const list = Array.isArray(arr) ? arr : [];
      for (const item of list) {
        out += fillHandlebars(eachBody, item);
      }
      i = endEach.end;
      continue;
    }

    if (tag.startsWith("#if ")) {
      const ifKey = tag.slice(4).trim();
      const endIf = findBlockEnd(template, i, "if");
      const ifBody = template.slice(i, endIf.start);
      if (isTruthy(getPath(data, ifKey))) {
        out += fillHandlebars(ifBody, data);
      }
      i = endIf.end;
      continue;
    }

    if (tag.startsWith("/")) {
      continue;
    }

    out += escapeHtml(getPath(data, tag));
  }
  return out;
}
