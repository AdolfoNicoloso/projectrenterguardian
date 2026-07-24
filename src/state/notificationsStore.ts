/**
 * Client inbox for in-app notifications (invite alerts, tour reminders).
 * Polls Cloud Functions; never reads Firestore directly.
 */

import { create } from 'zustand';
import { notificationsService } from '../services/notificationsService';
import type { AppNotification } from '../types';

const POLL_MS = 45_000;

type NotificationsState = {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  /** Newest unread invite shown as top banner (null when dismissed/none). */
  bannerInviteId: string | null;
  /** Session-only: dismissed banners stay out of the top popup but keep unread badge. */
  dismissedBannerIds: Record<string, true>;
  fetchedAt: number | null;

  fetch: (opts?: { force?: boolean }) => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismissBanner: () => void;
  clear: () => void;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;

function newestUnreadInvite(
  items: AppNotification[],
  dismissed: Record<string, true>
): AppNotification | null {
  return (
    items.find(
      (n) =>
        n.type === 'property_invite' &&
        !n.read_at &&
        !dismissed[n.id] &&
        !!(n.invite_token || n.invite_id)
    ) ?? null
  );
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  error: null,
  bannerInviteId: null,
  dismissedBannerIds: {},
  fetchedAt: null,

  fetch: async (opts) => {
    if (inFlight && !opts?.force) {
      await inFlight;
      return;
    }
    const run = (async () => {
      set({ loading: true, error: null });
      try {
        const data = await notificationsService.list(50);
        const items = data.notifications || [];
        const unreadCount = data.unread_count ?? 0;
        set((state) => {
          const newest = newestUnreadInvite(items, state.dismissedBannerIds);
          const keepCurrent =
            state.bannerInviteId &&
            items.some(
              (n) =>
                n.id === state.bannerInviteId &&
                !n.read_at &&
                n.type === 'property_invite' &&
                !state.dismissedBannerIds[n.id]
            );
          return {
            items,
            unreadCount,
            loading: false,
            fetchedAt: Date.now(),
            bannerInviteId: keepCurrent
              ? state.bannerInviteId
              : newest?.id ?? null,
          };
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Could not load notifications';
        set({ loading: false, error: message });
      } finally {
        inFlight = null;
      }
    })();
    inFlight = run;
    await run;
  },

  markRead: async (notificationId) => {
    const updated = await notificationsService.markRead(notificationId);
    set((state) => {
      const items = state.items.map((n) =>
        n.id === notificationId ? { ...n, ...updated } : n
      );
      const unreadCount = items.filter((n) => !n.read_at).length;
      return {
        items,
        unreadCount,
        bannerInviteId:
          state.bannerInviteId === notificationId ? null : state.bannerInviteId,
      };
    });
  },

  markAllRead: async () => {
    await notificationsService.markAllRead();
    set((state) => ({
      items: state.items.map((n) =>
        n.read_at ? n : { ...n, read_at: new Date().toISOString() }
      ),
      unreadCount: 0,
      bannerInviteId: null,
    }));
  },

  dismissBanner: () => {
    const { bannerInviteId, dismissedBannerIds } = get();
    if (!bannerInviteId) return;
    set({
      bannerInviteId: null,
      dismissedBannerIds: { ...dismissedBannerIds, [bannerInviteId]: true },
    });
  },

  clear: () => {
    set({
      items: [],
      unreadCount: 0,
      loading: false,
      error: null,
      bannerInviteId: null,
      dismissedBannerIds: {},
      fetchedAt: null,
    });
  },
}));

/** Start background polling while authenticated. */
export function startNotificationsPolling(): void {
  const store = useNotificationsStore.getState();
  void store.fetch({ force: true });
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void useNotificationsStore.getState().fetch();
  }, POLL_MS);
}

export function stopNotificationsPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  useNotificationsStore.getState().clear();
}
