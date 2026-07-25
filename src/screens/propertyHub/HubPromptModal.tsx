import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { PRGButton } from '../../components';
import { useTheme } from '../../theme/useTheme';
import { propertyHubStyles as styles } from './propertyHubStyles';

type HubPromptModalProps = {
  visible: boolean;
  title: string;
  body: string;
  primaryLabel: string;
  primaryAccessibilityLabel?: string;
  secondaryLabel?: string;
  secondaryAccessibilityLabel?: string;
  onPrimary: () => void;
  onDismiss: () => void;
};

/**
 * Shared confirm-style modal used by the property hub (finish draft / tour schedule).
 */
export function HubPromptModal({
  visible,
  title,
  body,
  primaryLabel,
  primaryAccessibilityLabel,
  secondaryLabel = 'Not right now',
  secondaryAccessibilityLabel,
  onPrimary,
  onDismiss,
}: HubPromptModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <View style={[styles.promptBackdrop, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View
          style={[
            styles.promptCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.promptTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.promptBody, { color: colors.textSecondary }]}>
            {body}
          </Text>
          <PRGButton
            title={primaryLabel}
            onPress={onPrimary}
            style={styles.promptButton}
            accessibilityLabel={primaryAccessibilityLabel || primaryLabel}
          />
          <PRGButton
            title={secondaryLabel}
            onPress={onDismiss}
            variant="secondary"
            style={styles.promptButton}
            accessibilityLabel={
              secondaryAccessibilityLabel || secondaryLabel
            }
          />
        </View>
      </View>
    </Modal>
  );
}
