import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';

type PRGImageLightboxProps = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  /** Optional caption under the image. */
  title?: string;
};

/**
 * Open an image with the platform’s native viewer when possible:
 * - Web: new browser tab (pinch / Ctrl+scroll zoom)
 * - Native: system browser / image handler
 *
 * Call from a user gesture (tap) so popup blockers allow a new tab.
 */
export function openNativeImageViewer(uri: string): void {
  if (!uri) return;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(uri, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(uri);
}

/**
 * Prefer native zoom surfaces when it can run synchronously under a tap:
 * - Web: new tab (browser zoom)
 * - Android: system viewer
 * iOS returns false so callers show the in-app pinch-zoom lightbox.
 */
export function openImageWithNativeZoom(uri: string): boolean {
  if (!uri) return false;
  if (Platform.OS === 'web' || Platform.OS === 'android') {
    openNativeImageViewer(uri);
    return true;
  }
  return false;
}

/**
 * Full-screen image viewer.
 * - iOS: ScrollView pinch-zoom
 * - Web: preview + tap/open-in-new-tab for browser zoom (must stay gesture-driven)
 * - Android: hands off to the system viewer
 */
export function PRGImageLightbox({
  visible,
  uri,
  onClose,
  title,
}: PRGImageLightboxProps) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const androidHandedOffRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      androidHandedOffRef.current = false;
      scrollRef.current?.scrollTo?.({ x: 0, y: 0, animated: false });
    }
  }, [visible]);

  // Android: system viewer (Linking) — no in-app pinch support.
  useEffect(() => {
    if (!visible || !uri || Platform.OS !== 'android') return;
    if (androidHandedOffRef.current) return;
    androidHandedOffRef.current = true;
    openNativeImageViewer(uri);
    onClose();
  }, [visible, uri, onClose]);

  if (Platform.OS === 'android') {
    return null;
  }

  return (
    <Modal
      visible={visible && !!uri}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.94)' }]}>
        <View style={styles.toolbar}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close image"
          >
            <Text style={[styles.toolbarBtn, { color: colors.onPrimary }]}>
              Close
            </Text>
          </Pressable>
          {uri ? (
            <Pressable
              onPress={() => openNativeImageViewer(uri)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={
                Platform.OS === 'web'
                  ? 'Open in new tab to zoom'
                  : 'Open full size'
              }
            >
              <Text style={[styles.toolbarBtn, { color: colors.onPrimary }]}>
                {Platform.OS === 'web' ? 'Open in new tab' : 'Open full size'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {title ? (
          <Text style={[styles.title, { color: colors.onPrimary }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}

        {uri ? (
          Platform.OS === 'web' ? (
            <View style={styles.webStage}>
              <Pressable onPress={onClose} style={StyleSheet.absoluteFillObject} />
              <Pressable
                onPress={() => openNativeImageViewer(uri)}
                accessibilityRole="imagebutton"
                accessibilityLabel="Open photo in new tab to zoom"
              >
                <Image
                  source={{ uri }}
                  style={{
                    width: Math.min(width * 0.92, 960),
                    height: height * 0.72,
                  }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </Pressable>
              <Text style={[styles.hint, { color: 'rgba(255,255,255,0.7)' }]}>
                Tap image or “Open in new tab” · pinch or Ctrl+scroll to zoom there
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                { minWidth: width, minHeight: height * 0.75 },
              ]}
              maximumZoomScale={5}
              minimumZoomScale={1}
              centerContent
              bouncesZoom
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri }}
                style={{
                  width: width * 0.92,
                  height: height * 0.72,
                }}
                contentFit="contain"
                cachePolicy="memory-disk"
                accessibilityLabel={title || 'Photo'}
              />
            </ScrollView>
          )
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  toolbar: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolbarBtn: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.semibold,
    paddingVertical: spacing.sm,
  },
  title: {
    position: 'absolute',
    top: spacing.xl * 2.5,
    left: spacing.lg,
    right: spacing.lg,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    zIndex: 2,
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  webStage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  hint: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
  },
});
