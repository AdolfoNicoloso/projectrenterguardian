import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { spacing, typography } from '../../theme';
import {
  toCmsDateTimeIso,
  fromCmsDateTimeIso,
  formatDisplayDate,
} from '../../utils/cmsDateTime';

interface DateFieldProps {
  valueISO: string | null;
  onChangeISO: (iso: string | null) => void;
  label?: string;
  minimumISO?: string;
  maximumISO?: string;
  disabled?: boolean;
  /** Default true for lease dates. False shows date + time. */
  dateOnly?: boolean;
  error?: string;
  placeholder?: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar date for `<input type="date">`. */
function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local date+time for `<input type="datetime-local">`. */
function toDatetimeLocalValue(date: Date): string {
  return `${toDateInputValue(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function minMaxAttr(
  iso: string | undefined,
  dateOnly: boolean
): string | undefined {
  if (!iso) return undefined;
  const d = fromCmsDateTimeIso(iso);
  if (!d) return undefined;
  return dateOnly ? toDateInputValue(d) : toDatetimeLocalValue(d);
}

/**
 * Cross-platform date/time field that always outputs ISO 8601 strings.
 * - iOS/Android: system DateTimePicker (follows device 12/24h setting)
 * - Web: native `<input type="date|datetime-local">` (browser/OS picker)
 */
export const DateField: React.FC<DateFieldProps> = ({
  valueISO,
  onChangeISO,
  label,
  minimumISO,
  maximumISO,
  disabled = false,
  dateOnly = true,
  error,
  placeholder,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [showPicker, setShowPicker] = useState(false);
  /** Android datetime: pick date first, then time. */
  const [androidStep, setAndroidStep] = useState<'date' | 'time'>('date');
  const [localSelectedDate, setLocalSelectedDate] = useState<Date | null>(null);

  const dateValue = valueISO ? fromCmsDateTimeIso(valueISO) : null;
  const minDate = minimumISO ? fromCmsDateTimeIso(minimumISO) : undefined;
  const maxDate = maximumISO ? fromCmsDateTimeIso(maximumISO) : undefined;

  const displayText = valueISO
    ? formatDisplayDate(valueISO, dateOnly ? 'date' : 'datetime')
    : placeholder || (dateOnly ? 'Select a date' : 'Select date and time');

  const commitDate = useCallback(
    (selectedDate: Date) => {
      onChangeISO(toCmsDateTimeIso(selectedDate, { dateOnly }));
    },
    [onChangeISO, dateOnly]
  );

  const handlePress = useCallback(() => {
    if (disabled) return;
    setLocalSelectedDate(dateValue || new Date());
    setAndroidStep('date');
    setShowPicker(true);
  }, [disabled, dateValue]);

  // ——— Native (iOS / Android) ———
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const DateTimePicker = require('@react-native-community/datetimepicker').default;

    const closePicker = () => {
      setShowPicker(false);
      setLocalSelectedDate(null);
      setAndroidStep('date');
    };

    return (
      <View style={styles.container}>
        {label ? (
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        ) : null}
        <TouchableOpacity
          onPress={handlePress}
          disabled={disabled}
          style={[
            styles.input,
            {
              borderColor: error ? colors.error : colors.inputBorder,
              backgroundColor: disabled
                ? colors.backgroundTertiary
                : colors.inputBackground,
            },
            disabled && styles.disabled,
          ]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={label || displayText}
        >
          <Text
            style={[
              styles.inputText,
              { color: valueISO ? colors.text : colors.inputPlaceholder },
            ]}
          >
            {displayText}
          </Text>
        </TouchableOpacity>
        {error ? (
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        ) : null}

        {showPicker && Platform.OS === 'android' ? (
          <DateTimePicker
            // Remount when moving date → time so the system dialog opens again.
            key={dateOnly ? 'date' : androidStep}
            value={localSelectedDate || dateValue || new Date()}
            mode={dateOnly || androidStep === 'date' ? 'date' : 'time'}
            display="default"
            // Omit is24Hour so the picker follows the device 12/24h setting.
            onChange={(event: { type?: string }, selectedDate?: Date) => {
              if (event?.type === 'dismissed') {
                closePicker();
                return;
              }
              if (!selectedDate) {
                closePicker();
                return;
              }

              if (!dateOnly && androidStep === 'date') {
                setLocalSelectedDate(selectedDate);
                // Hide then re-show so Android opens the native time dialog.
                setShowPicker(false);
                setAndroidStep('time');
                setTimeout(() => setShowPicker(true), 50);
                return;
              }

              if (!dateOnly && androidStep === 'time') {
                const base = localSelectedDate || dateValue || new Date();
                const combined = new Date(base);
                combined.setHours(
                  selectedDate.getHours(),
                  selectedDate.getMinutes(),
                  0,
                  0
                );
                commitDate(combined);
                closePicker();
                return;
              }

              commitDate(selectedDate);
              closePicker();
            }}
            minimumDate={androidStep === 'date' ? minDate : undefined}
            maximumDate={androidStep === 'date' ? maxDate : undefined}
          />
        ) : null}

        {Platform.OS === 'ios' && showPicker ? (
          <Modal
            transparent
            visible={showPicker}
            animationType="slide"
            onRequestClose={closePicker}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={closePicker}
            >
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: colors.card,
                    paddingBottom: insets.bottom + spacing.md,
                  },
                ]}
                onStartShouldSetResponder={() => true}
              >
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity onPress={closePicker}>
                    <Text style={[styles.modalButton, { color: colors.primary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {dateOnly ? 'Select Date' : 'Select Date & Time'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      commitDate(localSelectedDate || dateValue || new Date());
                      closePicker();
                    }}
                  >
                    <Text style={[styles.modalButton, { color: colors.primary }]}>
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={localSelectedDate || dateValue || new Date()}
                  mode={dateOnly ? 'date' : 'datetime'}
                  display="spinner"
                  onChange={(_event: unknown, selectedDate?: Date) => {
                    if (selectedDate) setLocalSelectedDate(selectedDate);
                  }}
                  minimumDate={minDate}
                  maximumDate={maxDate}
                  style={styles.picker}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        ) : null}
      </View>
    );
  }

  // ——— Web: browser/OS native date / datetime-local inputs ———
  const nativeInputValue = dateValue
    ? dateOnly
      ? toDateInputValue(dateValue)
      : toDatetimeLocalValue(dateValue)
    : '';

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.input,
          {
            borderColor: error ? colors.error : colors.inputBorder,
            backgroundColor: disabled
              ? colors.backgroundTertiary
              : colors.inputBackground,
          },
          disabled && styles.disabled,
        ]}
      >
        {React.createElement('input', {
          type: dateOnly ? 'date' : 'datetime-local',
          disabled,
          value: nativeInputValue,
          min: minMaxAttr(minimumISO, dateOnly),
          max: minMaxAttr(maximumISO, dateOnly),
          'aria-label': label || placeholder || 'Select date',
          onChange: (e: { target: { value: string } }) => {
            const raw = e.target.value;
            if (!raw) {
              onChangeISO(null);
              return;
            }
            // Parse as local wall time (avoid UTC midnight shift on date-only).
            let parsed: Date;
            if (dateOnly) {
              const [y, m, d] = raw.split('-').map(Number);
              parsed = new Date(y, m - 1, d);
            } else {
              parsed = new Date(raw);
            }
            if (Number.isNaN(parsed.getTime())) {
              return;
            }
            onChangeISO(toCmsDateTimeIso(parsed, { dateOnly }));
          },
          style: {
            width: '100%',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: valueISO ? colors.text : colors.inputPlaceholder,
            fontSize: typography.fontSize.base,
            fontFamily: 'inherit',
            padding: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            colorScheme: 'light dark',
          },
        } as any)}
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  inputText: {
    fontSize: typography.fontSize.base,
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalButton: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  picker: {
    width: '100%',
  },
});
