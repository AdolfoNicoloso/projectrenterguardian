import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { usePropertiesStore } from '../state/propertiesStore';
import type { Property } from '../types';

type SoftLoadResult<T> = {
  data: T;
  /** True only when there is nothing cached to show yet. */
  isInitialLoading: boolean;
  /** True while a background revalidate is in flight. */
  isRefreshing: boolean;
  error: string | null;
  revalidate: (force?: boolean) => Promise<void>;
};

/**
 * Stale-while-revalidate for the properties list.
 * Shows cached data immediately; quiet refresh on focus.
 *
 * Important: never select `getList()` directly — it allocates a new array each
 * call and breaks useSyncExternalStore snapshot stability (infinite re-renders).
 */
export function usePropertiesList(): SoftLoadResult<Property[]> {
  const listIds = usePropertiesStore((s) => s.listIds);
  const byId = usePropertiesStore((s) => s.byId);
  const listError = usePropertiesStore((s) => s.listError);
  const properties = useMemo(
    () => listIds.map((id) => byId[id]).filter(Boolean) as Property[],
    [listIds, byId]
  );

  const [isInitialLoading, setIsInitialLoading] = useState(listIds.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const revalidateRef = useRef<(force?: boolean) => Promise<void>>(async () => {});

  revalidateRef.current = async (force = false) => {
    const hasCache = usePropertiesStore.getState().listIds.length > 0;
    if (!hasCache) setIsInitialLoading(true);
    else setIsRefreshing(true);
    try {
      await usePropertiesStore.getState().fetchList({ force });
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  const revalidate = useCallback(async (force = false) => {
    await revalidateRef.current(force);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void revalidate(false);
    }, [revalidate])
  );

  return {
    data: properties,
    isInitialLoading: isInitialLoading && properties.length === 0,
    isRefreshing,
    error: listError,
    revalidate,
  };
}

/**
 * Stale-while-revalidate for a single property.
 * Seeds from list/detail cache; never blanks the UI when cache exists.
 */
export function useProperty(id: string | undefined): SoftLoadResult<Property | null> {
  const property = usePropertiesStore((s) => (id ? s.byId[id] : undefined));
  const [isInitialLoading, setIsInitialLoading] = useState(!property && !!id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revalidateRef = useRef<(force?: boolean) => Promise<void>>(async () => {});

  revalidateRef.current = async (force = false) => {
    if (!id) return;
    const cached = usePropertiesStore.getState().byId[id];
    if (!cached) setIsInitialLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      await usePropertiesStore.getState().fetchOne(id, { force });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load property');
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  const revalidate = useCallback(async (force = false) => {
    await revalidateRef.current(force);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void revalidate(false);
    }, [id, revalidate])
  );

  return {
    data: property ?? null,
    isInitialLoading: isInitialLoading && !property,
    isRefreshing,
    error,
    revalidate,
  };
}
