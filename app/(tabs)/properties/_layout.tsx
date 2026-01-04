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
      <Stack.Screen name="property-info" />
      <Stack.Screen name="lease-info" />
      <Stack.Screen name="nickname" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}

