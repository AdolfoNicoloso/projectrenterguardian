import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="name" />
      <Stack.Screen name="language" />
      <Stack.Screen name="create-property" />
      <Stack.Screen name="property-info" />
      <Stack.Screen name="lease-info" />
      <Stack.Screen name="nickname" />
      <Stack.Screen name="inspection-ready" />
      <Stack.Screen name="guided-inspection-placeholder" />
    </Stack>
  );
}


