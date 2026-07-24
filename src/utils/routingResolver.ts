import { router } from 'expo-router';
import { appProfileService } from '../services/appProfileService';

/**
 * Routing resolver for post-authentication navigation.
 * Determines the correct screen to navigate to based on onboarding status.
 *
 * Routing logic:
 * 1. Fetch app_profile
 * 2. If onboarding_completed !== true:
 *    - If name is missing/empty → OnboardingNameScreen
 *    - Else → Intent → property create (touring or renting)
 *    (Preferred language step is temporarily disabled.)
 * 3. Else → Rents hub (Tours is a sibling tab)
 */
export async function resolvePostAuthRoute(): Promise<void> {
  try {
    // Ensure profile exists first (bootstrap if needed)
    try {
      const { backendClient } = await import('../services/backendClient');
      await backendClient.bootstrapProfile();
    } catch (bootstrapError) {
      console.error('Failed to bootstrap profile:', bootstrapError);
      // Continue anyway - updateAppProfile will create it if needed
    }

    const appProfile = await appProfileService.getAppProfile().catch(() => null);

    // Check onboarding completion status
    const onboardingCompleted = appProfile?.onboarding_completed === true;

    if (!onboardingCompleted) {
      const name = appProfile?.name;

      if (!name || name.trim() === '') {
        router.replace('/onboarding/name');
        return;
      }

      // Name set → choose touring vs already renting (language skipped for now)
      router.replace('/onboarding/intent');
      return;
    }

    // Onboarding completed → Rents hub (Tours is a sibling tab)
    router.replace('/(tabs)/rents');
  } catch (error) {
    console.error('Error resolving post-auth route:', error);
    // On error, default to Rents (safe fallback)
    router.replace('/(tabs)/rents');
  }
}
