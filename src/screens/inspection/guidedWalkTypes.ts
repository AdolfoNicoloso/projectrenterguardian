export type WalkPhase = 'pick' | 'capture' | 'ask_next';

export type SpacesData = Record<string, { photo_ids: string[]; notes?: string }>;

export type WalkPayload = {
  space_ids_in_scope?: string[];
  spaces_data?: SpacesData;
  /** When 'existing', auto-queue existing spaces (like move-out). 'pick' forces choose-first. */
  space_walk?: 'existing' | 'pick';
  walk?: {
    current_space_id?: string | null;
    completed_space_ids?: string[];
    phase?: WalkPhase;
  };
};

export function isMoveOut(type?: string | null) {
  return (type || '').toLowerCase() === 'move_out';
}
