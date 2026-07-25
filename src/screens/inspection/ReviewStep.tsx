import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { PRGButton, PRGInput } from '../../components';
import {
  getInspectionTypeCopy,
  getInspectionTypeLabel,
} from '../../constants/inspectionTypes';
import { propertyDisplayName } from '../../constants/propertyStatuses';
import { useTheme } from '../../theme/useTheme';
import type { Inspection, Property, Space } from '../../types';
import { countInspectionSnapshot } from '../../utils/inspectionSnapshot';
import { styles } from './wizardStyles';

export function ReviewStep({
  inspection,
  property,
  spaces,
  payload,
  onContinue,
  saving,
}: {
  inspection: Inspection;
  property: Property | null;
  spaces: Space[];
  payload: {
    photo_ids?: string[];
    spaces_data?: Record<string, { photo_ids?: string[]; notes?: string }>;
    space_ids_in_scope?: string[];
    user_summary_notes?: string;
  };
  onContinue: (notes: string) => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const [notes, setNotes] = useState(payload.user_summary_notes || '');
  const copy = getInspectionTypeCopy(inspection.inspection_type);

  const counts = countInspectionSnapshot({
    photo_ids: payload.photo_ids || [],
    spaces_data: payload.spaces_data || {},
    space_ids_in_scope: payload.space_ids_in_scope || [],
    user_summary_notes: notes,
  });
  const spacesData = payload.spaces_data || {};

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Review</Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        {copy.reviewBody}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Type: {getInspectionTypeLabel(inspection.inspection_type)}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Property: {property ? propertyDisplayName(property) : '—'}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Spaces: {counts.spaces_count}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Overview Photos: {counts.overview_photos_count}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Space Photos: {counts.space_photos_count}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Total Photos: {counts.total_photos_count}
      </Text>
      <Text style={[styles.reviewItem, { color: colors.text }]}>
        Notes: {counts.notes_count}
        {notes.trim() ? ' (includes summary)' : ''}
      </Text>
      {spaces.length > 0 && (
        <View style={[styles.spaceReviewList, { backgroundColor: colors.backgroundSecondary }]}>
          {spaces.map((space) => {
            const spacePhotoCount = spacesData[space.id]?.photo_ids?.length || 0;
            const spaceNotes = spacesData[space.id]?.notes?.trim();
            return (
              <Text key={space.id} style={[styles.spaceReviewItem, { color: colors.text }]}>
                {space.display_name}: {spacePhotoCount} photo
                {spacePhotoCount !== 1 ? 's' : ''}
                {spaceNotes ? ' · notes' : ''}
              </Text>
            );
          })}
        </View>
      )}
      <PRGInput
        label="Summary Notes (Optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        placeholder="Add any additional notes about this inspection..."
        style={styles.notesInput}
      />
      <Text style={[styles.notesHint, { color: colors.textTertiary }]}>
        You can add more detailed notes on each photo and space — those are
        timestamped with who wrote them and can be edited later.
      </Text>
      <PRGButton
        title="Complete Inspection"
        onPress={() => onContinue(notes)}
        variant="primary"
        loading={saving}
        style={styles.continueButton}
      />
    </View>
  );
}
