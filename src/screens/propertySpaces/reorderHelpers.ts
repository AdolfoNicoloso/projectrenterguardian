export type CardLayout = { x: number; y: number; width: number; height: number };

export const AUTO_SCROLL_EDGE = 72;
export const AUTO_SCROLL_STEP = 14;

export function reorderList<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Exact hit-test only (no nearest fallback). */
export function hitIndexFromContentPoint(
  localX: number,
  localY: number,
  layouts: Record<number, CardLayout>,
  count: number
): number | null {
  for (let i = 0; i < count; i++) {
    const L = layouts[i];
    if (!L) continue;
    if (
      localX >= L.x &&
      localX <= L.x + L.width &&
      localY >= L.y &&
      localY <= L.y + L.height
    ) {
      return i;
    }
  }
  return null;
}

/** Hit-test pointer (content coords) against card layouts; nearest center as fallback. */
export function indexFromContentPoint(
  localX: number,
  localY: number,
  layouts: Record<number, CardLayout>,
  count: number,
  fallback: number
): number {
  if (count <= 0) return fallback;
  const hit = hitIndexFromContentPoint(localX, localY, layouts, count);
  if (hit != null) return hit;

  let best = fallback;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const L = layouts[i];
    if (!L) continue;
    const cx = L.x + L.width / 2;
    const cy = L.y + L.height / 2;
    const dist = (localX - cx) ** 2 + (localY - cy) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}
