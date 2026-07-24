import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
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
  calendarPartsFromIso,
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

/** Editable display string for the text field (local calendar). */
function toEditableText(iso: string | null, dateOnly: boolean): string {
  if (!iso) return '';
  const date = fromCmsDateTimeIso(iso);
  if (!date) return '';
  if (dateOnly) {
    const parts = calendarPartsFromIso(iso);
    if (parts) {
      return `${pad2(parts.month)}/${pad2(parts.day)}/${parts.year}`;
    }
    return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}/${date.getFullYear()}`;
  }
  return formatDisplayDate(iso, 'datetime');
}

/**
 * Parse typed date (and optional time) into a local Date.
 * Accepts: MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD, and optional time for datetime.
 */
function parseTypedDate(raw: string, dateOnly: boolean): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (dateOnly) {
    // YYYY-MM-DD
    let m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
        if (
          dt.getFullYear() === y &&
          dt.getMonth() === mo - 1 &&
          dt.getDate() === d
        ) {
          return dt;
        }
      }
      return null;
    }
    // MM/DD/YYYY or M/D/YY(YY)
    m = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) {
      const mo = Number(m[1]);
      const d = Number(m[2]);
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
        if (
          dt.getFullYear() === y &&
          dt.getMonth() === mo - 1 &&
          dt.getDate() === d
        ) {
          return dt;
        }
      }
    }
    return null;
  }

  const normalized = trimmed.replace(/\s+/, ' ');
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const dm = normalized.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?$/i
  );
  if (dm) {
    const mo = Number(dm[1]);
    const d = Number(dm[2]);
    let y = Number(dm[3]);
    if (y < 100) y += 2000;
    let h = Number(dm[4]);
    const min = Number(dm[5]);
    const ap = dm[6]?.toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    const dt = new Date(y, mo - 1, d, h, min, 0, 0);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  return null;
}

function withinRange(
  date: Date,
  minDate: Date | undefined,
  maxDate: Date | undefined,
  dateOnly: boolean
): boolean {
  const t = date.getTime();
  if (minDate) {
    const min = new Date(minDate);
    if (dateOnly) min.setHours(0, 0, 0, 0);
    if (t < min.getTime()) return false;
  }
  if (maxDate) {
    const max = new Date(maxDate);
    if (dateOnly) max.setHours(23, 59, 59, 999);
    if (t > max.getTime()) return false;
  }
  return true;
}

/**
 * Cross-platform date/time field: type a date or open the system/browser picker.
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
  const [androidStep, setAndroidStep] = useState<'date' | 'time'>('date');
  const [localSelectedDate, setLocalSelectedDate] = useState<Date | null>(null);
  const [text, setText] = useState(() => toEditableText(valueISO, dateOnly));
  const [parseError, setParseError] = useState<string | null>(null);
  const focusedRef = useRef(false);
  const webNativePickerRef = useRef<HTMLInputElement | null>(null);

  const dateValue = valueISO ? fromCmsDateTimeIso(valueISO) : null;
  const minDate = minimumISO ? fromCmsDateTimeIso(minimumISO) || undefined : undefined;
  const maxDate = maximumISO ? fromCmsDateTimeIso(maximumISO) || undefined : undefined;

  useEffect(() => {
    if (focusedRef.current) return;
    setText(toEditableText(valueISO, dateOnly));
    setParseError(null);
  }, [valueISO, dateOnly]);

  const commitDate = useCallback(
    (selectedDate: Date) => {
      if (!withinRange(selectedDate, minDate, maxDate, dateOnly)) {
        setParseError('Date is outside the allowed range');
        return;
      }
      setParseError(null);
      const iso = toCmsDateTimeIso(selectedDate, { dateOnly });
      onChangeISO(iso);
      setText(toEditableText(iso, dateOnly));
    },
    [onChangeISO, dateOnly, minDate, maxDate]
  );

  const commitTypedText = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        setParseError(null);
        onChangeISO(null);
        setText('');
        return;
      }
      const parsed = parseTypedDate(trimmed, dateOnly);
      if (!parsed) {
        setParseError(
          dateOnly
            ? 'Use MM/DD/YYYY or YYYY-MM-DD'
            : 'Enter a valid date and time'
        );
        setText(toEditableText(valueISO, dateOnly));
        return;
      }
      commitDate(parsed);
    },
    [commitDate, dateOnly, onChangeISO, valueISO]
  );

  const openNativePicker = useCallback(() => {
    if (disabled) return;
    setLocalSelectedDate(dateValue || new Date());
    setAndroidStep('date');
    setShowPicker(true);
  }, [disabled, dateValue]);

  const openPickerWeb = useCallback(() => {
    if (disabled) return;
    const el = webNativePickerRef.current;
    if (el) {
      try {
        if (typeof el.showPicker === 'function') {
          el.showPicker();
          return;
        }
        el.focus();
        el.click();
        return;
      } catch {
        // fall through
      }
    }
    openNativePicker();
  }, [disabled, openNativePicker]);

  const typePlaceholder =
    placeholder || (dateOnly ? 'MM/DD/YYYY' : 'MM/DD/YYYY h:mm');
  const fieldError = error || parseError;

  const closePicker = () => {
    setShowPicker(false);
    setLocalSelectedDate(null);
    setAndroidStep('date');
  };

  const onWebNativeChange = (raw: string) => {
    if (!raw) {
      onChangeISO(null);
      setText('');
      return;
    }
    let parsed: Date;
    if (dateOnly) {
      const [y, m, d] = raw.split('-').map(Number);
      parsed = new Date(y, m - 1, d, 12, 0, 0, 0);
    } else {
      parsed = new Date(raw);
    }
    if (!Number.isNaN(parsed.getTime())) {
      commitDate(parsed);
    }
  };

  const inputRow = (
    <View
      style={[
        styles.inputRow,
        {
          borderColor: fieldError ? colors.error : colors.inputBorder,
          backgroundColor: disabled
            ? colors.backgroundTertiary
            : colors.inputBackground,
        },
        disabled && styles.disabled,
      ]}
    >
      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          if (parseError) setParseError(null);
        }}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          commitTypedText(text);
        }}
        onSubmitEditing={() => commitTypedText(text)}
        editable={!disabled}
        placeholder={typePlaceholder}
        placeholderTextColor={colors.inputPlaceholder}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="done"
        style={[styles.textInput, { color: colors.text }]}
        accessibilityLabel={label || typePlaceholder}
      />
      <TouchableOpacity
        onPress={Platform.OS === 'web' ? openPickerWeb : openNativePicker}
        disabled={disabled}
        style={styles.pickerButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={
          dateOnly ? 'Open date picker' : 'Open date and time picker'
        }
      >
        <Text style={[styles.pickerButtonText, { color: colors.primary }]}>
          Pick
        </Text>
      </TouchableOpacity>
      {Platform.OS === 'web'
        ? React.createElement('input', {
            ref: (node: HTMLInputElement | null) => {
              webNativePickerRef.current = node;
            },
            type: dateOnly ? 'date' : 'datetime-local',
            tabIndex: -1,
            'aria-hidden': true,
            value: dateValue
              ? dateOnly
                ? `${dateValue.getFullYear()}-${pad2(dateValue.getMonth() + 1)}-${pad2(dateValue.getDate())}`
                : `${dateValue.getFullYear()}-${pad2(dateValue.getMonth() + 1)}-${pad2(dateValue.getDate())}T${pad2(dateValue.getHours())}:${pad2(dateValue.getMinutes())}`
              : '',
            min: minDate
              ? `${minDate.getFullYear()}-${pad2(minDate.getMonth() + 1)}-${pad2(minDate.getDate())}`
              : undefined,
            max: maxDate
              ? `${maxDate.getFullYear()}-${pad2(maxDate.getMonth() + 1)}-${pad2(maxDate.getDate())}`
              : undefined,
            onChange: (e: { target: { value: string } }) => {
              onWebNativeChange(e.target.value);
            },
            style: {
              position: 'absolute',
              opacity: 0,
              width: 0,
              height: 0,
              border: 'none',
              pointerEvents: 'none',
            },
          } as any)
        : null}
    </View>
  );

  let androidPicker: React.ReactNode = null;
  let iosPicker: React.ReactNode = null;

  if (Platform.OS === 'android' && showPicker) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const DateTimePicker = require('@react-native-community/datetimepicker').default;
    androidPicker = (
      <DateTimePicker
        key={dateOnly ? 'date' : androidStep}
        value={localSelectedDate || dateValue || new Date()}
        mode={dateOnly || androidStep === 'date' ? 'date' : 'time'}
        display="default"
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
    );
  }

  if (Platform.OS === 'ios' && showPicker) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const DateTimePicker = require('@react-native-community/datetimepicker').default;
    iosPicker = (
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
    );
  }

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      {inputRow}
      {fieldError ? (
        <Text style={[styles.errorText, { color: colors.error }]}>{fieldError}</Text>
      ) : null}
      {androidPicker}
      {iosPicker}
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
  inputRow: {
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  textInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    paddingVertical: spacing.sm,
    minHeight: 44,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  pickerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.xs,
  },
  pickerButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
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
