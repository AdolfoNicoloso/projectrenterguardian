import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/useTheme';
import { PRGInput } from './PRGInput';
import { PRGButton } from './PRGButton';
import type { NoteEntry } from '../types';
import {
  createLocalNoteEntry,
  formatNoteMeta,
  sortNotesChronological,
} from '../utils/notes';

export type NotesListEditorProps = {
  entries: NoteEntry[];
  onChange: (entries: NoteEntry[]) => void;
  /** Display name used when adding/editing locally before server re-stamp. */
  currentUserName?: string;
  editable?: boolean;
  label?: string;
  placeholder?: string;
  /** Optional async persist after each add/edit (e.g. space detail). */
  onPersist?: (entries: NoteEntry[]) => Promise<void>;
};

/**
 * Multi-note editor: compose box + chronological bullet list with author/time.
 */
export const NotesListEditor: React.FC<NotesListEditorProps> = ({
  entries,
  onChange,
  currentUserName = 'You',
  editable = true,
  label = 'Notes',
  placeholder = 'Write a note…',
  onPersist,
}) => {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);

  const sorted = sortNotesChronological(entries);

  useEffect(() => {
    if (!editingId) return;
    if (!entries.some((e) => e.id === editingId)) {
      setEditingId(null);
      setEditBody('');
    }
  }, [entries, editingId]);

  const commit = async (next: NoteEntry[]) => {
    const ordered = sortNotesChronological(next);
    onChange(ordered);
    if (!onPersist) return;
    setSaving(true);
    try {
      await onPersist(ordered);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const body = draft.trim();
    if (!body || !editable || saving) return;
    setDraft('');
    await commit([...entries, createLocalNoteEntry(body, currentUserName)]);
  };

  const startEdit = (entry: NoteEntry) => {
    if (!editable) return;
    setEditingId(entry.id);
    setEditBody(entry.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody('');
  };

  const saveEdit = async () => {
    if (!editingId || !editable || saving) return;
    const body = editBody.trim();
    if (!body) return;
    const next = entries.map((e) =>
      e.id === editingId
        ? {
            ...e,
            body,
            updated_at: new Date().toISOString(),
            updated_by_name: currentUserName,
          }
        : e
    );
    setEditingId(null);
    setEditBody('');
    await commit(next);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.helper, { color: colors.textTertiary }]}>
        Add as many notes as you need. Each note is saved with your name and a
        timestamp — you can edit them later.
      </Text>

      {editable ? (
        <View style={styles.compose}>
          <PRGInput
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            multiline
            numberOfLines={3}
            style={styles.composeInput}
            editable={!saving}
          />
          <PRGButton
            title="Add note"
            onPress={handleAdd}
            variant="secondary"
            disabled={!draft.trim() || saving}
            loading={saving && !editingId}
            style={styles.addButton}
            accessibilityLabel="Add note"
          />
        </View>
      ) : null}

      {sorted.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>
          No notes yet.
        </Text>
      ) : (
        <View style={styles.list}>
          {sorted.map((entry) => {
            const isEditing = editingId === entry.id;
            return (
              <View
                key={entry.id}
                style={[styles.item, { borderBottomColor: colors.border }]}
              >
                {isEditing ? (
                  <View>
                    <PRGInput
                      value={editBody}
                      onChangeText={setEditBody}
                      multiline
                      numberOfLines={3}
                      style={styles.composeInput}
                      editable={!saving}
                    />
                    <View style={styles.editActions}>
                      <PRGButton
                        title="Cancel"
                        onPress={cancelEdit}
                        variant="ghost"
                        disabled={saving}
                        style={styles.editActionButton}
                      />
                      <PRGButton
                        title="Save"
                        onPress={saveEdit}
                        variant="primary"
                        disabled={!editBody.trim() || saving}
                        loading={saving}
                        style={styles.editActionButton}
                      />
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => startEdit(entry)}
                    disabled={!editable}
                    accessibilityRole={editable ? 'button' : undefined}
                    accessibilityLabel={
                      editable ? 'Edit note' : undefined
                    }
                  >
                    <Text style={[styles.bulletBody, { color: colors.text }]}>
                      {'\u2022 '}
                      {entry.body}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textTertiary }]}>
                      {formatNoteMeta(entry)}
                    </Text>
                    {editable ? (
                      <Text style={[styles.editHint, { color: colors.primary }]}>
                        Tap to edit
                      </Text>
                    ) : null}
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  helper: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  compose: {
    marginBottom: spacing.md,
  },
  composeInput: {
    marginBottom: spacing.sm,
  },
  addButton: {
    alignSelf: 'flex-end',
    minWidth: 120,
  },
  empty: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    fontStyle: 'italic',
  },
  list: {
    marginTop: spacing.xs,
  },
  item: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bulletBody: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 22,
  },
  meta: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.xs,
  },
  editHint: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  editActionButton: {
    minWidth: 88,
  },
});
