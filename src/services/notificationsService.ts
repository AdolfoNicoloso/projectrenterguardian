/**
 * In-app notifications — list, mark read (via Cloud Functions only).
 */

import { backendClient } from './backendClient';
import type { AppNotification } from '../types';

export type NotificationsListPayload = {
  notifications: AppNotification[];
  unread_count: number;
};

export const notificationsService = {
  async list(limit = 50): Promise<NotificationsListPayload> {
    const response = await backendClient.call<{ data: NotificationsListPayload }>(
      `listMyNotifications?limit=${encodeURIComponent(String(limit))}`,
      { method: 'GET' }
    );
    return response.data;
  },

  async markRead(notificationId: string): Promise<AppNotification> {
    const response = await backendClient.call<{ data: AppNotification }>(
      'markNotificationRead',
      {
        method: 'POST',
        body: JSON.stringify({ notificationId }),
      }
    );
    return response.data;
  },

  async markAllRead(): Promise<number> {
    const response = await backendClient.call<{ data: { marked: number } }>(
      'markNotificationRead',
      {
        method: 'POST',
        body: JSON.stringify({ all: true }),
      }
    );
    return response.data?.marked ?? 0;
  },
};
