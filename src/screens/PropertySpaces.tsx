import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { PRGCard, PRGBadge, PRGEmptyState, PRGButton } from '../components';
import { spacesService } from '../services/spacesService';
import { photosService } from '../services/photosService';
import { colors, spacing, typography } from '../theme';
import type { Space } from '../types';

interface PropertySpacesProps {
  propertyId: string;
}

export const PropertySpaces: React.FC<PropertySpacesProps> = ({ propertyId }) => {
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpaces();
  }, [propertyId]);

  // Refetch spaces when screen comes into focus (e.g., after creating/editing spaces)
  useFocusEffect(
    useCallback(() => {
      loadSpaces();
    }, [propertyId])
  );

  const loadSpaces = async () => {
    try {
      const data = await spacesService.getSpaces(propertyId);
      setSpaces(data);
      
      // Load photo counts for each space
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
  };

  const getPhotoCount = (spaceId: string) => {
    return photoCounts[spaceId] || 0;
  };

  if (loading && spaces.length === 0) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <PRGButton
          title="Add Space"
          onPress={() => router.push(`/(tabs)/properties/${propertyId}/spaces/create`)}
          variant="primary"
        />
      </View>
      {spaces.length === 0 ? (
        <PRGEmptyState
          title="No Spaces"
          message="Add spaces to organize photos by room or area"
          actionLabel="Add Space"
          onAction={() => router.push(`/(tabs)/properties/${propertyId}/spaces/create`)}
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
                  <Text style={styles.spaceName}>{item.display_name}</Text>
                  <PRGBadge
                    label={item.space_type.replace('_', ' ')}
                    variant="default"
                    style={styles.badge}
                  />
                </View>
                <Text style={styles.photoCount}>
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
    backgroundColor: colors.gray[50],
  },
  header: {
    padding: spacing.md,
    backgroundColor: colors.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
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
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  badge: {
    marginTop: spacing.xs,
  },
  photoCount: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
});


