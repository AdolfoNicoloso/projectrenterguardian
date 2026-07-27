import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Pressable,
  View,
  Platform,
  PanResponder,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { getAuthenticatedMediaFileUrl } from '../../utils/fileUrl';
import type { ThemeColors } from '../../theme/colors';
import type { Photo } from '../../types';
import { propertySpacesStyles as styles } from './propertySpacesStyles';

/** Delay before lift — hold to pick up; then move to drop. */
const ARM_DELAY_MS = 220;
/** Early horizontal travel before hold → treat as row scroll. */
const SCROLL_CANCEL_PX = 8;

const webNoSelect =
  Platform.OS === 'web'
    ? ({
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitUserDrag: 'none',
        WebkitTouchCallout: 'none',
        MozUserSelect: 'none',
      } as object)
    : null;

export function SpacePhotoThumb({
  photo,
  colors,
  onOpen,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  photo: Photo;
  colors: ThemeColors;
  /** Called on a quick tap (not after drag). Passes photo id for gallery open. */
  onOpen: (photo: Photo) => void;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (photo: Photo, pageX: number, pageY: number) => void;
  onDragMove?: (pageX: number, pageY: number) => void;
  onDragEnd?: () => void;
}) {
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  /** Pressed / holding — visual grab feedback after ARM_DELAY_MS (until parent drag UI takes over). */
  const [armed, setArmed] = useState(false);
  const dragActiveRef = useRef(false);
  /** After a drag gesture, ignore the synthetic click that follows mouseup on web. */
  const suppressOpenRef = useRef(false);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True if this press crossed the hold threshold (do not open on release). */
  const heldPastArmRef = useRef(false);
  /** Last pointer page coords — used to lift on hold without waiting for move. */
  const lastPageRef = useRef({ x: 0, y: 0 });
  const photoRef = useRef(photo);
  photoRef.current = photo;
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  onDragStartRef.current = onDragStart;
  onDragMoveRef.current = onDragMove;
  onDragEndRef.current = onDragEnd;

  useEffect(() => {
    let cancelled = false;
    getAuthenticatedMediaFileUrl(photo.file, 'thumb')
      .then((url) => {
        if (!cancelled) setThumbUri(url);
      })
      .catch(() => {
        if (!cancelled) setThumbUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [photo.file]);

  useEffect(() => {
    if (!isDragging) return;
    setArmed(false);
  }, [isDragging]);

  useEffect(
    () => () => {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
    },
    []
  );

  const tryOpen = () => {
    if (suppressOpenRef.current) {
      suppressOpenRef.current = false;
      heldPastArmRef.current = false;
      return;
    }
    if (isDragging || dragActiveRef.current || heldPastArmRef.current) {
      heldPastArmRef.current = false;
      return;
    }
    onOpen(photoRef.current);
  };

  const clearArmTimer = () => {
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
  };

  const finishDrag = () => {
    if (!dragActiveRef.current) {
      clearArmTimer();
      setArmed(false);
      return;
    }
    dragActiveRef.current = false;
    clearArmTimer();
    setArmed(false);
    heldPastArmRef.current = false;
    suppressOpenRef.current = true;
    onDragEndRef.current?.();
  };

  /** Hold completed → pick up immediately (claim before iOS image callout). */
  const beginLift = (pageX: number, pageY: number) => {
    if (dragActiveRef.current) return;
    heldPastArmRef.current = true;
    dragActiveRef.current = true;
    suppressOpenRef.current = true;
    setArmed(true);
    onDragStartRef.current?.(photoRef.current, pageX, pageY);
  };

  const recordPage = (pageX: number, pageY: number) => {
    lastPageRef.current = { x: pageX, y: pageY };
  };

  const scheduleArm = () => {
    if (!draggable) return;
    heldPastArmRef.current = false;
    clearArmTimer();
    armTimerRef.current = setTimeout(() => {
      armTimerRef.current = null;
      if (!dragActiveRef.current) {
        beginLift(lastPageRef.current.x, lastPageRef.current.y);
      }
    }, ARM_DELAY_MS);
  };

  const onPointerDown = (pageX: number, pageY: number) => {
    recordPage(pageX, pageY);
    scheduleArm();
  };

  const onPointerMove = (pageX: number, pageY: number) => {
    recordPage(pageX, pageY);
    // Forward moves even before PanResponder grants (hold already lifted).
    if (dragActiveRef.current) {
      onDragMoveRef.current?.(pageX, pageY);
    }
  };

  /** Press origin for scroll-cancel before hold. */
  const pressOriginRef = useRef({ x: 0, y: 0 });

  /** End drag on finger/mouse up (not on mouse leave — leaving the thumb is normal while dragging). */
  const disarmOrEnd = () => {
    clearArmTimer();
    if (dragActiveRef.current) {
      finishDrag();
      return;
    }
    setArmed(false);
  };

  const cancelArmOnly = () => {
    clearArmTimer();
    if (!dragActiveRef.current) setArmed(false);
  };

  const panResponder = useMemo(() => {
    if (!draggable) return null;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => {
        const absDx = Math.abs(g.dx);
        const absDy = Math.abs(g.dy);
        const horizontalDominant = absDx > absDy;
        const held = heldPastArmRef.current || dragActiveRef.current;

        // Before hold completes: sideways motion belongs to the photo row.
        if (!held && horizontalDominant && absDx > SCROLL_CANCEL_PX) {
          clearArmTimer();
          heldPastArmRef.current = false;
          setArmed(false);
          return false;
        }

        // Not held yet: never start drag (wait for arm delay).
        if (!held) {
          return false;
        }

        // Already lifted on hold: claim any movement so ScrollView cannot steal.
        return absDx > 0 || absDy > 0;
      },
      onMoveShouldSetPanResponderCapture: (_e, g) => {
        if (!(heldPastArmRef.current || dragActiveRef.current)) return false;
        return Math.abs(g.dx) > 0 || Math.abs(g.dy) > 0;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        clearArmTimer();
        const { pageX, pageY } = evt.nativeEvent;
        recordPage(pageX, pageY);
        if (!dragActiveRef.current) {
          beginLift(pageX, pageY);
        }
      },
      onPanResponderMove: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        recordPage(pageX, pageY);
        onDragMoveRef.current?.(pageX, pageY);
      },
      onPanResponderRelease: () => {
        finishDrag();
      },
      onPanResponderTerminate: () => {
        finishDrag();
      },
    });
  }, [draggable]);

  const preventContextMenu = (e: { preventDefault?: () => void }) => {
    e.preventDefault?.();
  };

  const image = thumbUri ? (
    <Image
      source={{ uri: thumbUri }}
      style={styles.thumbImage}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={photo.id}
      pointerEvents="none"
      // RN-only: on web, `accessible` is forwarded to the DOM and React warns.
      {...(Platform.OS !== 'web' ? { accessible: false } : {})}
      {...(Platform.OS === 'web' ? ({ draggable: false } as object) : {})}
    />
  ) : null;

  const showArmed = armed && !isDragging;

  return (
    <View style={styles.thumbSlot}>
      <View
        {...(panResponder ? panResponder.panHandlers : {})}
        onTouchStart={
          draggable
            ? (e) => {
                const t = e.nativeEvent.touches[0];
                if (!t) return;
                pressOriginRef.current = { x: t.pageX, y: t.pageY };
                onPointerDown(t.pageX, t.pageY);
              }
            : undefined
        }
        onTouchMove={
          draggable
            ? (e) => {
                const t = e.nativeEvent.touches[0];
                if (!t) return;
                // Cancel arm if scrolling sideways before hold.
                if (!heldPastArmRef.current && !dragActiveRef.current) {
                  const dx = t.pageX - pressOriginRef.current.x;
                  const dy = t.pageY - pressOriginRef.current.y;
                  if (
                    Math.abs(dx) > SCROLL_CANCEL_PX &&
                    Math.abs(dx) > Math.abs(dy)
                  ) {
                    clearArmTimer();
                    setArmed(false);
                    recordPage(t.pageX, t.pageY);
                    return;
                  }
                }
                onPointerMove(t.pageX, t.pageY);
              }
            : undefined
        }
        onTouchEnd={draggable ? disarmOrEnd : undefined}
        onTouchCancel={draggable ? disarmOrEnd : undefined}
        {...(Platform.OS === 'web'
          ? {
              onMouseDown: draggable
                ? (e: { nativeEvent: { pageX: number; pageY: number } }) => {
                    const { pageX, pageY } = e.nativeEvent;
                    pressOriginRef.current = { x: pageX, y: pageY };
                    onPointerDown(pageX, pageY);
                  }
                : undefined,
              onMouseMove: draggable
                ? (e: { nativeEvent: { pageX: number; pageY: number } }) => {
                    const { pageX, pageY } = e.nativeEvent;
                    if (!heldPastArmRef.current && !dragActiveRef.current) {
                      const dx = pageX - pressOriginRef.current.x;
                      const dy = pageY - pressOriginRef.current.y;
                      if (
                        Math.abs(dx) > SCROLL_CANCEL_PX &&
                        Math.abs(dx) > Math.abs(dy)
                      ) {
                        clearArmTimer();
                        setArmed(false);
                        recordPage(pageX, pageY);
                        return;
                      }
                    }
                    onPointerMove(pageX, pageY);
                  }
                : undefined,
              onMouseUp: draggable ? disarmOrEnd : undefined,
              onMouseLeave: draggable ? cancelArmOnly : undefined,
              onClick: () => tryOpen(),
              onContextMenu: preventContextMenu,
            }
          : {
              // Native: block system callout / secondary click style menus where supported.
              onContextMenu: preventContextMenu,
            })}
        accessibilityRole="imagebutton"
        accessibilityLabel={
          draggable
            ? 'Photo — tap to view, hold to pick up and drag to assign'
            : 'Open photo'
        }
        style={[
          styles.thumb,
          {
            backgroundColor: colors.backgroundTertiary,
            borderWidth: showArmed ? 2 : 0,
            borderColor: showArmed ? colors.primary : 'transparent',
          },
          showArmed && styles.thumbArmed,
          isDragging && styles.thumbDragging,
          webNoSelect,
          Platform.OS === 'web'
            ? ({
                cursor: draggable
                  ? isDragging || armed
                    ? 'grabbing'
                    : 'grab'
                  : 'pointer',
                ...(showArmed
                  ? {
                      boxShadow: '0 8px 18px rgba(0,0,0,0.28)',
                      transition: 'transform 80ms ease, box-shadow 80ms ease',
                    }
                  : {
                      transition: 'transform 80ms ease, box-shadow 80ms ease',
                    }),
              } as object)
            : showArmed
              ? {
                  shadowColor: '#000',
                  shadowOpacity: 0.28,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 8,
                }
              : null,
        ]}
      >
        {Platform.OS === 'web' ? (
          image
        ) : (
          <Pressable
            onPress={tryOpen}
            delayLongPress={10_000}
            style={StyleSheet.absoluteFill}
            accessibilityRole="imagebutton"
          >
            {image}
          </Pressable>
        )}
      </View>
    </View>
  );
}
