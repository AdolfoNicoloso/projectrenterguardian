import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { spacing, typography } from '../../theme';
import { toDirectusDatetimeISO, fromDirectusDatetimeISO, formatDisplayDate } from '../../utils/directusDate';

interface DateFieldProps {
  valueISO: string | null;
  onChangeISO: (iso: string | null) => void;
  label?: string;
  minimumISO?: string;
  maximumISO?: string;
  disabled?: boolean;
  dateOnly?: boolean; // Default true for lease dates
  error?: string;
  placeholder?: string;
}

/**
 * Cross-platform DateField component that always outputs ISO 8601 datetime strings.
 * - Native (iOS/Android): Uses @react-native-community/datetimepicker
 * - Web: Uses Flatpickr
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
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [showPicker, setShowPicker] = useState(false);
  // Local state to track the selected date while picker is open (iOS only)
  const [localSelectedDate, setLocalSelectedDate] = useState<Date | null>(null);

  // Convert ISO to Date for picker
  const dateValue = valueISO ? fromDirectusDatetimeISO(valueISO) : null;
  
  // Convert min/max ISO to Date
  const minDate = minimumISO ? fromDirectusDatetimeISO(minimumISO) : undefined;
  const maxDate = maximumISO ? fromDirectusDatetimeISO(maximumISO) : undefined;

  // Display text
  const displayText = valueISO 
    ? formatDisplayDate(valueISO, dateOnly ? 'date' : 'datetime')
    : placeholder || 'Select a date';

  const handleDateChange = useCallback((selectedDate: Date | undefined) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (!selectedDate) {
      onChangeISO(null);
      return;
    }

    // Convert Date to ISO using our helper
    const isoString = toDirectusDatetimeISO(selectedDate, { dateOnly });
    onChangeISO(isoString);
  }, [onChangeISO, dateOnly]);

  const handlePress = useCallback(() => {
    if (!disabled) {
      // Initialize local state with current value when opening picker
      // If no existing value, default to today's date (what the picker will show)
      setLocalSelectedDate(dateValue || new Date());
      setShowPicker(true);
    }
  }, [disabled, dateValue]);

  // Native date picker implementation (iOS/Android)
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const DateTimePicker = require('@react-native-community/datetimepicker').default;

    return (
      <View style={styles.container}>
        {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
        <TouchableOpacity
          onPress={handlePress}
          disabled={disabled}
          style={[
            styles.input,
            {
              borderColor: error ? colors.error : colors.inputBorder,
              backgroundColor: disabled ? colors.backgroundTertiary : colors.inputBackground,
            },
            disabled && styles.disabled,
          ]}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.inputText,
              {
                color: valueISO ? colors.text : colors.inputPlaceholder,
              },
            ]}
          >
            {displayText}
          </Text>
        </TouchableOpacity>
        {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
        
        {showPicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={dateValue || new Date()}
            mode={dateOnly ? 'date' : 'datetime'}
            display="default"
            onChange={(event: any, selectedDate?: Date) => {
              handleDateChange(selectedDate);
            }}
            minimumDate={minDate}
            maximumDate={maxDate}
            disabled={disabled}
          />
        )}

        {Platform.OS === 'ios' && showPicker && (
          <Modal
            transparent
            visible={showPicker}
            animationType="slide"
            onRequestClose={() => setShowPicker(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => {
                // Cancel - don't commit changes, just close
                setShowPicker(false);
                setLocalSelectedDate(null);
              }}
            >
              <View 
                style={[
                  styles.modalContent, 
                  { 
                    backgroundColor: colors.card,
                    paddingBottom: insets.bottom + spacing.md,
                  }
                ]}
                onStartShouldSetResponder={() => true}
              >
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity 
                    onPress={() => {
                      // Cancel - don't commit changes, just close
                      setShowPicker(false);
                      setLocalSelectedDate(null);
                    }}
                  >
                    <Text style={[styles.modalButton, { color: colors.primary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Select Date</Text>
                  <TouchableOpacity
                    onPress={() => {
                      // Commit the selected date when Done is pressed
                      // localSelectedDate is always initialized to a value (either dateValue or new Date())
                      handleDateChange(localSelectedDate || new Date());
                      setShowPicker(false);
                    }}
                  >
                    <Text style={[styles.modalButton, { color: colors.primary }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={localSelectedDate || dateValue || new Date()}
                  mode={dateOnly ? 'date' : 'datetime'}
                  display="spinner"
                  onChange={(event: any, selectedDate?: Date) => {
                    // On iOS, update local state as user scrolls
                    if (selectedDate) {
                      setLocalSelectedDate(selectedDate);
                    }
                  }}
                  minimumDate={minDate}
                  maximumDate={maxDate}
                  style={styles.picker}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </View>
    );
  }

  // Web implementation - use Flatpickr
  const flatpickrRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Use require for Flatpickr (works better with Metro bundler)
      // Flatpickr must be installed: npm install flatpickr
      let flatpickr: any;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        flatpickr = require('flatpickr');
        // Load Flatpickr CSS
        if (typeof document !== 'undefined' && !document.getElementById('flatpickr-css')) {
        const link = document.createElement('link');
        link.id = 'flatpickr-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
        document.head.appendChild(link);
      }
      
        // Inject custom styles to match app typography
        // Update styles when theme changes
        const updateFlatpickrStyles = () => {
          let styleElement = document.getElementById('flatpickr-custom-styles') as HTMLStyleElement;
          if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'flatpickr-custom-styles';
            document.head.appendChild(styleElement);
          }
          
          const bgColor = isDark ? colors.background : colors.background;
          const textColor = isDark ? colors.text : colors.text;
          const borderColor = isDark ? colors.border : colors.border;
          const selectedBgColor = colors.primary;
          const selectedTextColor = '#FFFFFF';
          const hoverBgColor = isDark ? colors.backgroundSecondary : colors.backgroundSecondary;
          
          styleElement.textContent = `
            .flatpickr-calendar {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              font-size: ${typography.fontSize.base}px;
              line-height: ${typography.lineHeight.normal};
              background: ${bgColor};
              color: ${textColor};
              border-color: ${borderColor};
            }
            .flatpickr-months {
              font-size: ${typography.fontSize.base}px;
            }
            .flatpickr-month {
              font-size: ${typography.fontSize.base}px;
            }
            .flatpickr-current-month {
              font-size: ${typography.fontSize.base}px;
              font-weight: ${typography.fontWeight.medium};
              color: ${textColor};
            }
            .flatpickr-prev-month,
            .flatpickr-next-month {
              color: ${textColor};
            }
            .flatpickr-prev-month:hover,
            .flatpickr-next-month:hover {
              color: ${colors.primary};
            }
            .flatpickr-weekday {
              font-size: ${typography.fontSize.sm}px;
              font-weight: ${typography.fontWeight.medium};
              color: ${colors.textSecondary};
            }
            .flatpickr-day {
              font-size: ${typography.fontSize.base}px;
              font-weight: ${typography.fontWeight.regular};
              color: ${textColor};
            }
            .flatpickr-day:hover {
              background: ${hoverBgColor};
              border-color: ${hoverBgColor};
            }
            .flatpickr-day.selected,
            .flatpickr-day.startRange,
            .flatpickr-day.endRange {
              background: ${selectedBgColor};
              border-color: ${selectedBgColor};
              color: ${selectedTextColor};
              font-weight: ${typography.fontWeight.medium};
            }
            .flatpickr-day.today {
              border-color: ${colors.primary};
            }
            .flatpickr-time {
              font-size: ${typography.fontSize.base}px;
              border-top-color: ${borderColor};
            }
            .flatpickr-time input {
              font-size: ${typography.fontSize.base}px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: ${textColor};
            }
            .flatpickr-time .flatpickr-time-separator {
              color: ${textColor};
            }
          `;
        };
        
        updateFlatpickrStyles();
      } catch (error) {
        console.error('Error loading Flatpickr. Make sure it is installed: npm install flatpickr', error);
        return;
      }

      if (inputRef.current && !flatpickrRef.current && flatpickr && flatpickr.default) {
        const fp = flatpickr.default(inputRef.current, {
          dateFormat: dateOnly ? 'Y-m-d' : 'Y-m-d H:i',
          enableTime: !dateOnly,
          time_24hr: true,
          minDate: minDate || undefined,
          maxDate: maxDate || undefined,
          clickOpens: !disabled, // Disable opening when disabled
          disableMobile: true, // Force Flatpickr UI on mobile browsers
          onChange: (selectedDates: Date[]) => {
            if (selectedDates.length > 0) {
              const date = selectedDates[0];
              const isoString = toDirectusDatetimeISO(date, { dateOnly });
              onChangeISO(isoString);
            } else {
              onChangeISO(null);
            }
          },
        });
        flatpickrRef.current = fp;
        
        // Set disabled state on the input element
        if (inputRef.current) {
          inputRef.current.disabled = disabled;
        }
      }

      return () => {
        if (flatpickrRef.current && typeof flatpickrRef.current.destroy === 'function') {
          try {
            flatpickrRef.current.destroy();
          } catch (error) {
            console.error('Error destroying Flatpickr:', error);
          }
          flatpickrRef.current = null;
        }
      };
      
      updateFlatpickrStyles();
    }
  }, [isDark, colors, typography]); // Re-run when theme changes

  // Update Flatpickr when props change
  useEffect(() => {
    if (Platform.OS === 'web' && flatpickrRef.current && inputRef.current) {
      try {
        // Update date
        if (dateValue) {
          flatpickrRef.current.setDate(dateValue, false); // false = don't trigger onChange
        } else if (flatpickrRef.current.clear && typeof flatpickrRef.current.clear === 'function') {
          flatpickrRef.current.clear(false);
        }

        // Update min/max
        flatpickrRef.current.set('minDate', minDate || undefined);
        flatpickrRef.current.set('maxDate', maxDate || undefined);
        flatpickrRef.current.set('clickOpens', !disabled);
        
        // Update disabled state on input
        inputRef.current.disabled = disabled;
      } catch (error) {
        console.error('Error updating Flatpickr:', error);
      }
    }
  }, [dateValue, minDate, maxDate, disabled, dateOnly]);

  // Web implementation
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
        <View
          ref={wrapperRef}
          style={[
            styles.input,
            {
              borderColor: error ? colors.error : colors.inputBorder,
              backgroundColor: disabled ? colors.backgroundTertiary : colors.inputBackground,
            },
            disabled && styles.disabled,
          ]}
        >
          {/* Input element for Flatpickr - created using React.createElement for web */}
          {React.createElement('input', {
            ref: inputRef,
            type: 'text',
            readOnly: true,
            disabled: disabled,
            placeholder: placeholder || 'Select a date',
            value: displayText,
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
            },
          } as any)}
        </View>
        {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
      </View>
    );
  }

  // This should never be reached since we check Platform.OS !== 'web' above
  return null;
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
