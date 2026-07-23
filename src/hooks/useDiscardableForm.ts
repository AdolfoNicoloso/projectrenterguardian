import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

export type DiscardConfirmOptions = {
  title?: string;
  message?: string;
  keepEditingLabel?: string;
  discardLabel?: string;
};

const DEFAULT_OPTIONS: Required<DiscardConfirmOptions> = {
  title: 'Discard changes?',
  message: 'You have unsaved changes. If you leave now, they will be lost.',
  keepEditingLabel: 'Keep editing',
  discardLabel: 'Discard',
};

/**
 * Tracks dirty form state and presents a platform-appropriate discard confirmation.
 * Use for create/edit flows where Cancel must not create orphaned records.
 */
export function useDiscardableForm(isDirty: boolean, options?: DiscardConfirmOptions) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [confirmVisible, setConfirmVisible] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const requestLeave = useCallback(
    (onConfirmLeave: () => void) => {
      if (!isDirty) {
        onConfirmLeave();
        return;
      }

      // Web: controlled dialog for keyboard + a11y
      if (Platform.OS === 'web') {
        pendingActionRef.current = onConfirmLeave;
        setConfirmVisible(true);
        return;
      }

      Alert.alert(opts.title, opts.message, [
        { text: opts.keepEditingLabel, style: 'cancel' },
        {
          text: opts.discardLabel,
          style: 'destructive',
          onPress: onConfirmLeave,
        },
      ]);
    },
    [isDirty, opts.discardLabel, opts.keepEditingLabel, opts.message, opts.title]
  );

  const keepEditing = useCallback(() => {
    pendingActionRef.current = null;
    setConfirmVisible(false);
  }, []);

  const confirmDiscard = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setConfirmVisible(false);
    action?.();
  }, []);

  return useMemo(
    () => ({
      isDirty,
      requestLeave,
      confirmVisible,
      keepEditing,
      confirmDiscard,
      confirmTitle: opts.title,
      confirmMessage: opts.message,
      keepEditingLabel: opts.keepEditingLabel,
      discardLabel: opts.discardLabel,
    }),
    [
      confirmDiscard,
      confirmVisible,
      isDirty,
      keepEditing,
      opts.discardLabel,
      opts.keepEditingLabel,
      opts.message,
      opts.title,
      requestLeave,
    ]
  );
}
