/**
 * Mid-app create: after property is created, optionally invite collaborators.
 */

import React, { useCallback, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { InviteCollaboratorsStep } from '../../../src/screens/InviteCollaboratorsStep';
import { Routes } from '../../../src/navigation/routes';

export default function InviteCollaboratorsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    propertyId?: string;
    status?: string;
  }>();

  const propertyId =
    typeof params.propertyId === 'string' ? params.propertyId.trim() : '';
  const isTouring = params.status === 'touring';

  const finish = useCallback(() => {
    const hub = isTouring ? Routes.TOURS.LIST : Routes.RENTS.LIST;
    if (!propertyId) {
      router.replace(hub);
      return;
    }
    // Reset to hub, then open detail so Back skips invite/create steps.
    router.replace(hub);
    router.push(Routes.PROPERTIES.DETAIL(propertyId) as never);
  }, [isTouring, propertyId, router]);

  useEffect(() => {
    if (!propertyId) finish();
  }, [propertyId, finish]);

  if (!propertyId) {
    return null;
  }

  return (
    <InviteCollaboratorsStep
      propertyId={propertyId}
      isTouring={isTouring}
      onContinue={finish}
      showHeader
    />
  );
}
