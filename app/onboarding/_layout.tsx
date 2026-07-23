import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="name" />
      <Stack.Screen name="language" />
      <Stack.Screen name="intent" />
      <Stack.Screen name="create-property" />
      <Stack.Screen name="property-info" />
      <Stack.Screen name="property-link" />
      <Stack.Screen name="tour-schedule" />
      <Stack.Screen name="nickname" />
      <Stack.Screen name="tour-ready" />
      <Stack.Screen name="inspection-ready" />
      <Stack.Screen name="move-in-ready" />
      <Stack.Screen name="guided-inspection-placeholder" />
    </Stack>
  );
}
