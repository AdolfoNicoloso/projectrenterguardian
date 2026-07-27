import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  PRGButton,
  PRGHeader,
  PRGPhotoGallery,
  ScreenContainer,
  type GalleryPhoto,
} from '../../src/components';
import {
  publicShareService,
  type PublicPropertyPreview,
} from '../../src/services/publicShareService';
import { getSpaceTypeLabel } from '../../src/constants/spaceTypes';
import { getPropertyStatusLabel } from '../../src/constants/propertyStatuses';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';

function tokenFromParams(token: string | string[] | undefined): string {
  if (typeof token === 'string') return token.trim();
  if (Array.isArray(token) && typeof token[0] === 'string') return token[0].trim();
  return '';
}

function formatAddress(property: PublicPropertyPreview['property']): string {
  const parts = [
    property.street,
    property.unit ? `Unit ${property.unit}` : null,
    [property.city, property.state_code].filter(Boolean).join(', '),
    property.zip,
  ].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return property.address_free_text || '';
}

export default function PublicShareScreen() {
  const { token } = useLocalSearchParams<{ token: string | string[] }>();
  const router = useRouter();
  const { colors } = useTheme();
  const shareToken = tokenFromParams(token);

  const [preview, setPreview] = useState<PublicPropertyPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);

  useEffect(() => {
    if (!shareToken) {
      setLoading(false);
      setError('This share link is invalid.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await publicShareService.getPreview(shareToken);
        if (!cancelled) setPreview(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'This share link is unavailable.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  const photosBySpace = useMemo(() => {
    const map: Record<string, PublicPropertyPreview['photos']> = {};
    for (const photo of preview?.photos || []) {
      const key = photo.space || '_unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(photo);
    }
    return map;
  }, [preview]);

  const displayUri = (photo: PublicPropertyPreview['photos'][number]) =>
    photo.display_url ||
    publicShareService.getPublicFileUrl(shareToken, photo.file, 'display');

  const spaceLabelForId = (spaceId: string | null | undefined) => {
    if (!spaceId) return 'Unassigned';
    const space = preview?.spaces.find((s) => s.id === spaceId);
    return space?.display_name || 'Unassigned';
  };

  const openGallery = (
    list: PublicPropertyPreview['photos'],
    photo: PublicPropertyPreview['photos'][number]
  ) => {
    const items: GalleryPhoto[] = list.map((p) => ({
      id: p.id,
      uri: displayUri(p),
      spaceLabel: spaceLabelForId(p.space),
    }));
    const idx = Math.max(0, items.findIndex((p) => p.id === photo.id));
    setGalleryPhotos(items);
    setGalleryIndex(idx >= 0 ? idx : 0);
    setGalleryVisible(true);
  };

  const thumbUri = (photo: PublicPropertyPreview['photos'][number]) =>
    photo.thumb_url ||
    publicShareService.getPublicFileUrl(shareToken, photo.file, 'thumb');

  return (
    <ScreenContainer includeBottomSafeArea>
      <PRGHeader title="Shared property" showBack={false} />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <Text style={{ color: colors.textSecondary }}>Loading…</Text>
        ) : error || !preview ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              Link unavailable
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {error || 'This share link is invalid, expired, or revoked.'}
            </Text>
            <PRGButton
              title="Go to Renter Guardian"
              onPress={() => router.replace('/welcome')}
              style={styles.button}
            />
          </>
        ) : (
          <>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              Shared preview · no account needed
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              {preview.property.display_name}
            </Text>
            {preview.property.status ? (
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {getPropertyStatusLabel(preview.property.status)}
              </Text>
            ) : null}
            {formatAddress(preview.property) ? (
              <Text style={[styles.address, { color: colors.textSecondary }]}>
                {formatAddress(preview.property)}
              </Text>
            ) : null}
            {preview.property.listing_url ? (
              <Pressable
                onPress={() => {
                  void Linking.openURL(String(preview.property.listing_url));
                }}
              >
                <Text style={[styles.link, { color: colors.primary }]}>
                  Open listing
                </Text>
              </Pressable>
            ) : null}

            <Text style={[styles.section, { color: colors.text }]}>Spaces</Text>
            {(preview.spaces || []).length === 0 ? (
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                No spaces listed yet.
              </Text>
            ) : (
              preview.spaces.map((space) => {
                const spacePhotos = photosBySpace[space.id] || [];
                return (
                  <View
                    key={space.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      {space.display_name}
                    </Text>
                    <Text
                      style={[styles.meta, { color: colors.textSecondary }]}
                    >
                      {getSpaceTypeLabel(
                        space.space_type as any,
                        space.custom_space_type || undefined
                      )}
                      {spacePhotos.length
                        ? ` · ${spacePhotos.length} photo${spacePhotos.length === 1 ? '' : 's'}`
                        : ''}
                    </Text>
                    {spacePhotos.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.photoRow}
                      >
                        {spacePhotos.map((photo) => (
                          <Pressable
                            key={photo.id}
                            onPress={() => openGallery(spacePhotos, photo)}
                            accessibilityRole="imagebutton"
                            accessibilityLabel="Open photo"
                          >
                            <Image
                              source={{ uri: thumbUri(photo) }}
                              style={[
                                styles.thumb,
                                { backgroundColor: colors.backgroundTertiary },
                              ]}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              recyclingKey={photo.id}
                            />
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : null}
                  </View>
                );
              })
            )}

            {(photosBySpace._unassigned || []).length > 0 ? (
              <>
                <Text style={[styles.section, { color: colors.text }]}>
                  Other photos
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoRow}
                >
                  {photosBySpace._unassigned.map((photo) => (
                    <Pressable
                      key={photo.id}
                      onPress={() =>
                        openGallery(photosBySpace._unassigned, photo)
                      }
                      accessibilityRole="imagebutton"
                      accessibilityLabel="Open photo"
                    >
                      <Image
                        source={{ uri: thumbUri(photo) }}
                        style={[
                          styles.thumb,
                          { backgroundColor: colors.backgroundTertiary },
                        ]}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={photo.id}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <View
              style={[
                styles.ctaCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Want to collaborate?
              </Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                Sign in to Renter Guardian to manage properties, invite
                roommates, and run inspections.
              </Text>
              <PRGButton
                title="Get started"
                onPress={() => router.push('/(auth)/signup')}
                style={styles.button}
              />
              <PRGButton
                title="Sign in"
                onPress={() => router.push('/(auth)/login')}
                variant="ghost"
              />
            </View>
          </>
        )}
      </ScrollView>

      <PRGPhotoGallery
        visible={galleryVisible}
        photos={galleryPhotos}
        initialIndex={galleryIndex}
        onClose={() => setGalleryVisible(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.xs,
  },
  address: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  meta: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  link: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.md,
  },
  section: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  photoRow: {
    marginTop: spacing.sm,
  },
  thumb: {
    width: 112,
    height: 112,
    borderRadius: 10,
    marginRight: 2,
  },
  ctaCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  button: {
    marginTop: spacing.sm,
  },
});
