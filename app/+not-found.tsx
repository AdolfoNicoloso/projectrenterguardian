import { Link, Redirect, Stack, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

function isPackagerDeepLinkPath(pathname: string): boolean {
  return /127\.0\.0\.1|localhost|:\d{4}\b|expo-development-client|\/--\//i.test(
    pathname
  );
}

/**
 * Dev-client / Metro sometimes opens the app with a URL like
 * renterguardian://127.0.0.1:8081/--/127.0.0.1:8081/-- which Expo Router
 * treats as a real route and shows Unmatched. Bounce those back home.
 */
export default function NotFoundScreen() {
  const pathname = usePathname();

  if (isPackagerDeepLinkPath(pathname || '')) {
    return <Redirect href="/" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Page not found</Text>
        <Link href="/" style={styles.link}>
          Go home
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#000',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  link: {
    color: '#9ca3af',
    fontSize: 16,
  },
});
