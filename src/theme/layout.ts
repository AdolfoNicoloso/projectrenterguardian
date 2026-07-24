/**
 * Layout tokens for responsive web (and future large-screen native).
 * Mobile web keeps phone-first full-bleed; desktop web uses these constraints.
 */

export const layout = {
  /** Width at which web switches to the PC/laptop shell (sidebar + canvas). */
  desktopBreakpoint: 1024,
  /** Persistent left nav width on desktop web. */
  sideNavWidth: 240,
  /** Max width of primary page content inside the desktop canvas. */
  contentMaxWidth: 1120,
  /** Narrow forms / settings columns on desktop. */
  formMaxWidth: 480,
  /** Horizontal gutter inside the desktop content canvas. */
  contentGutter: 32,
} as const;
