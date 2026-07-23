import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  PRGBadge,
  PRGCard,
  PRGEmptyState,
  PRGHeader,
  ScreenContainer,
} from '../../../src/components';
import { usePropertiesList } from '../../../src/hooks/usePropertiesQuery';
import { Routes } from '../../../src/navigation/routes';
import { spacing, typography } from '../../../src/theme';
import { useTheme } from '../../../src/theme/useTheme';
import type { Property } from '../../../src/types';
import { formatDisplayDate } from '../../../src/utils/cmsDateTime';
import {
  getTourScheduleBucket,
  hasTourScheduledAt,
  localDayKeyFromDate,
  tourLocalDayKey,
} from '../../../src/utils/tourSchedule';
import {
  isTouringPropertyStatus,
  propertyDisplayName,
} from '../../../src/constants/propertyStatuses';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type CalendarCell = {
  date: Date;
  inMonth: boolean;
  dayKey: string;
};

function buildMonthCells(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const startPad = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, 1 - (startPad - i));
    cells.push({ date: d, inMonth: false, dayKey: localDayKeyFromDate(d) });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    cells.push({ date: d, inMonth: true, dayKey: localDayKeyFromDate(d) });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ date: d, inMonth: false, dayKey: localDayKeyFromDate(d) });
  }
  return cells;
}

function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export default function ToursCalendarScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: properties, isInitialLoading } = usePropertiesList();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDayKey, setSelectedDayKey] = useState(() =>
    localDayKeyFromDate(today)
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  const touringWithSchedule = useMemo(
    () =>
      properties.filter(
        (p) => isTouringPropertyStatus(p.status) && hasTourScheduledAt(p)
      ),
    [properties]
  );

  const toursByDay = useMemo(() => {
    const map = new Map<string, Property[]>();
    for (const property of touringWithSchedule) {
      const key = tourLocalDayKey(property.tour_scheduled_at);
      if (!key) continue;
      const list = map.get(key) || [];
      list.push(property);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const aTime = Date.parse(a.tour_scheduled_at || '') || 0;
        const bTime = Date.parse(b.tour_scheduled_at || '') || 0;
        return aTime - bTime;
      });
    }
    return map;
  }, [touringWithSchedule]);

  const selectedTours = toursByDay.get(selectedDayKey) || [];
  const todayKey = localDayKeyFromDate(today);
  const unscheduledCount = useMemo(
    () =>
      properties.filter(
        (p) =>
          isTouringPropertyStatus(p.status) && !hasTourScheduledAt(p)
      ).length,
    [properties]
  );

  const shiftMonth = (delta: number) => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const selectedLabel = useMemo(() => {
    const [y, m, d] = selectedDayKey.split('-').map(Number);
    if (!y || !m || !d) return selectedDayKey;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDayKey]);

  return (
    <ScreenContainer includeTopSafeArea={false} includeBottomSafeArea={false} horizontalPadding={0}>
      <PRGHeader title="Tour calendar" showBack />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => shiftMonth(-1)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={styles.navButton}
          >
            <Text style={[styles.navChevron, { color: colors.primary }]}>‹</Text>
          </Pressable>
          <Text style={[styles.monthTitle, { color: colors.text }]}>
            {monthTitle(year, month)}
          </Text>
          <Pressable
            onPress={() => shiftMonth(1)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={styles.navButton}
          >
            <Text style={[styles.navChevron, { color: colors.primary }]}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((label) => (
            <Text
              key={label}
              style={[styles.weekday, { color: colors.textTertiary }]}
            >
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((cell) => {
            const count = toursByDay.get(cell.dayKey)?.length || 0;
            const selected = cell.dayKey === selectedDayKey;
            const isToday = cell.dayKey === todayKey;
            return (
              <Pressable
                key={cell.dayKey + String(cell.inMonth)}
                onPress={() => setSelectedDayKey(cell.dayKey)}
                style={[
                  styles.dayCell,
                  selected && {
                    backgroundColor: colors.primary + '18',
                    borderColor: colors.primary,
                  },
                  !selected && { borderColor: 'transparent' },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${cell.dayKey}${count ? `, ${count} tour${count === 1 ? '' : 's'}` : ''}`}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    {
                      color: !cell.inMonth
                        ? colors.textTertiary
                        : selected
                          ? colors.primary
                          : colors.text,
                      fontWeight:
                        selected || isToday
                          ? typography.fontWeight.bold
                          : typography.fontWeight.regular,
                    },
                  ]}
                >
                  {cell.date.getDate()}
                </Text>
                {count > 0 ? (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: cell.inMonth
                          ? colors.primary
                          : colors.textTertiary,
                      },
                    ]}
                  />
                ) : (
                  <View style={styles.dotPlaceholder} />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.dayHeading, { color: colors.text }]}>
          {selectedLabel}
        </Text>

        {isInitialLoading && touringWithSchedule.length === 0 ? (
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading tours…
          </Text>
        ) : selectedTours.length === 0 ? (
          <PRGEmptyState
            title="No tours this day"
            message="Scheduled tours for this date will show up here."
          />
        ) : (
          selectedTours.map((property) => {
            const bucket = getTourScheduleBucket(property);
            const badgeLabel =
              bucket === 'toured' ? 'Toured' : 'Scheduled';
            const badgeVariant = bucket === 'toured' ? 'default' : 'success';
            return (
              <PRGCard
                key={property.id}
                onPress={() =>
                  router.push(Routes.PROPERTIES.DETAIL(property.id))
                }
                style={styles.tourCard}
              >
                <View style={styles.tourCardHeader}>
                  <PRGBadge label={badgeLabel} variant={badgeVariant} />
                  <Text
                    style={[styles.tourTime, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {formatDisplayDate(property.tour_scheduled_at, 'datetime')}
                  </Text>
                </View>
                <Text style={[styles.tourTitle, { color: colors.text }]}>
                  {propertyDisplayName(property)}
                </Text>
                {property.nickname ? (
                  <Text
                    style={[styles.tourAddress, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {property.address_free_text}
                  </Text>
                ) : null}
              </PRGCard>
            );
          })
        )}

        {unscheduledCount > 0 ? (
          <Text style={[styles.unscheduledNote, { color: colors.textTertiary }]}>
            {unscheduledCount} touring propert
            {unscheduledCount === 1 ? 'y has' : 'ies have'} no scheduled time yet.
          </Text>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navChevron: {
    fontSize: 32,
    fontWeight: typography.fontWeight.medium,
    lineHeight: 36,
  },
  monthTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    fontWeight: typography.fontWeight.semibold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: spacing.xs,
  },
  dayNumber: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  dotPlaceholder: {
    width: 6,
    height: 6,
    marginTop: 4,
  },
  dayHeading: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
  },
  tourCard: {
    marginBottom: spacing.sm,
  },
  tourCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  tourTime: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    flexShrink: 1,
  },
  tourTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.medium,
  },
  tourAddress: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    marginTop: spacing.xs,
  },
  unscheduledNote: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
});
