import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { PRGButton, PRGInput, PRGHeader, DateField, useToast } from '../../../src/components';
import { propertiesService } from '../../../src/services/propertiesService';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import { isRequired } from '../../../src/utils/validation';
import { Routes } from '../../../src/navigation/routes';

export default function CreatePropertyScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [address, setAddress] = useState('');
  const [leaseStartISO, setLeaseStartISO] = useState<string | null>(null);
  const [leaseEndISO, setLeaseEndISO] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [stateCode, setStateCode] = useState('');
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
        lease_start_date: leaseStartISO,
        lease_end_date: leaseEndISO || undefined,
        nickname: nickname || undefined,
        state_code: stateCode || undefined,
      });

      showToast('Property created', 'success');
      // Reset navigation stack: go to Properties list first, then navigate to property detail
      // This ensures back button goes to Properties list instead of creation screen
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PRGHeader title="Create Property" showBack />
    <KeyboardAvoidingView
        style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={Platform.OS === 'web'}>
        <View style={styles.content}>
          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

          <PRGInput
            label="Address *"
            value={address}
            onChangeText={setAddress}
            placeholder="123 Main St, City, State ZIP"
            autoCapitalize="words"
          />

          <DateField
            label="Lease Start Date *"
            valueISO={leaseStartISO}
            onChangeISO={setLeaseStartISO}
            dateOnly={true}
            placeholder="Select lease start date"
          />

          <DateField
            label="Lease End Date"
            valueISO={leaseEndISO}
            onChangeISO={setLeaseEndISO}
            dateOnly={true}
            minimumISO={leaseStartISO || undefined}
            placeholder="Select lease end date (optional)"
          />

          <PRGInput
            label="Nickname"
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g., Downtown Apartment (optional)"
          />

          <PRGInput
            label="State Code"
            value={stateCode}
            onChangeText={setStateCode}
            placeholder="e.g., CA (recommended)"
            autoCapitalize="characters"
            maxLength={2}
          />

          <PRGButton
            title="Create Property"
            onPress={handleCreate}
            loading={loading}
            style={styles.button}
          />

        </View>
      </ScrollView>
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
  scrollContent: {
    padding: spacing.lg,
  },
  content: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  button: {
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});


