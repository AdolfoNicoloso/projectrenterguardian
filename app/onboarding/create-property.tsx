import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGButton, PRGInput, ScrollableScreenContainer, DateField, useToast } from '../../src/components';
import { propertiesService } from '../../src/services/propertiesService';
import { spacing, typography } from '../../src/theme';
import { useTheme } from '../../src/theme/useTheme';
import { isRequired } from '../../src/utils/validation';
import { Routes } from '../../src/navigation/routes';

export default function CreateFirstPropertyScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [address, setAddress] = useState('');
  const [leaseStartISO, setLeaseStartISO] = useState<string | null>(null);
  const [leaseEndISO, setLeaseEndISO] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!isRequired(address) || !isRequired(leaseStartISO)) {
      setError('Address and lease start date are required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const property = await propertiesService.createProperty({
        address_free_text: address,
        lease_start_date: leaseStartISO!, // Validated above, so safe to assert
        lease_end_date: leaseEndISO || undefined,
        nickname: nickname || undefined,
      });

      showToast('Property created', 'success');
      // Reset navigation stack: go to Properties list first, then navigate to property detail
      // This ensures back button goes to Properties list instead of creation screens
      router.replace(Routes.PROPERTIES.LIST);
      router.push(Routes.PROPERTIES.DETAIL(property.id));
    } catch (err: any) {
      setError(err.message || 'Failed to create property');
      showToast('Failed to create property', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollableScreenContainer
        includeBottomSafeArea={true}
        horizontalPadding={spacing.lg}
        topPadding={spacing.xl}
        bottomPadding={spacing.xl}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={Platform.OS === 'web'}
      >
        <View style={styles.content}>
          <Text style={[styles.prompt, { color: colors.text }]}>
            Tell us about the rental property
          </Text>

          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

          <PRGInput
            label="Address *"
            value={address}
            onChangeText={setAddress}
            placeholder="123 Main St, Unit 4, City, State ZIP"
            autoCapitalize="words"
            style={styles.input}
          />

          <View style={styles.input}>
            <DateField
              label="Lease Start Date *"
              valueISO={leaseStartISO}
              onChangeISO={setLeaseStartISO}
              dateOnly={true}
              placeholder="Select lease start date"
            />
          </View>

          <View style={styles.input}>
            <DateField
              label="Lease End Date"
              valueISO={leaseEndISO}
              onChangeISO={setLeaseEndISO}
              dateOnly={true}
              minimumISO={leaseStartISO || undefined}
              placeholder="Select lease end date (optional)"
            />
          </View>

          <PRGInput
            label="Nickname"
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g., Downtown Apartment (optional)"
            style={styles.input}
          />

          <PRGButton
            title="Create Property"
            onPress={handleCreate}
            loading={loading}
            style={styles.button}
          />
        </View>
      </ScrollableScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  prompt: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  input: {
    marginBottom: 2.5,
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
});

