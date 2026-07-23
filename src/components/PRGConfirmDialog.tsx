import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import { PRGButton } from './PRGButton';

export type PRGConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Cross-platform confirm dialog used on web (and optionally native)
 * when Alert.alert is insufficient for keyboard/accessibility control.
 *
 * Backdrop dismiss uses a sibling Pressable (not a parent of the action
 * buttons) so web does not nest <button> inside <button>.
 */
export const PRGConfirmDialog: React.FC<PRGConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
        />
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="summary"
          accessibilityLabel={title}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

          <View style={styles.actions}>
            <PRGButton
              title={cancelLabel}
              onPress={onCancel}
              variant="ghost"
              style={styles.actionButton}
              accessibilityLabel={cancelLabel}
            />
            <PRGButton
              title={confirmLabel}
              onPress={onConfirm}
              variant={destructive ? 'danger' : 'primary'}
              style={styles.actionButton}
              accessibilityLabel={confirmLabel}
            />
          </View>
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
    maxWidth: 400,
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
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  actionButton: {
    minWidth: 120,
    flexGrow: 0,
  },
});
