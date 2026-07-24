import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { PRGCard, PRGBadge, PRGEmptyState, PRGButton } from '../components';
import { spacesService } from '../services/spacesService';
import { photosService } from '../services/photosService';
import { getSpaceTypeLabel } from '../constants/spaceTypes';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import type { Space } from '../types';

interface PropertySpacesProps {
  propertyId: string;
  canEdit?: boolean;
}

export const PropertySpaces: React.FC<PropertySpacesProps> = ({
  propertyId,
  canEdit = true,
}) => {
  const router = useRouter();
  const { colors } = useTheme();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const loadSpaces = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft ?? false;
    try {
      if (!soft) {
        setLoading(true);
      }
      const data = await spacesService.getSpaces(propertyId);
      setSpaces(data);

      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (space) => {
          try {
            const photos = await photosService.getPhotos(propertyId, { spaceId: space.id });
            counts[space.id] = photos.length;
          } catch (error) {
            console.error(`Error loading photos for space ${space.id}:`, error);
            counts[space.id] = 0;
          }
        })
      );
      setPhotoCounts(counts);
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

  const getPhotoCount = (spaceId: string) => {
    return photoCounts[spaceId] || 0;
  };

  if (loading && spaces.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={{ color: colors.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      {canEdit ? (
        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <PRGButton
            title="Add Space"
            onPress={() => router.push(`/(tabs)/properties/${propertyId}/spaces/create`)}
            variant="primary"
          />
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
              ? () => router.push(`/(tabs)/properties/${propertyId}/spaces/create`)
              : undefined
          }
        />
      ) : (
        <FlatList
          data={spaces}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PRGCard
              onPress={() => router.push(`/(tabs)/properties/${propertyId}/spaces/${item.id}`)}
            >
              <View style={styles.spaceRow}>
                <View style={styles.spaceInfo}>
                  <Text style={[styles.spaceName, { color: colors.text }]}>
                    {item.display_name}
                  </Text>
                  <PRGBadge
                    label={getSpaceTypeLabel(item.space_type, item.custom_space_type)}
                    variant="default"
                    style={styles.badge}
                  />
                </View>
                <Text style={[styles.photoCount, { color: colors.textSecondary }]}>
                  {getPhotoCount(item.id)} photos
                </Text>
              </View>
            </PRGCard>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  listContent: {
    padding: spacing.md,
  },
  spaceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spaceInfo: {
    flex: 1,
  },
  spaceName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  badge: {
    marginTop: spacing.xs,
  },
  photoCount: {
    fontSize: typography.fontSize.sm,
  },
});


