import { Stack } from 'expo-router';

/**
 * Ensure the Inspections tab always mounts on the list (index),
 * not a nested screen like "new" or "[id]".
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function InspectionsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="index"
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
