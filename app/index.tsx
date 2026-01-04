import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/state/authStore';
import { resolvePostAuthRoute } from '../src/utils/routingResolver';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Use routing resolver to determine correct screen (handles onboarding)
      resolvePostAuthRoute();
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return null; // Or a loading screen
  }

  if (isAuthenticated) {
    // Return null while routing resolver handles navigation
    return null;
  }

  return <Redirect href="/welcome" />;
}


