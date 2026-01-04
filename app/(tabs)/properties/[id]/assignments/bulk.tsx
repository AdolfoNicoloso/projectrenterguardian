import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PRGButton } from '../../../../../src/components';
import { spacesService } from '../../../../../src/services/spacesService';
import { assignmentsService } from '../../../../../src/services/assignmentsService';
import { colors, spacing, typography } from '../../../../../src/theme';
import type { Space } from '../../../../../src/types';

export default function BulkAssignmentScreen() {
  const { id, photoIds } = useLocalSearchParams<{ id: string; photoIds: string }>();
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  const photoIdList = photoIds?.split(',') || [];

  useEffect(() => {
    loadSpaces();
  }, [id]);

  const loadSpaces = async () => {
    try {
      const data = await spacesService.getSpaces(id!);
      setSpaces(data);
    } catch (error) {
      console.error('Error loading spaces:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedSpace || photoIdList.length === 0) return;

    setAssigning(true);
    try {
      // Create assignments one by one (bulk endpoint not available in service)
      await Promise.all(
        photoIdList.map(photoId => 
          assignmentsService.createAssignment(photoId, selectedSpace)
        )
      );
      router.back();
    } catch (error) {
      console.error('Error assigning photos:', error);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Assign {photoIdList.length} Photo{photoIdList.length > 1 ? 's' : ''}</Text>
      <Text style={styles.subtitle}>Select a space to assign these photos to</Text>

      <View style={styles.spacesList}>
        {spaces.map((space) => (
          <PRGButton
            key={space.id}
            title={space.display_name}
            onPress={() => setSelectedSpace(space.id)}
            variant={selectedSpace === space.id ? 'primary' : 'secondary'}
            style={styles.spaceButton}
          />
        ))}
      </View>

      <PRGButton
        title="Confirm Assignment"
        onPress={handleAssign}
        loading={assigning}
        disabled={!selectedSpace}
        style={styles.button}
      />

      <PRGButton
        title="Cancel"
        onPress={() => router.back()}
        variant="ghost"
        style={styles.button}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.gray[600],
    marginBottom: spacing.xl,
  },
  spacesList: {
    marginBottom: spacing.lg,
  },
  spaceButton: {
    marginBottom: spacing.sm,
  },
  button: {
    marginTop: spacing.md,
  },
});


