import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { ResponsiveGridList } from '../components/ResponsiveGridList';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getBackgroundLogsAsync, BackgroundTaskLog, BackgroundLogCategory } from '../storage';
import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import { t } from '../i18n';

type SectionKey = BackgroundLogCategory;

/** Minimum duration (ms) to show the refresh spinner so users can see it. */
const MIN_REFRESH_MS = 600;

/** Group reminder log entries by calendar day (YYYY-MM-DD in local time). */
function groupByDay(entries: BackgroundTaskLog[]): { day: string; items: BackgroundTaskLog[] }[] {
  const map = new Map<string, BackgroundTaskLog[]>();
  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  // Return newest days first
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, items]) => ({ day, items }));
}

/** Format a unix timestamp as HH:MM local time. */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Format a YYYY-MM-DD key as a human-readable date. */
function formatDayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  // Use explicit year/month/day args so the Date is always in local time
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ActivityLogScreen() {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const locale = useAppStore((state) => state.locale);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const navigation = useNavigation();

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav_activity_log') });
  }, [navigation, locale]);

  const [hcLogs, setHcLogs] = useState<BackgroundTaskLog[]>([]);
  const [gpsLogs, setGpsLogs] = useState<BackgroundTaskLog[]>([]);
  const [reminderLogs, setReminderLogs] = useState<BackgroundTaskLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Exactly one top-level section open at a time (null = all closed)
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);

  // For reminders: exactly one day expanded at a time (null = all closed)
  const [openReminderDay, setOpenReminderDay] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const loadLogs = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const [hc, gps, reminder] = await Promise.all([
        getBackgroundLogsAsync('health_connect'),
        getBackgroundLogsAsync('gps'),
        getBackgroundLogsAsync('reminder'),
      ]);
      setHcLogs(hc);
      setGpsLogs(gps);
      setReminderLogs(reminder);
    } catch (error) {
      console.error('[ActivityLogScreen.loadLogs] Error:', error);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, MIN_REFRESH_MS));
    await Promise.all([loadLogs(), minDelay]);
    setRefreshing(false);
  }, [loadLogs]);

  const toggleSection = (key: SectionKey) => {
    setOpenSection((prev) => (prev === key ? null : key));
    setOpenReminderDay(null);
  };

  const toggleReminderDay = (day: string) => {
    setOpenReminderDay((prev) => (prev === day ? null : day));
  };

  const reminderDayGroups = useMemo(() => groupByDay(reminderLogs), [reminderLogs]);

  const SECTIONS = [
    { id: 'health_connect' as SectionKey, title: t('activity_log_section_hc'), icon: 'fitness-outline', data: hcLogs },
    { id: 'gps' as SectionKey, title: t('activity_log_section_gps'), icon: 'location-outline', data: gpsLogs },
    { id: 'reminder' as SectionKey, title: t('activity_log_section_reminders'), icon: 'notifications-outline', data: reminderLogs },
  ];

  const renderSection = ({ item }: { item: typeof SECTIONS[0] }) => {
    if (item.id === 'reminder') {
      return (
        <View>
          <SectionHeader
            title={item.title}
            icon={item.icon as any}
            isOpen={openSection === item.id}
            count={item.data.length}
            onPress={() => toggleSection(item.id)}
            colors={colors}
            styles={styles}
          />
          {openSection === item.id && (
            <View style={styles.logCard}>
              {!isLoading && reminderDayGroups.length === 0 ? (
                <Text style={styles.emptyText}>{t('activity_log_empty')}</Text>
              ) : (
                reminderDayGroups.map(({ day, items: reminderItems }, idx) => (
                  <View key={day}>
                    {idx > 0 && <View style={styles.dayDivider} />}
                    <TouchableOpacity
                      style={styles.dayHeader}
                      onPress={() => toggleReminderDay(day)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dayLabel}>{formatDayLabel(day)}</Text>
                      <Ionicons
                        name={openReminderDay === day ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                    {openReminderDay === day &&
                      reminderItems.map((entry) => (
                        <LogRow key={entry.id} entry={entry} styles={styles} indented />
                      ))}
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      );
    }

    return (
      <View>
        <SectionHeader
          title={item.title}
          icon={item.icon as any}
          isOpen={openSection === item.id}
          count={item.data.length}
          onPress={() => toggleSection(item.id)}
          colors={colors}
          styles={styles}
        />
        {openSection === item.id && (
          <View style={styles.logCard}>
            {!isLoading && item.data.length === 0 ? (
              <Text style={styles.emptyText}>{t('activity_log_empty')}</Text>
            ) : (
              item.data.map((entry) => <LogRow key={entry.id} entry={entry} styles={styles} />)
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <ResponsiveGridList
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.grass} />
      }
      data={SECTIONS}
      keyExtractor={(item) => item.id}
      renderItem={renderSection}
    />
  );
}

// ── Sub-components ────────────────────────────────────────

function SectionHeader({
  title,
  icon,
  isOpen,
  count,
  onPress,
  colors,
  styles,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  isOpen: boolean;
  count: number;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <TouchableOpacity
      style={[styles.sectionHeader, isOpen && styles.sectionHeaderOpen]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.sectionHeaderLeft}>
        <Ionicons name={icon} size={20} color={isOpen ? colors.grass : colors.textSecondary} />
        <Text style={[styles.sectionTitle, isOpen && styles.sectionTitleOpen]}>{title}</Text>
      </View>
      <View style={styles.sectionHeaderRight}>
        {count > 0 && <Text style={styles.countBadge}>{count}</Text>}
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </View>
    </TouchableOpacity>
  );
}

function LogRow({
  entry,
  styles,
  indented = false,
}: {
  entry: BackgroundTaskLog;
  styles: ReturnType<typeof makeStyles>;
  indented?: boolean;
}) {
  return (
    <View style={[styles.logRow, indented && styles.logRowIndented]}>
      <Text style={styles.logTime}>{formatTime(entry.timestamp)}</Text>
      <Text style={styles.logMessage}>{entry.message}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────

function makeStyles(colors: ThemeColors, shadows: Shadows) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.mist,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginBottom: spacing.xs,
      ...shadows.soft,
    },
    sectionHeaderOpen: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      marginBottom: 0,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    sectionTitleOpen: {
      color: colors.grass,
    },
    sectionHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    countBadge: {
      fontSize: 12,
      color: colors.textMuted,
    },

    logCard: {
      backgroundColor: colors.card,
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      ...shadows.soft,
    },

    logRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: spacing.xs,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.fog,
    },
    logRowIndented: {
      paddingLeft: spacing.md,
    },
    logTime: {
      fontSize: 12,
      color: colors.textMuted,
      fontVariant: ['tabular-nums'],
      minWidth: 38,
      paddingTop: 1,
    },
    logMessage: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },

    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    dayLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    dayDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.fog,
      marginVertical: spacing.xs,
    },
  });
}
