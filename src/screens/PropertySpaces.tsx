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
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  PRGEmptyState,
  PRGButton,
  PRGLoadingOverlay,
  PRGPhotoGallery,
  useToast,
  SVGIcon,
  type GalleryPhoto,
} from '../components';
import { spacesService } from '../services/spacesService';
import { photosService } from '../services/photosService';
import { assignmentsService } from '../services/assignmentsService';
import {
  formatBatchUploadToast,
  pickMediaFromLibraryAsync,
  uploadImagePickerAssetsBatch,
} from '../services/mediaBatchUpload';
import { getSpaceTypeLabel } from '../constants/spaceTypes';
import { useDesktopLayout } from '../hooks/useDesktopLayout';
import { spacing } from '../theme';
import { useTheme } from '../theme/useTheme';
import type { Photo, Space } from '../types';
import { capturedAtFromExif } from '../utils/dateTime';
import PlusFillIcon from '../../assets/nav_bar_symbols_final/plus.fill.svg';
import {
  AUTO_SCROLL_EDGE,
  AUTO_SCROLL_STEP,
  hitIndexFromContentPoint,
  indexFromContentPoint,
  reorderList,
  type CardLayout,
} from './propertySpaces/reorderHelpers';
import { SpacePhotoThumb } from './propertySpaces/SpacePhotoThumb';
import { propertySpacesStyles as styles } from './propertySpaces/propertySpacesStyles';
import { getAuthenticatedMediaFileUrl } from '../utils/fileUrl';
import { formatGalleryNotesText } from '../utils/notes';

/** Drop target id for the unassigned tray (not a real space id). */
const UNASSIGNED_DROP = '__unassigned__';
/** Matches `thumbSlot.width` in propertySpacesStyles. */
const PHOTO_THUMB_SLOT = 96;

function sortPhotosByOrdinal(list: Photo[]): Photo[] {
  return [...list].sort((a, b) => {
    const oa = typeof a.ordinal === 'number' ? a.ordinal : 1e9;
    const ob = typeof b.ordinal === 'number' ? b.ordinal : 1e9;
    if (oa !== ob) return oa - ob;
    return String(a.captured_at || '').localeCompare(String(b.captured_at || ''));
  });
}

interface PropertySpacesProps {
  propertyId: string;
  canEdit?: boolean;
}

