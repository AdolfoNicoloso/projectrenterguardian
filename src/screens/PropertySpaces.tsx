import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  PanResponder,
  Animated,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  PRGEmptyState,
  PRGButton,
  PRGImageLightbox,
  openImageWithNativeZoom,
  useToast,
} from '../components';
import { spacesService } from '../services/spacesService';
import { photosService } from '../services/photosService';
import { getSpaceTypeLabel } from '../constants/spaceTypes';
import { useDesktopLayout } from '../hooks/useDesktopLayout';
import { spacing } from '../theme';
import { useTheme } from '../theme/useTheme';
import type { Photo, Space } from '../types';
import {
  AUTO_SCROLL_EDGE,
  AUTO_SCROLL_STEP,
  indexFromContentPoint,
  reorderList,
  type CardLayout,
} from './propertySpaces/reorderHelpers';
import { SpacePhotoThumb } from './propertySpaces/SpacePhotoThumb';
import { propertySpacesStyles as styles } from './propertySpaces/propertySpacesStyles';

interface PropertySpacesProps {
  propertyId: string;
  canEdit?: boolean;
}

/**
 * Spaces tab: snapshot of each space with its photos (like public share),
 * hub-style multi-column grid, drag-to-reorder with edge auto-scroll.
 */
export const PropertySpaces: React.FC<PropertySpacesProps> = ({
  propertyId,
  canEdit = true,
}) => {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const isDesktop = useDesktopLayout();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [photosBySpace, setPhotosBySpace] = useState<Record<string, Photo[]>>(
    {}
  );
  const [unassignedPhotos, setUnassignedPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const floatAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string | undefined>();

  const spacesRef = useRef(spaces);
  spacesRef.current = spaces;
  const draggingIndexRef = useRef<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const viewportWindowRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const listWrapRef = useRef<View>(null);
  const listWrapWindowRef = useRef({ x: 0, y: 0 });
  const cardLayoutsRef = useRef<Record<number, CardLayout>>({});
  const pointerPageRef = useRef({ x: 0, y: 0 });
  const autoScrollDirRef = useRef(0);

  const loadSpaces = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft ?? false;
    try {
      if (!soft) setLoading(true);
      const [spaceList, allPhotos] = await Promise.all([
        spacesService.getSpaces(propertyId),
        photosService.getPhotos(propertyId, { fields: 'gallery' }),
      ]);
      setSpaces(spaceList);

      const bySpace: Record<string, Photo[]> = {};
      const unassigned: Photo[] = [];
      for (const photo of allPhotos) {
        const spaceId = photo.space;
        if (spaceId) {
          if (!bySpace[spaceId]) bySpace[spaceId] = [];
          bySpace[spaceId].push(photo);
        } else {
          unassigned.push(photo);
        }
      }
      setPhotosBySpace(bySpace);
      setUnassignedPhotos(unassigned);
    } catch (error) {
      console.error('Error loading spaces:', error);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useFocusEffect(
    useCallback(() => {
      void loadSpaces({ soft: true });
    }, [loadSpaces])
  );

  const persistOrder = useCallback(
    async (ordered: Space[]) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSavingOrder(true);
      try {
        const updated = await spacesService.reorderSpaces(
          propertyId,
          ordered.map((s) => s.id)
        );
        setSpaces(updated);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to save space order';
        showToast(message, 'error');
        await loadSpaces({ soft: true });
      } finally {
        savingRef.current = false;
        setSavingOrder(false);
      }
    },
    [loadSpaces, propertyId, showToast]
  );

  const measureViewport = useCallback(() => {
    listWrapRef.current?.measureInWindow?.((x, y, width, height) => {
      listWrapWindowRef.current = { x, y };
      viewportWindowRef.current = { x, y, width, height };
      viewportHeightRef.current = height;
    });
  }, []);

  const updateHoverFromPointer = useCallback(() => {
    const from = draggingIndexRef.current;
    if (from == null) return;
    const { x: pageX, y: pageY } = pointerPageRef.current;
    const vp = viewportWindowRef.current;
    const localX = pageX - vp.x;
    const localY = pageY - vp.y + scrollYRef.current;
    const nextHover = indexFromContentPoint(
      localX,
      localY,
      cardLayoutsRef.current,
      spacesRef.current.length,
      hoverIndexRef.current ?? from
    );
    if (hoverIndexRef.current !== nextHover) {
      hoverIndexRef.current = nextHover;
      setHoverIndex(nextHover);
    }
  }, []);

  const updateAutoScrollDir = useCallback(() => {
    const { y: pageY } = pointerPageRef.current;
    const vp = viewportWindowRef.current;
    if (vp.height <= 0) {
      autoScrollDirRef.current = 0;
      return;
    }
    if (pageY < vp.y + AUTO_SCROLL_EDGE) {
      autoScrollDirRef.current = -1;
    } else if (pageY > vp.y + vp.height - AUTO_SCROLL_EDGE) {
      autoScrollDirRef.current = 1;
    } else {
      autoScrollDirRef.current = 0;
    }
  }, []);

  // Edge auto-scroll while dragging
  useEffect(() => {
    if (draggingIndex == null) {
      autoScrollDirRef.current = 0;
      return;
    }
    const id = setInterval(() => {
      const dir = autoScrollDirRef.current;
      if (dir === 0) return;
      const maxScroll = Math.max(
        0,
        contentHeightRef.current - viewportHeightRef.current
      );
      const next = Math.max(
        0,
        Math.min(maxScroll, scrollYRef.current + dir * AUTO_SCROLL_STEP)
      );
      if (next === scrollYRef.current) return;
      scrollYRef.current = next;
      scrollRef.current?.scrollTo({ y: next, animated: false });
      updateHoverFromPointer();
    }, 16);
    return () => clearInterval(id);
  }, [draggingIndex, updateHoverFromPointer]);

  const beginDrag = useCallback(
    (index: number, pageX: number, pageY: number) => {
      if (!canEdit || savingRef.current) return;
      measureViewport();
      draggingIndexRef.current = index;
      hoverIndexRef.current = index;
      pointerPageRef.current = { x: pageX, y: pageY };
      setDraggingIndex(index);
      setHoverIndex(index);
      const wrap = listWrapWindowRef.current;
      floatAnim.setValue({
        x: pageX - wrap.x - 24,
        y: pageY - wrap.y - 20,
      });
    },
    [canEdit, measureViewport, floatAnim]
  );

  const endDrag = useCallback(() => {
    const from = draggingIndexRef.current;
    const to = hoverIndexRef.current;
    draggingIndexRef.current = null;
    hoverIndexRef.current = null;
    autoScrollDirRef.current = 0;
    setDraggingIndex(null);
    setHoverIndex(null);

    if (from == null || to == null || from === to) return;
    const next = reorderList(spacesRef.current, from, to);
    setSpaces(next);
    void persistOrder(next);
  }, [persistOrder]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          pendingIndexRef.current != null || draggingIndexRef.current != null,
        onMoveShouldSetPanResponder: () => draggingIndexRef.current != null,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const idx = pendingIndexRef.current;
          if (idx == null) return;
          const { pageX, pageY } = evt.nativeEvent;
          beginDrag(idx, pageX, pageY);
        },
        onPanResponderMove: (evt) => {
          const from = draggingIndexRef.current;
          if (from == null) return;
          const { pageX, pageY } = evt.nativeEvent;
          pointerPageRef.current = { x: pageX, y: pageY };
          const wrap = listWrapWindowRef.current;
          floatAnim.setValue({
            x: pageX - wrap.x - 24,
            y: pageY - wrap.y - 20,
          });
          updateAutoScrollDir();
          updateHoverFromPointer();
        },
        onPanResponderRelease: () => {
          pendingIndexRef.current = null;
          endDrag();
        },
        onPanResponderTerminate: () => {
          pendingIndexRef.current = null;
          endDrag();
        },
      }),
    [beginDrag, endDrag, updateAutoScrollDir, updateHoverFromPointer, floatAnim]
  );

  const onCardLayout = (index: number, e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    // Layout is relative to cardGrid; add list content padding.
    cardLayoutsRef.current[index] = {
      x: x + spacing.md,
      y: y + spacing.md,
      width,
      height,
    };
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
    if (draggingIndexRef.current != null) {
      updateHoverFromPointer();
    }
  };

  const openPhoto = (uri: string, title?: string) => {
    if (openImageWithNativeZoom(uri)) return;
    setLightboxTitle(title);
    setLightboxUri(uri);
  };

  const cardElevation = isDark
    ? {}
    : Platform.OS === 'web'
      ? { boxShadow: '0px 2px 4px rgba(0,0,0,0.08)' as any }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 3,
          elevation: 2,
        };

  if (loading && spaces.length === 0) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.backgroundSecondary },
        ]}
      >
        <Text style={{ color: colors.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
    >
      {canEdit ? (
        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <PRGButton
            title="Add Space"
            onPress={() =>
              router.push(`/(tabs)/properties/${propertyId}/spaces/create`)
            }
            variant="primary"
          />
          {spaces.length > 1 ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Drag ⠿ to reorder · hold near edges to scroll · tap a photo to
              zoom
              {savingOrder ? ' · Saving…' : ''}
            </Text>
          ) : (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Tap a photo to open and zoom
            </Text>
          )}
        </View>
      ) : null}

      {spaces.length === 0 ? (
        <PRGEmptyState
          title="No Spaces"
          message={
            canEdit
              ? 'Add spaces to organize photos by room or area'
              : 'No spaces yet'
          }
          actionLabel={canEdit ? 'Add Space' : undefined}
          onAction={
            canEdit
              ? () =>
                  router.push(
                    `/(tabs)/properties/${propertyId}/spaces/create`
                  )
              : undefined
          }
        />
      ) : (
        <View style={styles.listWrap} ref={listWrapRef} collapsable={false}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.listContent}
            scrollEnabled={draggingIndex == null}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onLayout={(e) => {
              viewportHeightRef.current = e.nativeEvent.layout.height;
              measureViewport();
            }}
            onContentSizeChange={(_w, h) => {
              contentHeightRef.current = h;
            }}
          >
            <View style={isDesktop ? styles.cardGrid : undefined}>
              {spaces.map((item, index) => {
                const isActive = draggingIndex === index;
                const isDropTarget =
                  draggingIndex != null &&
                  hoverIndex === index &&
                  hoverIndex !== draggingIndex;
                const spacePhotos = photosBySpace[item.id] || [];

                return (
                  <View
                    key={item.id}
                    style={isDesktop ? styles.cardGridItem : styles.cardStackItem}
                    onLayout={(e) => onCardLayout(index, e)}
                  >
                    <View
                      style={[
                        styles.card,
                        {
                          backgroundColor: colors.card,
                          borderColor: isDropTarget
                            ? colors.primary
                            : colors.border,
                          borderWidth: isDropTarget ? 2 : 1,
                        },
                        cardElevation,
                        isActive && styles.cardPlaceholder,
                      ]}
                    >
                      <View
                        style={[
                          styles.spaceHeader,
                          isActive && styles.spaceRowDimmed,
                        ]}
                      >
                        {canEdit ? (
                          <View
                            style={styles.handleHit}
                            {...panResponder.panHandlers}
                            onTouchStart={() => {
                              pendingIndexRef.current = index;
                            }}
                            {...(Platform.OS === 'web'
                              ? {
                                  onMouseDown: () => {
                                    pendingIndexRef.current = index;
                                  },
                                }
                              : {})}
                            accessibilityRole="button"
                            accessibilityLabel={`Reorder ${item.display_name}`}
                          >
                            <Text
                              style={[
                                styles.handleGlyph,
                                {
                                  color: isActive
                                    ? colors.primary
                                    : colors.textTertiary,
                                },
                              ]}
                            >
                              ⠿
                            </Text>
                          </View>
                        ) : null}

                        <Pressable
                          style={styles.spacePress}
                          onPress={() => {
                            if (draggingIndex != null) return;
                            router.push(
                              `/(tabs)/properties/${propertyId}/spaces/${item.id}`
                            );
                          }}
                          disabled={draggingIndex != null}
                        >
                          <View style={styles.spaceInfo}>
                            <Text
                              style={[styles.spaceName, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {item.display_name}
                            </Text>
                            <Text
                              style={[
                                styles.spaceMeta,
                                { color: colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {getSpaceTypeLabel(
                                item.space_type,
                                item.custom_space_type
                              )}
                              {` · ${spacePhotos.length} photo${spacePhotos.length === 1 ? '' : 's'}`}
                            </Text>
                          </View>
                        </Pressable>
                      </View>

                      {spacePhotos.length > 0 ? (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          scrollEnabled={draggingIndex == null}
                          style={styles.photoRow}
                        >
                          {spacePhotos.map((photo) => (
                            <SpacePhotoThumb
                              key={photo.id}
                              photo={photo}
                              colors={colors}
                              onOpen={openPhoto}
                            />
                          ))}
                        </ScrollView>
                      ) : (
                        <Text
                          style={[
                            styles.emptyPhotos,
                            { color: colors.textTertiary },
                          ]}
                        >
                          No photos in this space yet
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {unassignedPhotos.length > 0 ? (
              <View
                style={[
                  styles.card,
                  styles.unassignedCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                  cardElevation,
                ]}
              >
                <Text style={[styles.spaceName, { color: colors.text }]}>
                  Unassigned photos
                </Text>
                <Text
                  style={[styles.spaceMeta, { color: colors.textSecondary }]}
                >
                  {unassignedPhotos.length} photo
                  {unassignedPhotos.length === 1 ? '' : 's'} not in a space
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoRow}
                >
                  {unassignedPhotos.map((photo) => (
                    <SpacePhotoThumb
                      key={photo.id}
                      photo={photo}
                      colors={colors}
                      onOpen={openPhoto}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </ScrollView>

          {draggingIndex != null && spaces[draggingIndex] ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.floatingCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                  left: 0,
                  top: 0,
                  width: isDesktop ? 280 : undefined,
                  right: isDesktop ? undefined : spacing.md,
                  transform: floatAnim.getTranslateTransform(),
                },
                Platform.OS === 'web'
                  ? ({ boxShadow: '0 12px 28px rgba(0,0,0,0.22)' } as any)
                  : {
                      shadowColor: '#000',
                      shadowOpacity: 0.25,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 8 },
                      elevation: 10,
                    },
              ]}
            >
              <Text style={[styles.spaceName, { color: colors.text }]}>
                {spaces[draggingIndex].display_name}
              </Text>
              <Text style={[styles.spaceMeta, { color: colors.textSecondary }]}>
                Drop to reorder
              </Text>
            </Animated.View>
          ) : null}
        </View>
      )}

      <PRGImageLightbox
        visible={!!lightboxUri}
        uri={lightboxUri}
        title={lightboxTitle}
        onClose={() => {
          setLightboxUri(null);
          setLightboxTitle(undefined);
        }}
      />
    </View>
  );
};
