import type { Property } from '../../types';

export type PropertyHubMode = 'rents' | 'tours';

export type ToursListFilter = 'scheduled' | 'toured' | 'applied';

export const TOURS_FILTER_TAGS: Array<{ id: ToursListFilter; label: string }> = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'toured', label: 'Toured' },
  { id: 'applied', label: 'Applied' },
];

export type PropertyHubHomeProps = {
  mode: PropertyHubMode;
};

export type PropertyHubCardProps = {
  property: Property;
  /** Rents hub: plain status text (e.g. Active / Shared). */
  statusLabel?: string;
  /**
   * Tours hub: single combined stage badge
   * (Applied | Scheduled | Toured | Likely toured | Ready to tour).
   */
  stageLabel?: string;
  stageVariant?: 'success' | 'warning' | 'default';
  /** Optional datetime shown beside the Tours stage badge. */
  stageDetail?: string;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
  onOpen: () => void;
  /** Tighter card for desktop grid cells. */
  compact?: boolean;
};

export type AddPropertyCardProps = {
  onPress: () => void;
};
