import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Modal } from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';

interface PRGLoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number; // 0-100
}

export const PRGLoadingOverlay: React.FC<PRGLoadingOverlayProps> = ({
  visible,
  message,
  progress,
}) => {
  const { colors } = useTheme();
  
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          {message && <Text style={[styles.message, { color: colors.text }]}>{message}</Text>}
          {progress !== undefined && (
            <View style={[styles.progressContainer, { backgroundColor: colors.border }]}>
              <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: colors.primary }]} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 200,
  },
  message: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
});


