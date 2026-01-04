import { router } from 'expo-router';
import { appProfileService } from '../services/appProfileService';
import { userPreferencesService } from '../services/userPreferencesService';

/**
 * Routing resolver for post-authentication navigation.
 * Determines the correct screen to navigate to based on onboarding status.
 * 
 * Routing logic:
 * 1. Fetch app_profile and user_preferences
 * 2. If onboarding_completed !== true:
 *    - If name is missing/empty → OnboardingNameScreen
 *    - Else if preferred_language missing → OnboardingLanguageScreen
 *    - Else → CreateFirstPropertyScreen
 * 3. Else → HomeScreen (Properties)
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

    // Fetch app_profile and user_preferences in parallel
    const [appProfile, userPreferences] = await Promise.all([
      appProfileService.getAppProfile().catch(() => null),
      userPreferencesService.getUserPreferences().catch(() => null),
    ]);

    // Check onboarding completion status
    const onboardingCompleted = appProfile?.onboarding_completed === true;

    if (!onboardingCompleted) {
      // Onboarding flow
      const name = appProfile?.name;
      const preferredLanguage = userPreferences?.preferred_language;

      if (!name || name.trim() === '') {
        // Missing name → go to name screen
        router.replace('/onboarding/name');
        return;
      }

      if (!preferredLanguage) {
        // Missing language → go to language screen
        router.replace('/onboarding/language');
        return;
      }

      // Name and language set → go to property info screen
      router.replace('/onboarding/property-info');
      return;
    }

    // Onboarding completed → go to home (properties)
    router.replace('/(tabs)/properties');
  } catch (error) {
    console.error('Error resolving post-auth route:', error);
    // On error, default to properties screen (safe fallback)
    router.replace('/(tabs)/properties');
  }
}


