import { Stack } from 'expo-router';

export default function PropertiesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="index"
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="tours-calendar" />
      <Stack.Screen name="status-intent" />
      <Stack.Screen name="property-info" />
      <Stack.Screen name="property-link" />
      <Stack.Screen name="tour-schedule" />
      <Stack.Screen name="lease-info" />
      <Stack.Screen name="nickname" />
      <Stack.Screen name="invite-collaborators" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}

