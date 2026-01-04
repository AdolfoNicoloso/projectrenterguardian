import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';

interface InspectionCTA_BannerProps {
  onPress: () => void;
  onDismiss: () => void;
}

export const InspectionCTA_Banner: React.FC<InspectionCTA_BannerProps> = ({ onPress, onDismiss }) => {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(150)).current; // Start off-screen (150 pixels down)

  useEffect(() => {
    // Entrance animation: slide up
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, []);

  const handleDismiss = () => {
    // Exit animation: slide down (increased distance for smoother exit)
    Animated.timing(slideAnim, {
      toValue: 150,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      // Call onDismiss after animation completes
      onDismiss();
    });
  };

  const shadowStyle = Platform.OS === 'web' 
    ? { boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.15)' as any }
    : {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
      };

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: colors.primary },
        shadowStyle,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={handleDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.dismissButtonText, { color: colors.textInverse }]}>×</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.content}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.bannerText, { color: colors.textInverse }]}>
          Are you ready for your first inspection?
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    padding: spacing.lg,
    borderRadius: 8,
    position: 'relative',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 32, // Space for dismiss button
  },
  bannerText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
  },
  dismissButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dismissButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
    textAlign: 'center',
  },
});

