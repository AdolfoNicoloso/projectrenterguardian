import { create } from 'zustand';
import { propertiesService, type CreatePropertyInput } from '../services/propertiesService';
import type { Property } from '../types';

const LIST_STALE_MS = 30_000;
const DETAIL_STALE_MS = 15_000;

type FetchOpts = { force?: boolean };

type PropertiesState = {
  byId: Record<string, Property>;
  listIds: string[];
  listFetchedAt: number | null;
  detailFetchedAt: Record<string, number>;
  listError: string | null;

  getList: () => Property[];
  getCached: (id: string) => Property | undefined;
  upsert: (property: Property) => void;
  remove: (id: string) => void;
  clear: () => void;

  fetchList: (opts?: FetchOpts) => Promise<Property[]>;
  fetchOne: (id: string, opts?: FetchOpts) => Promise<Property>;
  createProperty: (input: CreatePropertyInput) => Promise<Property>;
  updateProperty: (
    id: string,
    updates: Parameters<typeof propertiesService.updateProperty>[1]
  ) => Promise<Property>;
  deleteProperty: (id: string) => Promise<void>;
};

let listInFlight: Promise<Property[]> | null = null;
const detailInFlight = new Map<string, Promise<Property>>();

function indexProperties(properties: Property[]): {
  byId: Record<string, Property>;
  listIds: string[];
} {
  const byId: Record<string, Property> = {};
  const listIds: string[] = [];
  for (const property of properties) {
    byId[property.id] = property;
    listIds.push(property.id);
  }
  return { byId, listIds };
}

export const usePropertiesStore = create<PropertiesState>((set, get) => ({
  byId: {},
  listIds: [],
  listFetchedAt: null,
  detailFetchedAt: {},
  listError: null,

  getList: () => {
    const { byId, listIds } = get();
    return listIds.map((id) => byId[id]).filter(Boolean);
  },

  getCached: (id) => get().byId[id],

  upsert: (property) => {
    set((state) => {
      const byId = { ...state.byId, [property.id]: property };
      const listIds = state.listIds.includes(property.id)
        ? state.listIds
        : [...state.listIds, property.id];
      return {
        byId,
        listIds,
        detailFetchedAt: {
          ...state.detailFetchedAt,
          [property.id]: Date.now(),
        },
      };
    });
  },

  remove: (id) => {
    set((state) => {
      const byId = { ...state.byId };
      delete byId[id];
      const detailFetchedAt = { ...state.detailFetchedAt };
      delete detailFetchedAt[id];
      return {
        byId,
        listIds: state.listIds.filter((x) => x !== id),
        detailFetchedAt,
      };
    });
  },

  clear: () => {
    listInFlight = null;
    detailInFlight.clear();
    set({
      byId: {},
      listIds: [],
      listFetchedAt: null,
      detailFetchedAt: {},
      listError: null,
    });
  },

  fetchList: async (opts = {}) => {
    const { force = false } = opts;
    const state = get();
    const now = Date.now();
    const isFresh =
      state.listFetchedAt != null && now - state.listFetchedAt < LIST_STALE_MS;

    if (!force && isFresh) {
      return get().getList();
    }

    if (listInFlight) {
      return listInFlight;
    }

    listInFlight = (async () => {
      try {
        const data = await propertiesService.getMyProperties();
        const indexed = indexProperties(data);
        const fetchedAt = Date.now();
        const detailFetchedAt = { ...get().detailFetchedAt };
        for (const id of indexed.listIds) {
          detailFetchedAt[id] = fetchedAt;
        }
        set({
          byId: { ...get().byId, ...indexed.byId },
          listIds: indexed.listIds,
          listFetchedAt: fetchedAt,
          detailFetchedAt,
          listError: null,
        });
        return data;
      } catch (error) {
        set({
          listError:
            error instanceof Error ? error.message : 'Failed to load properties',
        });
        throw error;
      } finally {
        listInFlight = null;
      }
    })();

    return listInFlight;
  },

  fetchOne: async (id, opts = {}) => {
    const { force = false } = opts;
    const cached = get().byId[id];
    const fetchedAt = get().detailFetchedAt[id];
    const isFresh =
      fetchedAt != null && Date.now() - fetchedAt < DETAIL_STALE_MS;

    if (!force && cached && isFresh) {
      return cached;
    }

    const existing = detailInFlight.get(id);
    if (existing) {
      return existing;
    }

    const request = (async () => {
      try {
        const data = await propertiesService.getProperty(id);
        get().upsert(data);
        return data;
      } finally {
        detailInFlight.delete(id);
      }
    })();

    detailInFlight.set(id, request);
    return request;
  },

  createProperty: async (input) => {
    const data = await propertiesService.createProperty(input);
    get().upsert(data);
    // List order may change; mark list stale so next focus refreshes.
    set({ listFetchedAt: null });
    return data;
  },

  updateProperty: async (id, updates) => {
    const data = await propertiesService.updateProperty(id, updates);
    get().upsert(data);
    return data;
  },

  deleteProperty: async (id) => {
    await propertiesService.deleteProperty(id);
    get().remove(id);
  },
}));
