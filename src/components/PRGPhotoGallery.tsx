import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import { getAuthenticatedMediaFileUrl } from '../utils/fileUrl';

export type GalleryPhoto = {
  id: string;
  /** Opaque media file id for authenticated resolve (optional if uri set). */
  file?: string;
  /** Pre-resolved display URL (e.g. public share). */
  uri?: string | null;
  /** "Unassigned" or space display name. */
  spaceLabel: string;
  /** Plain notes text to show under the photo (empty/omitted = hide). */
  notesText?: string | null;
};

type PRGPhotoGalleryProps = {
  visible: boolean;
  photos: GalleryPhoto[];
  initialIndex: number;
  onClose: () => void;
  /** Edit/Details for property photo management — always shown top-right when set. */
  onEdit?: (photoId: string) => void;
  /**
   * Lazy-load notes when list payloads omit them (e.g. fields=gallery).
   * Return null/empty when the photo has no notes.
   */
  resolveNotes?: (photoId: string) => Promise<string | null>;
};

/**
 * SharePoint-style full-screen photo gallery: space label, counter, prev/next.
 * Stays in-app on all platforms (no new-tab primary path).
 */
export function PRGPhotoGallery({
  visible,
  photos,
  initialIndex,
  onClose,
  onEdit,
  resolveNotes,
}: PRGPhotoGalleryProps) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [uriById, setUriById] = useState<Record<string, string>>({});
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    const clamped = Math.max(
      0,
      Math.min(initialIndex, Math.max(0, photos.length - 1))
    );
    setIndex(clamped);
  }, [visible, initialIndex, photos.length]);

  const current = photos[index] ?? null;
  const canPrev = index > 0;
  const canNext = index < photos.length - 1;
  const notesText = (
    current?.notesText?.trim() ||
    (current ? notesById[current.id] : '') ||
    ''
  ).trim();
  const hasNotes = notesText.length > 0;

  const loadUri = useCallback(async (photo: GalleryPhoto) => {
    if (photo.uri) {
      setUriById((prev) =>
        prev[photo.id] === photo.uri
          ? prev
          : { ...prev, [photo.id]: photo.uri as string }
      );
      return;
    }
    if (!photo.file) return;
    try {
      const url = await getAuthenticatedMediaFileUrl(photo.file, 'display');
      setUriById((prev) =>
        prev[photo.id] === url ? prev : { ...prev, [photo.id]: url }
      );
    } catch {
      try {
        const url = await getAuthenticatedMediaFileUrl(photo.file, 'thumb');
        setUriById((prev) =>
          prev[photo.id] === url ? prev : { ...prev, [photo.id]: url }
        );
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Load current + neighbors
  useEffect(() => {
    if (!visible || photos.length === 0) return;
    const targets = [index - 1, index, index + 1]
      .filter((i) => i >= 0 && i < photos.length)
      .map((i) => photos[i]);
    for (const p of targets) {
      if (p && !uriById[p.id]) void loadUri(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when index/visibility/photos change
  }, [visible, index, photos, loadUri]);

  // Lazy notes for lean gallery list payloads
  useEffect(() => {
    if (!visible || !resolveNotes || !current) return;
    if (current.notesText?.trim()) return;
    if (notesById[current.id] !== undefined) return;
    let cancelled = false;
    void resolveNotes(current.id)
      .then((text) => {
        if (cancelled) return;
        setNotesById((prev) => ({
          ...prev,
          [current.id]: (text || '').trim(),
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setNotesById((prev) => ({ ...prev, [current.id]: '' }));
      });
    return () => {
      cancelled = true;
    };
  }, [visible, current, resolveNotes, notesById]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => (i < photos.length - 1 ? i + 1 : i));
  }, [photos.length]);

  // Web keyboard
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose, goPrev, goNext]);

  const uri = current ? uriById[current.id] ?? null : null;
  const counter =
    photos.length > 0 ? `${index + 1} of ${photos.length}` : '';

  const imageMaxWidth = Math.min(width * 0.78, 960);
  const imageMaxHeight = hasNotes ? height * 0.52 : height * 0.72;
  const notesMaxHeight = Math.min(height * 0.22, 160);

  return (
    <Modal
      visible={visible && photos.length > 0}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.94)' }]}>
        <View style={styles.toolbar} pointerEvents="box-none">
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close gallery"
            style={styles.toolbarSide}
          >
            <Text style={[styles.toolbarBtn, { color: colors.onPrimary }]}>
              Close
            </Text>
          </Pressable>

          <View style={styles.toolbarCenter} pointerEvents="none">
            <Text
              style={[styles.spaceLabel, { color: colors.onPrimary }]}
              numberOfLines={1}
            >
              {current?.spaceLabel || 'Unassigned'}
            </Text>
          </View>

          <View style={[styles.toolbarSide, styles.toolbarSideRight]}>
            {onEdit && current ? (
              <Pressable
                onPress={() => onEdit(current.id)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Edit photo details"
              >
                <Text style={[styles.toolbarBtn, { color: colors.onPrimary }]}>
                  Edit
                </Text>
              </Pressable>
            ) : (
              <View style={styles.toolbarSide} />
            )}
          </View>
        </View>

        {counter ? (
          <Text
            style={[styles.counterBelow, { color: 'rgba(255,255,255,0.65)' }]}
            pointerEvents="none"
          >
            {counter}
          </Text>
        ) : null}

        <View style={styles.stage}>
          <Pressable
            onPress={canPrev ? goPrev : undefined}
            disabled={!canPrev}
            accessibilityRole="button"
            accessibilityLabel="Previous photo"
            style={[
              styles.arrowHit,
              styles.arrowLeft,
              !canPrev && styles.arrowDisabled,
              Platform.OS === 'web'
                ? ({ cursor: canPrev ? 'pointer' : 'default' } as object)
                : null,
            ]}
          >
            <Text
              style={[
                styles.arrowGlyph,
                { color: canPrev ? colors.onPrimary : 'rgba(255,255,255,0.25)' },
              ]}
            >
              ‹
            </Text>
          </Pressable>

          <View style={styles.stageCenter}>
            <View
              style={[
                styles.imageWrap,
                {
                  width: imageMaxWidth,
                  height: imageMaxHeight,
                },
              ]}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  recyclingKey={current?.id}
                  accessibilityLabel={current?.spaceLabel || 'Photo'}
                />
              ) : (
                <Text style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</Text>
              )}
            </View>

            {hasNotes ? (
              <View
                style={[
                  styles.notesWrap,
                  {
                    width: imageMaxWidth,
                    maxHeight: notesMaxHeight,
                  },
                ]}
              >
                <Text
                  style={[styles.notesHeading, { color: 'rgba(255,255,255,0.7)' }]}
                >
                  Notes
                </Text>
                <ScrollView
                  style={{ maxHeight: notesMaxHeight - 28 }}
                  contentContainerStyle={styles.notesScrollContent}
                  showsVerticalScrollIndicator
                >
                  <Text
                    style={[styles.notesBody, { color: colors.onPrimary }]}
                  >
                    {notesText}
                  </Text>
                </ScrollView>
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={canNext ? goNext : undefined}
            disabled={!canNext}
            accessibilityRole="button"
            accessibilityLabel="Next photo"
            style={[
              styles.arrowHit,
              styles.arrowRight,
              !canNext && styles.arrowDisabled,
              Platform.OS === 'web'
                ? ({ cursor: canNext ? 'pointer' : 'default' } as object)
                : null,
            ]}
          >
            <Text
              style={[
                styles.arrowGlyph,
                { color: canNext ? colors.onPrimary : 'rgba(255,255,255,0.25)' },
              ]}
            >
              ›
            </Text>
          </Pressable>
        </View>
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
    left: spacing.md,
    right: spacing.md,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarSide: {
    minWidth: 72,
    flexShrink: 0,
  },
  toolbarSideRight: {
    alignItems: 'flex-end',
  },
  toolbarCenter: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  toolbarBtn: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.semibold,
    paddingVertical: spacing.sm,
  },
  spaceLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  counterBelow: {
    position: 'absolute',
    top: spacing.xl + 36,
    alignSelf: 'center',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    zIndex: 2,
  },
  stage: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  stageCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesWrap: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  notesHeading: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  notesScrollContent: {
    paddingBottom: spacing.xs,
  },
  notesBody: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
  },
  arrowHit: {
    width: 52,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  arrowLeft: {
    marginRight: spacing.xs,
  },
  arrowRight: {
    marginLeft: spacing.xs,
  },
  arrowDisabled: {
    opacity: 0.9,
  },
  arrowGlyph: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '300',
  },
});