/**
 * Spaces tab: snapshot of each space with its photos (like public share),
 * hub-style multi-column grid, drag-to-reorder with edge auto-scroll,
 * and drag photos between spaces or the unassigned tray.
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
  const [draggingPhoto, setDraggingPhoto] = useState<Photo | null>(null);
  const [photoDropTarget, setPhotoDropTarget] = useState<string | null>(null);
  /** Insert-before index while reordering within a row (drives the purple divider). */
  const [photoDropInsertIndex, setPhotoDropInsertIndex] = useState<number | null>(
    null
  );
  const [floatingThumbUri, setFloatingThumbUri] = useState<string | null>(null);
  const floatAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);

  const spacesRef = useRef(spaces);
  spacesRef.current = spaces;
  const draggingIndexRef = useRef<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const assigningRef = useRef(false);
  /** Serialize photo move/reorder API so a new drag can start while the previous save finishes. */
  const assignQueueRef = useRef(Promise.resolve());
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const viewportWindowRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const listWrapRef = useRef<View>(null);
  const listWrapWindowRef = useRef({ x: 0, y: 0 });
  const cardGridOffsetRef = useRef({ x: 0, y: 0 });
  const cardLayoutsRef = useRef<Record<number, CardLayout>>({});
  const unassignedLayoutRef = useRef<CardLayout | null>(null);
  const pointerPageRef = useRef({ x: 0, y: 0 });
  const autoScrollDirRef = useRef(0);
  const draggingPhotoRef = useRef<Photo | null>(null);
  const photoDropTargetRef = useRef<string | null>(null);
  /** Insert index within the drop row (same-container reorder). */
  const photoDropInsertIndexRef = useRef<number | null>(null);
  const photosBySpaceRef = useRef(photosBySpace);
  const unassignedPhotosRef = useRef(unassignedPhotos);
  photosBySpaceRef.current = photosBySpace;
  unassignedPhotosRef.current = unassignedPhotos;
  const photoRowScrollXRef = useRef<Record<string, number>>({});
  const photoRowWindowRef = useRef<
    Record<string, { x: number; y: number; width: number; height: number }>
  >({});
  const photoRowRefs = useRef<Record<string, View | null>>({});

  const isDraggingAnything =
    draggingIndex != null || draggingPhoto != null;

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
      for (const id of Object.keys(bySpace)) {
        bySpace[id] = sortPhotosByOrdinal(bySpace[id]);
      }
      setPhotosBySpace(bySpace);
      setUnassignedPhotos(sortPhotosByOrdinal(unassigned));
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

  const handleAddPhotos = useCallback(async () => {
    if (!canEdit || uploading) return;
    try {
      const assets = await pickMediaFromLibraryAsync();
      if (!assets?.length) return;

      setUploading(true);
      setUploadProgress({ completed: 0, total: assets.length });
      try {
        const { successCount, failCount, firstErrorMessage } =
          await uploadImagePickerAssetsBatch(
            assets,
            (asset) => ({
              property: propertyId,
              captured_at: capturedAtFromExif(asset.exif?.DateTimeOriginal),
            }),
            {
              onProgress: ({ completed, total }) =>
                setUploadProgress({ completed, total }),
            }
          );

        const toast = formatBatchUploadToast(
          successCount,
          failCount,
          'photo(s)',
          firstErrorMessage
        );
        if (toast) showToast(toast.message, toast.type);
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
      await loadSpaces({ soft: true });
    } catch (error) {
      console.error('Error picking media:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to open photo library',
        'error'
      );
    }
  }, [canEdit, uploading, propertyId, showToast, loadSpaces]);

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

  const contentPointFromPage = useCallback((pageX: number, pageY: number) => {
    const vp = viewportWindowRef.current;
    return {
      localX: pageX - vp.x,
      localY: pageY - vp.y + scrollYRef.current,
    };
  }, []);

  const composedCardLayouts = useCallback((): Record<number, CardLayout> => {
    const grid = cardGridOffsetRef.current;
    const out: Record<number, CardLayout> = {};
    for (const [key, L] of Object.entries(cardLayoutsRef.current)) {
      const i = Number(key);
      out[i] = {
        x: grid.x + L.x,
        y: grid.y + L.y,
        width: L.width,
        height: L.height,
      };
    }
    return out;
  }, []);

  const updateHoverFromPointer = useCallback(() => {
    const from = draggingIndexRef.current;
    if (from == null) return;
    const { x: pageX, y: pageY } = pointerPageRef.current;
    const { localX, localY } = contentPointFromPage(pageX, pageY);
    const nextHover = indexFromContentPoint(
      localX,
      localY,
      composedCardLayouts(),
      spacesRef.current.length,
      hoverIndexRef.current ?? from
    );
    if (hoverIndexRef.current !== nextHover) {
      hoverIndexRef.current = nextHover;
      setHoverIndex(nextHover);
    }
  }, [contentPointFromPage, composedCardLayouts]);

  const photoSourceSpaceId = (photo: Photo): string | null => {
    const s = photo.space;
    return s ? s : null;
  };

  const measurePhotoRow = useCallback((containerId: string) => {
    const node = photoRowRefs.current[containerId];
    node?.measureInWindow?.((x, y, width, height) => {
      photoRowWindowRef.current[containerId] = { x, y, width, height };
    });
  }, []);

  const insertIndexInRow = useCallback(
    (containerId: string, pageX: number, listLength: number) => {
      // Gap index: 0 = before first … listLength = after last.
      if (listLength <= 0) return 0;
      measurePhotoRow(containerId);
      const row = photoRowWindowRef.current[containerId];
      if (!row) return listLength;
      const scrollX = photoRowScrollXRef.current[containerId] || 0;
      const xInContent = pageX - row.x + scrollX;
      return Math.max(
        0,
        Math.min(listLength, Math.round(xInContent / PHOTO_THUMB_SLOT))
      );
    },
    [measurePhotoRow]
  );

  const setPhotoInsertIndex = useCallback((next: number | null) => {
    if (photoDropInsertIndexRef.current === next) return;
    photoDropInsertIndexRef.current = next;
    setPhotoDropInsertIndex(next);
  }, []);

  const updatePhotoDropFromPointer = useCallback(() => {
    if (draggingPhotoRef.current == null) return;
    const { x: pageX, y: pageY } = pointerPageRef.current;
    const { localX, localY } = contentPointFromPage(pageX, pageY);
    const sourceSpace = photoSourceSpaceId(draggingPhotoRef.current);

    const unassigned = unassignedLayoutRef.current;
    if (
      unassigned &&
      localX >= unassigned.x &&
      localX <= unassigned.x + unassigned.width &&
      localY >= unassigned.y &&
      localY <= unassigned.y + unassigned.height
    ) {
      const list = unassignedPhotosRef.current;
      setPhotoInsertIndex(
        insertIndexInRow(UNASSIGNED_DROP, pageX, list.length)
      );
      if (photoDropTargetRef.current !== UNASSIGNED_DROP) {
        photoDropTargetRef.current = UNASSIGNED_DROP;
        setPhotoDropTarget(UNASSIGNED_DROP);
      }
      return;
    }

    const layouts = composedCardLayouts();
    const hit = hitIndexFromContentPoint(
      localX,
      localY,
      layouts,
      spacesRef.current.length
    );
    const spaceId =
      hit != null ? spacesRef.current[hit]?.id ?? null : null;

    if (spaceId) {
      const list = photosBySpaceRef.current[spaceId] || [];
      setPhotoInsertIndex(insertIndexInRow(spaceId, pageX, list.length));
      if (photoDropTargetRef.current !== spaceId) {
        photoDropTargetRef.current = spaceId;
        setPhotoDropTarget(spaceId);
      }
      return;
    }

    setPhotoInsertIndex(null);
    if (photoDropTargetRef.current !== null) {
      photoDropTargetRef.current = null;
      setPhotoDropTarget(null);
    }
  }, [
    contentPointFromPage,
    composedCardLayouts,
    insertIndexInRow,
    setPhotoInsertIndex,
  ]);

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

  // Edge auto-scroll while dragging spaces or photos
  useEffect(() => {
    if (draggingIndex == null && draggingPhoto == null) {
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
      if (draggingIndexRef.current != null) updateHoverFromPointer();
      if (draggingPhotoRef.current != null) updatePhotoDropFromPointer();
    }, 16);
    return () => clearInterval(id);
  }, [
    draggingIndex,
    draggingPhoto,
    updateHoverFromPointer,
    updatePhotoDropFromPointer,
  ]);

  // Web: suppress text selection while dragging a photo
  useEffect(() => {
    if (Platform.OS !== 'web' || draggingPhoto == null) return;
    const body = typeof document !== 'undefined' ? document.body : null;
    if (!body) return;
    const prevUserSelect = body.style.userSelect;
    const prevWebkit = (
      body.style as CSSStyleDeclaration & { webkitUserSelect?: string }
    ).webkitUserSelect;
    body.style.userSelect = 'none';
    (
      body.style as CSSStyleDeclaration & { webkitUserSelect?: string }
    ).webkitUserSelect = 'none';
    return () => {
      body.style.userSelect = prevUserSelect;
      (
        body.style as CSSStyleDeclaration & { webkitUserSelect?: string }
      ).webkitUserSelect = prevWebkit ?? '';
    };
  }, [draggingPhoto]);

  const beginDrag = useCallback(
    (index: number, pageX: number, pageY: number) => {
      if (!canEdit || savingRef.current || draggingPhotoRef.current) return;
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

  const beginPhotoDrag = useCallback(
    (photo: Photo, pageX: number, pageY: number): boolean => {
      // Do not gate on assigningRef — saves can take seconds; blocking makes the next hold-lift a no-op.
      if (!canEdit || draggingIndexRef.current != null) {
        return false;
      }
      measureViewport();
      draggingPhotoRef.current = photo;
      photoDropTargetRef.current = null;
      photoDropInsertIndexRef.current = null;
      setPhotoDropInsertIndex(null);
      pointerPageRef.current = { x: pageX, y: pageY };
      setDraggingPhoto(photo);
      setPhotoDropTarget(null);
      setFloatingThumbUri(null);
      void getAuthenticatedMediaFileUrl(photo.file, 'thumb')
        .then((url) => setFloatingThumbUri(url))
        .catch(() => setFloatingThumbUri(null));
      const wrap = listWrapWindowRef.current;
      floatAnim.setValue({
        x: pageX - wrap.x - 44,
        y: pageY - wrap.y - 44,
      });
      updatePhotoDropFromPointer();
      return true;
    },
    [canEdit, measureViewport, floatAnim, updatePhotoDropFromPointer]
  );

  const movePhotoDrag = useCallback(
    (pageX: number, pageY: number) => {
      if (draggingPhotoRef.current == null) return;
      pointerPageRef.current = { x: pageX, y: pageY };
      const wrap = listWrapWindowRef.current;
      floatAnim.setValue({
        x: pageX - wrap.x - 44,
        y: pageY - wrap.y - 44,
      });
      updateAutoScrollDir();
      updatePhotoDropFromPointer();
    },
    [floatAnim, updateAutoScrollDir, updatePhotoDropFromPointer]
  );

  const enqueuePhotoMutation = useCallback((task: () => Promise<void>) => {
    const run = assignQueueRef.current.then(async () => {
      assigningRef.current = true;
      try {
        await task();
      } finally {
        assigningRef.current = false;
      }
    });
    // Keep the queue alive even if a task fails.
    assignQueueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const endPhotoDrag = useCallback(async () => {
    const photo = draggingPhotoRef.current;
    const target = photoDropTargetRef.current;
    const insertGap = photoDropInsertIndexRef.current;
    draggingPhotoRef.current = null;
    photoDropTargetRef.current = null;
    photoDropInsertIndexRef.current = null;
    autoScrollDirRef.current = 0;
    setDraggingPhoto(null);
    setPhotoDropTarget(null);
    setPhotoDropInsertIndex(null);
    setFloatingThumbUri(null);

    if (!photo || !target) return;

    const fromSpace = photoSourceSpaceId(photo);

    // Same-container reorder (space or unassigned)
    const reorderUnassigned =
      target === UNASSIGNED_DROP && fromSpace == null && insertGap != null;
    const reorderSpace =
      target !== UNASSIGNED_DROP &&
      target === fromSpace &&
      insertGap != null;

    if (reorderUnassigned || reorderSpace) {
      const list = reorderSpace
        ? photosBySpaceRef.current[target] || []
        : unassignedPhotosRef.current;
      const fromIndex = list.findIndex((p) => p.id === photo.id);
      if (fromIndex < 0) return;
      // Gap 0..n → reorder toIndex; gaps on either side of self are no-ops.
      let toIndex = insertGap > fromIndex ? insertGap - 1 : insertGap;
      toIndex = Math.max(0, Math.min(list.length - 1, toIndex));
      if (toIndex === fromIndex) return;

      const next = reorderList(list, fromIndex, toIndex).map((p, i) => ({
        ...p,
        ordinal: i,
      }));

      // Optimistic UI immediately; persist via queue so back-to-back drags stay responsive.
      if (reorderSpace) {
        setPhotosBySpace((prev) => ({ ...prev, [target]: next }));
      } else {
        setUnassignedPhotos(next);
      }

      void enqueuePhotoMutation(async () => {
        try {
          await photosService.reorderPhotos(
            propertyId,
            next.map((p) => p.id),
            reorderSpace ? target : ''
          );
          showToast('Photo order updated', 'success');
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Failed to reorder photos';
          showToast(message, 'error');
          await loadSpaces({ soft: true });
        }
      });
      return;
    }

    if (target === UNASSIGNED_DROP && fromSpace == null) return;
    if (target !== UNASSIGNED_DROP && target === fromSpace) return;

    const gap = insertGap ?? Number.MAX_SAFE_INTEGER;
    const sourceBefore =
      fromSpace != null
        ? photosBySpaceRef.current[fromSpace] || []
        : unassignedPhotosRef.current;
    const targetBefore =
      target === UNASSIGNED_DROP
        ? unassignedPhotosRef.current
        : photosBySpaceRef.current[target] || [];

    const nextSourceList = sourceBefore
      .filter((p) => p.id !== photo.id)
      .map((p, i) => ({ ...p, ordinal: i }));
    const targetWithout = targetBefore.filter((p) => p.id !== photo.id);
    const idx = Math.max(0, Math.min(targetWithout.length, gap));
    const moved: Photo = {
      ...photo,
      space:
        target === UNASSIGNED_DROP
          ? ('' as Photo['space'])
          : target,
      assignment_status:
        target === UNASSIGNED_DROP ? 'unassigned' : 'confirmed',
    };
    const nextTargetList = [...targetWithout];
    nextTargetList.splice(idx, 0, moved);
    const nextTargetOrdered = nextTargetList.map((p, i) => ({
      ...p,
      ordinal: i,
    }));

    setPhotosBySpace((prev) => {
      const next: Record<string, Photo[]> = { ...prev };
      if (fromSpace) next[fromSpace] = nextSourceList;
      if (target !== UNASSIGNED_DROP) next[target] = nextTargetOrdered;
      return next;
    });
    setUnassignedPhotos((prev) => {
      if (target === UNASSIGNED_DROP) return nextTargetOrdered;
      if (fromSpace == null) return nextSourceList;
      return prev.filter((p) => p.id !== photo.id);
    });

    void enqueuePhotoMutation(async () => {
      try {
        if (target === UNASSIGNED_DROP) {
          await photosService.updatePhoto(photo.id, {
            space: null as unknown as string,
            assignment_status: 'unassigned',
          });
          showToast('Moved to unassigned', 'success');
        } else {
          await assignmentsService.createAssignment(photo.id, target);
          const spaceName =
            spacesRef.current.find((s) => s.id === target)?.display_name ??
            'space';
          showToast(`Assigned to ${spaceName}`, 'success');
        }
        if (nextTargetOrdered.length > 0) {
          await photosService.reorderPhotos(
            propertyId,
            nextTargetOrdered.map((p) => p.id),
            target === UNASSIGNED_DROP ? '' : target
          );
        }
        if (nextSourceList.length > 0) {
          await photosService.reorderPhotos(
            propertyId,
            nextSourceList.map((p) => p.id),
            fromSpace || ''
          );
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to move photo';
        showToast(message, 'error');
        await loadSpaces({ soft: true });
      }
    });
  }, [enqueuePhotoMutation, loadSpaces, propertyId, showToast, canEdit]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          pendingIndexRef.current != null || draggingIndexRef.current != null,
        onMoveShouldSetPanResponder: () => draggingIndexRef.current != null,
        // Refuse only while dragging a space card (ScrollView may still warn in __DEV__).
        onPanResponderTerminationRequest: () =>
          draggingIndexRef.current == null,
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

  const onCardGridLayout = (e: LayoutChangeEvent) => {
    const { x, y } = e.nativeEvent.layout;
    cardGridOffsetRef.current = { x, y };
  };

  const onCardLayout = (index: number, e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    // Relative to cardGrid; composed with cardGridOffset at hit-test time.
    cardLayoutsRef.current[index] = { x, y, width, height };
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
    if (draggingIndexRef.current != null) updateHoverFromPointer();
    if (draggingPhotoRef.current != null) updatePhotoDropFromPointer();
  };

  const spaceLabelForPhoto = useCallback(
    (photo: Photo) => {
      const spaceId = photo.space;
      if (!spaceId) return 'Unassigned';
      const space = spaces.find((s) => s.id === spaceId);
      return space?.display_name || 'Unassigned';
    },
    [spaces]
  );

  const openGallery = useCallback(
    (list: Photo[], photo: Photo) => {
      const items: GalleryPhoto[] = list.map((p) => ({
        id: p.id,
        file: p.file,
        spaceLabel: spaceLabelForPhoto(p),
        notesText: formatGalleryNotesText(p.notes_entries, p.notes),
      }));
      const idx = Math.max(
        0,
        items.findIndex((p) => p.id === photo.id)
      );
      setGalleryPhotos(items);
      setGalleryIndex(idx >= 0 ? idx : 0);
      setGalleryVisible(true);
    },
    [spaceLabelForPhoto]
  );

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

  const hintText = (() => {
    if (canEdit) {
      return `Drag photos to reorder or assign${
        spaces.length > 1 ? ' · drag ⠿ to reorder spaces' : ''
      }${savingOrder ? ' · Saving…' : ''}`;
    }
    return 'Tap a photo to open and zoom';
  })();

  if (loading && spaces.length === 0 && unassignedPhotos.length === 0) {
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

  const showEmptySpaces =
    spaces.length === 0 && unassignedPhotos.length === 0;

  const isUnassignedDropTarget =
    draggingPhoto != null && photoDropTarget === UNASSIGNED_DROP;
  const isUnassignedReorder =
    isUnassignedDropTarget &&
    draggingPhoto != null &&
    !photoSourceSpaceId(draggingPhoto);
  const isUnassignedAssign =
    isUnassignedDropTarget &&
    draggingPhoto != null &&
    !!photoSourceSpaceId(draggingPhoto);

  const photoThumbProps = {
    colors,
    draggable: canEdit,
    onDragStart: beginPhotoDrag,
    onDragMove: movePhotoDrag,
    onDragEnd: () => {
      void endPhotoDrag();
    },
  } as const;

  const renderPhotoRowItems = (list: Photo[], isDropTargetRow: boolean) => {
    const fromIndex = draggingPhoto
      ? list.findIndex((p) => p.id === draggingPhoto.id)
      : -1;
    const insertAt =
      isDropTargetRow && photoDropInsertIndex != null
        ? photoDropInsertIndex
        : -1;
    // Same-row: gaps on either side of the held photo are no-ops.
    const isNoOpGap =
      fromIndex >= 0 &&
      (insertAt === fromIndex || insertAt === fromIndex + 1);

    return (
      <>
        {list.map((photo, i) => {
          const showInsertLine =
            isDropTargetRow && insertAt === i && !isNoOpGap;
          return (
            <React.Fragment key={photo.id}>
              {showInsertLine ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.photoInsertLine,
                    { backgroundColor: colors.primary },
                  ]}
                />
              ) : null}
              <SpacePhotoThumb
                photo={photo}
                {...photoThumbProps}
                onOpen={(p) => openGallery(list, p)}
                isDragging={draggingPhoto?.id === photo.id}
              />
            </React.Fragment>
          );
        })}
        {isDropTargetRow && insertAt === list.length && !isNoOpGap ? (
          <View
            pointerEvents="none"
            style={[
              styles.photoInsertLine,
              { backgroundColor: colors.primary },
            ]}
          />
        ) : null}
      </>
    );
  };

  const renderUnassignedTray = () => {
    // Editable: always show tray so users can drop photos to unassign.
    // Read-only: only when there are unassigned photos.
    if (!canEdit && unassignedPhotos.length === 0) return null;
    return (
      <View
        onLayout={(e) => {
          unassignedLayoutRef.current = e.nativeEvent.layout;
        }}
        style={[
          styles.card,
          styles.unassignedCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.primary,
            borderWidth: isUnassignedDropTarget ? 2.5 : 1.5,
            // Don't inherit space-card minHeight when the tray is empty
            minHeight: unassignedPhotos.length > 0 ? undefined : 0,
            ...(unassignedPhotos.length === 0
              ? { paddingVertical: spacing.sm, paddingHorizontal: spacing.md }
              : null),
          },
          cardElevation,
        ]}
      >
        <View style={styles.unassignedHeader}>
          <Text style={[styles.spaceName, { color: colors.text, flex: 1 }]}>
            Unassigned photos
          </Text>
          {canEdit ? (
            <Pressable
              onPress={() => {
                void handleAddPhotos();
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Add photos"
              style={styles.unassignedAddBtn}
              disabled={uploading}
            >
              <SVGIcon source={PlusFillIcon} size={22} />
            </Pressable>
          ) : null}
        </View>
        {unassignedPhotos.length > 0 ? (
          <Text style={[styles.spaceMeta, { color: colors.textSecondary }]}>
            {unassignedPhotos.length} photo
            {unassignedPhotos.length === 1 ? '' : 's'} waiting to be placed
            {isUnassignedReorder
              ? ' · Drop to reorder'
              : isUnassignedAssign
                ? ' · Drop to unassign'
                : ''}
          </Text>
        ) : null}
        {canEdit ? (
          <Text style={[styles.unassignedPrompt, { color: colors.primary }]}>
            Drag photos here to unassign · drag onto a space to assign
          </Text>
        ) : null}
        {unassignedPhotos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!isDraggingAnything}
            style={styles.photoRow}
            contentContainerStyle={styles.photoRowContent}
            ref={(r) => {
              photoRowRefs.current[UNASSIGNED_DROP] = r as unknown as View;
            }}
            onLayout={() => measurePhotoRow(UNASSIGNED_DROP)}
            onScroll={(e) => {
              photoRowScrollXRef.current[UNASSIGNED_DROP] =
                e.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={16}
          >
            {renderPhotoRowItems(unassignedPhotos, isUnassignedDropTarget)}
          </ScrollView>
        ) : isUnassignedDropTarget ? (
          <View style={styles.emptyDropRow}>
            <View
              pointerEvents="none"
              style={[
                styles.photoInsertLine,
                { backgroundColor: colors.primary },
              ]}
            />
            <Text style={[styles.emptyPhotos, { color: colors.primary }]}>
              Drop photo here
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

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
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {hintText}
          </Text>
        </View>
      ) : null}

      {showEmptySpaces ? (
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
            scrollEnabled={!isDraggingAnything}
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
            {renderUnassignedTray()}

            {spaces.length === 0 ? (
              <PRGEmptyState
                title="No Spaces yet"
                message={
                  canEdit
                    ? 'Add a space so you can drop these photos onto it'
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
              <View
                style={isDesktop ? styles.cardGrid : undefined}
                onLayout={onCardGridLayout}
              >
                {spaces.map((item, index) => {
                  const isActive = draggingIndex === index;
                  const isReorderDrop =
                    draggingIndex != null &&
                    hoverIndex === index &&
                    hoverIndex !== draggingIndex;
                  const isPhotoDrop =
                    draggingPhoto != null && photoDropTarget === item.id;
                  const isPhotoReorder =
                    isPhotoDrop &&
                    photoSourceSpaceId(draggingPhoto!) === item.id;
                  const isPhotoAssign = isPhotoDrop && !isPhotoReorder;
                  const isDropTarget = isReorderDrop || isPhotoDrop;
                  const spacePhotos = photosBySpace[item.id] || [];

                  return (
                    <View
                      key={item.id}
                      style={
                        isDesktop ? styles.cardGridItem : styles.cardStackItem
                      }
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
                              if (isDraggingAnything) return;
                              router.push(
                                `/(tabs)/properties/${propertyId}/spaces/${item.id}`
                              );
                            }}
                            disabled={isDraggingAnything}
                          >
                            <View style={styles.spaceInfo}>
                              <Text
                                style={[
                                  styles.spaceName,
                                  { color: colors.text },
                                ]}
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
                                {isPhotoReorder
                                  ? ' · Drop to reorder'
                                  : isPhotoAssign
                                    ? ' · Drop to assign'
                                    : ''}
                              </Text>
                            </View>
                          </Pressable>
                        </View>

                        {spacePhotos.length > 0 ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            scrollEnabled={!isDraggingAnything}
                            style={styles.photoRow}
                            contentContainerStyle={styles.photoRowContent}
                            ref={(r) => {
                              photoRowRefs.current[item.id] =
                                r as unknown as View;
                            }}
                            onLayout={() => measurePhotoRow(item.id)}
                            onScroll={(e) => {
                              photoRowScrollXRef.current[item.id] =
                                e.nativeEvent.contentOffset.x;
                            }}
                            scrollEventThrottle={16}
                          >
                            {renderPhotoRowItems(spacePhotos, isPhotoDrop)}
                          </ScrollView>
                        ) : isPhotoDrop ? (
                          <View style={styles.emptyDropRow}>
                            <View
                              pointerEvents="none"
                              style={[
                                styles.photoInsertLine,
                                { backgroundColor: colors.primary },
                              ]}
                            />
                            <Text
                              style={[
                                styles.emptyPhotos,
                                { color: colors.primary },
                              ]}
                            >
                              Drop photo here
                            </Text>
                          </View>
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
            )}
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
                  right: isDesktop ? undefined : 16,
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

          {draggingPhoto ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.floatingThumb,
                {
                  backgroundColor: colors.backgroundTertiary,
                  borderColor: colors.primary,
                  left: 0,
                  top: 0,
                  transform: floatAnim.getTranslateTransform(),
                  opacity: photoDropTarget ? 1 : 0.85,
                },
                Platform.OS === 'web'
                  ? ({ boxShadow: '0 10px 24px rgba(0,0,0,0.28)' } as any)
                  : {
                      shadowColor: '#000',
                      shadowOpacity: 0.3,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 12,
                    },
              ]}
            >
              {floatingThumbUri ? (
                <Image
                  source={{ uri: floatingThumbUri }}
                  style={styles.floatingThumbImage}
                  contentFit="cover"
                />
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      )}

      <PRGPhotoGallery
        visible={galleryVisible}
        photos={galleryPhotos}
        initialIndex={galleryIndex}
        onClose={() => setGalleryVisible(false)}
        onEdit={
          canEdit
            ? (photoId) => {
                setGalleryVisible(false);
                router.push(
                  `/(tabs)/properties/${propertyId}/photos/${photoId}`
                );
              }
            : undefined
        }
        resolveNotes={async (photoId) => {
          const photo = await photosService.getPhoto(photoId);
          return formatGalleryNotesText(photo.notes_entries, photo.notes);
        }}
      />

      <PRGLoadingOverlay
        visible={uploading}
        message={
          uploadProgress && uploadProgress.total > 0
            ? `Uploading ${uploadProgress.completed}/${uploadProgress.total}...`
            : 'Uploading photos...'
        }
        progress={
          uploadProgress && uploadProgress.total > 0
            ? Math.round((uploadProgress.completed / uploadProgress.total) * 100)
            : undefined
        }
      />
    </View>
  );
};
