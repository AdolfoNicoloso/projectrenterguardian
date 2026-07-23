import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import { PRGButton } from './PRGButton';
import { PRGInput } from './PRGInput';

export type PhotoCaptureNotesResult = {
  notes: string;
  skipped: boolean;
};

type Phase = 'notes' | 'submitting' | 'done';

export type PhotoCaptureNotesSheetProps = {
  visible: boolean;
  /** Local preview URI from the camera capture. */
  previewUri?: string | null;
  title?: string;
  /** Called after the user confirms notes (or skips). Parent should upload. */
  onSubmit: (result: PhotoCaptureNotesResult) => Promise<void>;
  /** Dismiss without uploading (notes phase only). */
  onCancel: () => void;
  /** Called after submit + short confirmation; parent should clear pending capture. */
  onFinished?: () => void;
};

/**
 * Post-capture notes prompt used during tours/inspections.
 * Flow: take photo → enter notes (optional) → confirm submit while upload runs.
 */
export const PhotoCaptureNotesSheet: React.FC<PhotoCaptureNotesSheetProps> = ({
  visible,
  previewUri,
  title = 'Add a quick note',
  onSubmit,
  onCancel,
  onFinished,
}) => {
  const { colors } = useTheme();
  const [notes, setNotes] = useState('');
  const [phase, setPhase] = useState<Phase>('notes');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setNotes('');
      setPhase('notes');
      setError('');
    }
  }, [visible]);

  if (!visible) return null;

  const finish = async (skipped: boolean) => {
    setError('');
    setPhase('submitting');
    try {
      await onSubmit({ notes: skipped ? '' : notes.trim(), skipped });
      setPhase('done');
      // Brief confirmation beat so the flow feels intentional, not abrupt.
      await new Promise((r) => setTimeout(r, 700));
      onFinished?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not save this photo';
      setError(message);
      setPhase('notes');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={phase === 'notes' ? onCancel : undefined}
      accessibilityViewIsModal
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        {phase === 'notes' ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        ) : null}
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="summary"
          accessibilityLabel={title}
        >
          {phase === 'notes' ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                Add an optional first note while the photo uploads. You can add
                more notes later — each one is saved with your name and a
                timestamp.
              </Text>
              {previewUri ? (
                <Image
                  source={{ uri: previewUri }}
                  style={[styles.preview, { backgroundColor: colors.backgroundSecondary }]}
                  resizeMode="cover"
                  accessibilityLabel="Captured photo preview"
                />
              ) : null}
              <PRGInput
                label="Notes (optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g., scuff on baseboard, strong odor…"
                multiline
                numberOfLines={3}
                style={styles.notesInput}
              />
              <Text style={[styles.hint, { color: colors.textTertiary }]}>
                Tip: you can write many notes and edit them later on the photo.
              </Text>
              {error ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              ) : null}
              <View style={styles.actions}>
                <PRGButton
                  title="Skip notes"
                  onPress={() => finish(true)}
                  variant="ghost"
                  style={styles.actionButton}
                  accessibilityLabel="Skip notes and submit photo"
                />
                <PRGButton
                  title="Save photo"
                  onPress={() => finish(false)}
                  variant="primary"
                  style={styles.actionButton}
                  accessibilityLabel="Save photo with notes"
                />
              </View>
            </>
          ) : null}

          {phase === 'submitting' ? (
            <View style={styles.statusBlock}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[styles.statusTitle, { color: colors.text }]}>
                Submitting photo…
              </Text>
              <Text style={[styles.message, { color: colors.textSecondary, textAlign: 'center' }]}>
                Hang tight — uploading your capture
                {notes.trim() ? ' and notes' : ''}.
              </Text>
            </View>
          ) : null}

          {phase === 'done' ? (
            <View style={styles.statusBlock}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>Photo submitted</Text>
              <Text style={[styles.message, { color: colors.textSecondary, textAlign: 'center' }]}>
                Saved to this inspection.
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.lg,
    zIndex: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  notesInput: {
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    minWidth: 110,
    flexGrow: 0,
  },
  statusBlock: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  statusTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginTop: spacing.sm,
  },
});
