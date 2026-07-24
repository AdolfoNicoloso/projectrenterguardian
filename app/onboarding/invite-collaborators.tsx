/**
 * Onboarding create: after property is created, optionally invite collaborators.
 */

import React, { useCallback, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { InviteCollaboratorsStep } from '../../src/screens/InviteCollaboratorsStep';

export default function OnboardingInviteCollaboratorsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    propertyId?: string;
    status?: string;
  }>();

  const propertyId =
    typeof params.propertyId === 'string' ? params.propertyId.trim() : '';
  const isTouring = params.status === 'touring';

  const finish = useCallback(() => {
    if (!propertyId) {
      router.replace(isTouring ? '/(tabs)/tours' : '/(tabs)/rents');
      return;
    }
    if (isTouring) {
      router.replace(`/onboarding/tour-ready?propertyId=${propertyId}`);
    } else {
      router.replace(`/onboarding/inspection-ready?propertyId=${propertyId}`);
    }
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
    />
  );
}
