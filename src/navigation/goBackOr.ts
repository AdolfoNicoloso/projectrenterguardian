import type { Router } from 'expo-router';
import { Routes } from './routes';

type Href = string;

type NavState = {
  index: number;
  routes: Array<{ name: string }>;
};

/**
 * Prefer stack back; otherwise replace to a fallback so we don't invent history.
 */
export function goBackOr(
  router: Pick<Router, 'canGoBack' | 'back' | 'replace'>,
  fallbackHref: Href
): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallbackHref as never);
}

/**
 * Back from a properties-stack screen, skipping the legacy index redirect stub.
 * When the previous route is `index` (Redirect → Rents), go to the status hub instead.
 */
export function goBackSkippingPropertiesIndex(
  router: Pick<Router, 'canGoBack' | 'back' | 'replace'>,
  navigation: { getState: () => NavState | undefined },
  fallbackHref: Href
): void {
  const state = navigation.getState();
  const prev =
    state && state.index > 0 ? state.routes[state.index - 1] : null;
  if (!router.canGoBack() || !prev || prev.name === 'index') {
    router.replace(fallbackHref as never);
    return;
  }
  router.back();
}

/**
 * Hub for a property by status (Tours vs Rents).
 */
export function hubHrefForPropertyStatus(status?: string | null): Href {
  const s = (status || '').toLowerCase();
  if (s === 'touring' || s === 'applied') {
    return Routes.TOURS.LIST;
  }
  return Routes.RENTS.LIST;
}
