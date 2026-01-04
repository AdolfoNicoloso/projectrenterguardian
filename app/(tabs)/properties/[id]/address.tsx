import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PRGButton, PRGInput, PRGHeader, useToast, ScrollableScreenContainer } from '../../../../src/components';
import { propertiesService } from '../../../../src/services/propertiesService';
import { spacing, typography } from '../../../../src/theme';
import { useTheme } from '../../../../src/theme/useTheme';

export default function PropertyAddressEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadProperty = async () => {
      if (!id) return;
      try {
        setInitialLoading(true);
        const property = await propertiesService.getProperty(id);
        setStreet(property.street || '');
        setUnit(property.unit || '');
        setCity(property.city || '');
        setStateCode(property.state_code || '');
        setZip(property.zip?.toString() || '');
      } catch (err: any) {
        setError(err.message || 'Failed to load property');
        showToast('Failed to load property', 'error');
      } finally {
        setInitialLoading(false);
      }
    };
    loadProperty();
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    
    // Basic validation
    if (!street.trim()) {
      setError('Street address is required');
      return;
    }
    if (!city.trim()) {
      setError('City is required');
      return;
    }
    if (!stateCode.trim()) {
      setError('State code is required');
      return;
    }
    if (!zip.trim()) {
      setError('ZIP code is required');
      return;
    }
    if (stateCode.length !== 2) {
      setError('State code must be 2 characters');
      return;
    }
    const zipNum = parseInt(zip, 10);
    if (isNaN(zipNum) || zipNum <= 0) {
      setError('ZIP code must be a valid number');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Construct address_free_text from components
      const addressParts = [
        street.trim(),
        unit.trim() ? `Unit ${unit.trim()}` : null,
        `${city.trim()}, ${stateCode.trim().toUpperCase()} ${zipNum}`,
      ].filter(Boolean);
      const addressFreeText = addressParts.join(', ');

      await propertiesService.updateProperty(id, {
        street: street.trim(),
        unit: unit.trim() || undefined,
        city: city.trim(),
        state_code: stateCode.trim().toUpperCase(),
        zip: zipNum,
        address_free_text: addressFreeText, // Keep address_free_text in sync
      });
      showToast('Address updated', 'success');
      router.back();
    } catch (err: any) {
      setError(err.message || 'Failed to update address');
      showToast('Failed to update address', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <PRGHeader title="Edit Address" showBack />
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.text }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader title="Edit Address" showBack />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollableScreenContainer
          includeTopSafeArea={false}
          includeBottomSafeArea={true}
          horizontalPadding={spacing.lg}
          topPadding={spacing.md}
          bottomPadding={spacing.xl}
          style={{ backgroundColor: 'transparent' }}
        >
          <View style={styles.content}>
            {error ? (
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            ) : null}

            <PRGInput
              label="Street *"
              value={street}
              onChangeText={setStreet}
              placeholder="123 Main St"
              autoCapitalize="words"
              style={styles.input}
            />

            <PRGInput
              label="Unit"
              value={unit}
              onChangeText={setUnit}
              placeholder="Unit 4 (optional)"
              autoCapitalize="words"
              style={styles.input}
            />

            <PRGInput
              label="City *"
              value={city}
              onChangeText={setCity}
              placeholder="City"
              autoCapitalize="words"
              style={styles.input}
            />

            <PRGInput
              label="State *"
              value={stateCode}
              onChangeText={setStateCode}
              placeholder="CA"
              autoCapitalize="characters"
              maxLength={2}
              style={styles.input}
            />

            <PRGInput
              label="ZIP *"
              value={zip}
              onChangeText={setZip}
              placeholder="12345"
              keyboardType="numeric"
              maxLength={5}
              style={styles.input}
            />

            <PRGButton
              title="Save Address"
              onPress={handleSave}
              loading={loading}
              style={styles.button}
            />
          </View>
        </ScrollableScreenContainer>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  input: {
    marginBottom: spacing.sm,
  },
  button: {
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});


