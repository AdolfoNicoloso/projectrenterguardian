import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  Dimensions,
  Animated,
  ViewStyle,
} from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import { useDesktopLayout } from '../hooks/useDesktopLayout';
import type { Photo } from '../types';
import { getAuthenticatedCmsFileUrl } from '../utils/fileUrl';

interface PRGPhotoGridProps {
  photos: Photo[];
  selectedIds: string[];
  onPhotoPress: (photo: Photo) => void;
  onPhotoSelect: (photoId: string) => void;
  onBulkAction?: (action: string) => void;
  showSelection?: boolean;
  enablePreviewOnLongPress?: boolean;
}

// Component to handle async URL loading for a single photo
const PhotoImage: React.FC<{
  photo: Photo;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  showSelection: boolean;
  containerStyle?: ViewStyle;
}> = ({
  photo,
  isSelected,
  onPress,
  onLongPress,
  showSelection,
  containerStyle,
}) => {
  const { colors } = useTheme();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showMediaFallback, setShowMediaFallback] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 2;

    const loadImage = async () => {
      try {
        const url = await getAuthenticatedCmsFileUrl(photo.file);
        if (!cancelled) {
          console.log('[PhotoImage] Setting image URI for photo:', photo.id);
          setImageUri(url);
        }
      } catch (error) {
        console.error('[PhotoImage] Error getting file URL:', error);
        if (!cancelled && retryCount < maxRetries) {
          retryCount++;
          console.log('[PhotoImage] Retrying... attempt', retryCount);
          // Wait a bit before retrying
          setTimeout(() => {
            if (!cancelled) {
              loadImage();
            }
          }, 1000 * retryCount);
        } else if (!cancelled) {
          // Final fallback — treat as non-image media (e.g. video)
          console.warn('[PhotoImage] All retries failed, using media placeholder');
          setShowMediaFallback(true);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [photo.file, photo.id]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  if (!imageUri || showMediaFallback) {
    return (
      <TouchableOpacity
        style={[styles.photoContainer, containerStyle]}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            { width: '100%', height: '100%' },
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {showMediaFallback ? (
            <View
              style={[
                styles.photo,
                styles.videoPlaceholder,
                { backgroundColor: colors.borderSecondary },
              ]}
            >
              <Text
                style={[styles.videoPlaceholderPlay, { color: colors.onPrimary }]}
              >
                ▶
              </Text>
              <Text
                style={[styles.videoPlaceholderLabel, { color: colors.onPrimary }]}
              >
                Video
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.photo,
                styles.photoLoading,
                { backgroundColor: colors.border },
              ]}
            />
          )}
        </Animated.View>
        {showSelection ? (
          <View
            style={[
              styles.checkbox,
              { borderColor: colors.onPrimary },
              isSelected && styles.checkboxSelected,
              isSelected && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
          >
            {isSelected ? (
              <View
                style={[styles.checkmark, { backgroundColor: colors.onPrimary }]}
              />
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.photoContainer, containerStyle]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          { width: '100%', height: '100%' },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Image
          source={{ 
            uri: imageUri,
            cache: 'force-cache'
          }}
          style={[styles.photo, { backgroundColor: colors.borderSecondary }]}
          onError={(error) => {
            // Extract error details
            const errorDetails = error?.nativeEvent?.error || 'Unknown error';
            const errorMessage = typeof errorDetails === 'string' ? errorDetails : String(errorDetails);
            
            // Check if it's a decoding error (corrupted/unsupported format)
            if (
              errorMessage.includes('decoding') ||
              errorMessage.includes('decode') ||
              errorMessage.includes('format')
            ) {
              console.warn(
                `[PhotoImage] Image decode error for photo ${photo.id}: ${errorMessage}`
              );
              setShowMediaFallback(true);
              return;
            }
            
            // For network/load errors, try to reload with fresh token
            if (errorMessage.includes('Failed to load resource') || errorMessage.includes('Network')) {
              console.warn(`[PhotoImage] Network error for photo ${photo.id}, attempting reload...`);
              if (imageUri && imageUri.includes('getFile')) {
                getAuthenticatedCmsFileUrl(photo.file)
                  .then((newUrl) => {
                    if (newUrl !== imageUri) {
                      setImageUri(newUrl);
                    }
                  })
                  .catch(() => {
                    setShowMediaFallback(true);
                  });
              } else {
                setShowMediaFallback(true);
              }
            } else {
              console.warn(`[PhotoImage] Image load error for photo ${photo.id}: ${errorMessage}`);
              setShowMediaFallback(true);
            }
          }}
          onLoad={() => {
            console.log('[PhotoImage] Image loaded successfully:', photo.id);
          }}
        />
      </Animated.View>
      {showSelection && (
        <View style={[
          styles.checkbox,
          { borderColor: colors.onPrimary },
          isSelected && styles.checkboxSelected,
          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}>
          {isSelected && <View style={[styles.checkmark, { backgroundColor: colors.onPrimary }]} />}
        </View>
      )}
    </TouchableOpacity>
  );
};

export const PRGPhotoGrid: React.FC<PRGPhotoGridProps> = ({
  photos,
  selectedIds,
  onPhotoPress,
  onPhotoSelect,
  showSelection = false,
  enablePreviewOnLongPress = false,
}) => {
  const { colors } = useTheme();
  const isDesktop = useDesktopLayout();
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  // Mobile: 3 columns; desktop web: 5 columns for denser browsing.
  const photoWidthStyle: ViewStyle = { width: isDesktop ? '20%' : '33.33%' };

  useEffect(() => {
    if (previewPhoto?.file) {
      getAuthenticatedCmsFileUrl(previewPhoto.file)
        .then(setPreviewImageUri)
        .catch((error) => {
          console.error('Error loading preview image:', error);
          setPreviewImageUri(null);
        });
    } else {
      setPreviewImageUri(null);
    }
  }, [previewPhoto]);

  const handleLongPress = (photo: Photo) => {
    if (showSelection) {
      // If in selection mode, use the existing selection behavior
      onPhotoSelect(photo.id);
    } else if (enablePreviewOnLongPress) {
      // If preview is enabled and not in selection mode, show preview
      setPreviewPhoto(photo);
    }
  };

  const closePreview = () => {
    setPreviewPhoto(null);
    setPreviewImageUri(null);
  };
  
  if (photos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No photos</Text>
      </View>
    );
  }

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  return (
    <>
      <View style={styles.container}>
        {photos.map((photo) => {
          const isSelected = selectedIds.includes(photo.id);
          return (
            <PhotoImage
              key={photo.id}
              photo={photo}
              isSelected={isSelected}
              onPress={() => onPhotoPress(photo)}
              onLongPress={() => handleLongPress(photo)}
              showSelection={showSelection}
              containerStyle={photoWidthStyle}
            />
          );
        })}
      </View>

      {enablePreviewOnLongPress && (
        <Modal
          visible={previewPhoto !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={closePreview}
        >
          <TouchableOpacity
            style={styles.previewOverlay}
            activeOpacity={1}
            onPress={closePreview}
          >
            {previewImageUri && (
              <Image
                source={{ uri: previewImageUri, cache: 'force-cache' }}
                style={[
                  styles.previewImage,
                  {
                    width: screenWidth * 0.9,
                    height: screenHeight * 0.7,
                    maxWidth: screenWidth * 0.9,
                    maxHeight: screenHeight * 0.7,
                  },
                ]}
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
  },
  photoContainer: {
    width: '33.33%',
    aspectRatio: 1,
    padding: spacing.xs,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoLoading: {
    // Background color applied via inline style
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  videoPlaceholderPlay: {
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
  },
  videoPlaceholderLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.medium,
  },
  checkbox: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    // Background and border colors applied via inline style
  },
  checkmark: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    // Color applied via inline style
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    borderRadius: 8,
  },
});

