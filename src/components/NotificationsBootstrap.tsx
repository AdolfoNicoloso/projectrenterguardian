/**
 * Starts notification polling when signed in and renders the invite banner.
 */

import React, { useEffect } from 'react';
import { useAuthStore } from '../state/authStore';
import {
  startNotificationsPolling,
  stopNotificationsPolling,
} from '../state/notificationsStore';
import { InviteNotificationBanner } from './InviteNotificationBanner';

export function NotificationsBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      startNotificationsPolling();
      return () => stopNotificationsPolling();
    }
    stopNotificationsPolling();
    return undefined;
  }, [isAuthenticated, isLoading]);

  return (
    <>
      {children}
      {isAuthenticated ? <InviteNotificationBanner /> : null}
    </>
  );
}
