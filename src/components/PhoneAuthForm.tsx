import React, { createElement, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import type { ConfirmationResult, ApplicationVerifier } from 'firebase/auth';
import { RecaptchaVerifier } from 'firebase/auth';
import { PRGButton } from './PRGButton';
import { PRGInput } from './PRGInput';
import { auth, firebaseApp, firebaseAuth } from '../services/firebase';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';

function normalizePhoneInput(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return digits ? `+${digits}` : '';
}

function mapPhoneAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code?: string }).code || '')
      : '';
  const message =
    typeof err === 'object' && err && 'message' in err
      ? String((err as { message?: string }).message || '')
      : '';

  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That phone number looks invalid. Use country code, e.g. +1…';
    case 'auth/missing-phone-number':
      return 'Enter a phone number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/captcha-check-failed':
      return 'reCAPTCHA check failed. Refresh the page and try again.';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded. Check Firebase billing / quotas.';
    case 'auth/operation-not-allowed':
      return 'Phone sign-in is not enabled in Firebase Console → Authentication → Phone.';
    case 'auth/billing-not-enabled':
      return 'Sending SMS requires the Firebase Blaze (pay-as-you-go) plan.';
    case 'auth/invalid-app-credential':
    case 'auth/argument-error':
      return 'Phone verification failed for this site. Confirm the Hosting domain is in Auth → Authorized domains.';
    default:
      return message || 'Failed to send verification code.';
  }
}

type Props = {
  onSuccess: () => void | Promise<void>;
  onError: (message: string) => void;
};

/**
 * Phone Auth UI: send SMS code + confirm.
 * Web: Firebase RecaptchaVerifier. Native: expo-firebase-recaptcha modal.
 */
export function PhoneAuthForm({ onSuccess, onError }: Props) {
  const { colors } = useTheme();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [useVisibleCaptcha, setUseVisibleCaptcha] = useState(false);
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);
  const webVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      clearWebVerifier();
    };
  }, []);

  const clearWebVerifier = () => {
    if (webVerifierRef.current) {
      try {
        webVerifierRef.current.clear();
      } catch {
        // ignore
      }
      webVerifierRef.current = null;
    }
  };

  const ensureWebVerifier = async (): Promise<ApplicationVerifier> => {
    if (typeof document === 'undefined') {
      throw new Error('Phone sign-in is unavailable in this environment.');
    }
    const el = document.getElementById('prg-phone-recaptcha');
    if (!el) {
      throw new Error('reCAPTCHA container missing. Refresh the page.');
    }
    // Clear previous widget contents so we can re-render cleanly.
    el.innerHTML = '';
    clearWebVerifier();

    webVerifierRef.current = new RecaptchaVerifier(auth, 'prg-phone-recaptcha', {
      size: useVisibleCaptcha ? 'normal' : 'invisible',
      callback: () => undefined,
      'expired-callback': () => {
        clearWebVerifier();
      },
    });
    await webVerifierRef.current.render();
    return webVerifierRef.current;
  };

  const handleSendCode = async () => {
    const e164 = normalizePhoneInput(phone);
    if (!e164 || e164.length < 11) {
      onError('Enter a valid phone number with country code (e.g. +15551234567).');
      return;
    }
    setLoading(true);
    onError('');
    try {
      let verifier: ApplicationVerifier;
      if (Platform.OS === 'web') {
        verifier = await ensureWebVerifier();
      } else {
        const modal = recaptchaRef.current;
        if (!modal) {
          throw new Error('reCAPTCHA is not ready. Try again.');
        }
        verifier = modal as unknown as ApplicationVerifier;
      }
      const result = await firebaseAuth.startPhoneSignIn(e164, verifier);
      setConfirmation(result);
      setStep('code');
    } catch (err: unknown) {
      console.error('Phone send code error:', err);
      clearWebVerifier();
      onError(mapPhoneAuthError(err));
      if (Platform.OS === 'web' && !useVisibleCaptcha) {
        setUseVisibleCaptcha(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmation) {
      onError('Request a code first.');
      return;
    }
    if (!code.trim()) {
      onError('Enter the verification code.');
      return;
    }
    setLoading(true);
    onError('');
    try {
      await firebaseAuth.confirmPhoneCode(confirmation, code.trim());
      await onSuccess();
    } catch (err: unknown) {
      console.error('Phone confirm error:', err);
      onError(mapPhoneAuthError(err) || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const resetToPhone = () => {
    setStep('phone');
    setCode('');
    setConfirmation(null);
    clearWebVerifier();
  };

  return (
    <View style={styles.wrap}>
      {Platform.OS !== 'web' ? (
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaRef}
          firebaseConfig={firebaseApp.options as Record<string, string>}
          attemptInvisibleVerification
        />
      ) : (
        createElement('div', {
          id: 'prg-phone-recaptcha',
          style: {
            display: 'flex',
            justifyContent: 'center',
            minHeight: useVisibleCaptcha ? 78 : 1,
            marginBottom: 8,
          },
        })
      )}

      {step === 'phone' ? (
        <>
          <PRGInput
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 555 5555"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Include country code. Example: +1 for US/Canada.
          </Text>
          <PRGButton
            title="Send code"
            onPress={handleSendCode}
            loading={loading}
            style={styles.button}
          />
          {useVisibleCaptcha ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              If a reCAPTCHA appears above, complete it, then tap Send code again.
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Enter the code sent to {normalizePhoneInput(phone)}. Delivery can take up
            to a minute.
          </Text>
          <PRGInput
            label="Verification code"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
          />
          <PRGButton
            title="Verify & sign in"
            onPress={handleConfirm}
            loading={loading}
            style={styles.button}
          />
          <PRGButton title="Resend code" onPress={resetToPhone} variant="ghost" />
          <PRGButton
            title="Use a different number"
            onPress={resetToPhone}
            variant="ghost"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: spacing.md,
  },
  button: {
    marginTop: spacing.sm,
  },
  hint: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
