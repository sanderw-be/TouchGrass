import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, StatusBar,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ManualSessionSheet from '../components/ManualSessionSheet';
import ProgressRing from '../components/ProgressRing';
import {
  getTodayMinutes, getWeekMinutes,
  getCurrentDailyGoal, getCurrentWeeklyGoal,
  getSessionsForDay,
} from '../storage/database';
import { colors, spacing, radius, shadows, formatMinutes } from '../utils/theme';

export default function HomeScreen() {
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(30);
  const [weeklyTarget, setWeeklyTarget] = useState(150);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const loadData = useCallback(() => {
    setTodayMinutes(getTodayMinutes());
    setWeekMinutes(getWeekMinutes());
    setDailyTarget(getCurrentDailyGoal()?.targetMinutes ?? 30);
    setWeeklyTarget(getCurrentWeeklyGoal()?.targetMinutes ?? 150);
    setTodaySessions(getSessionsForDay(Date.now()));
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  const dailyPercent = Math.min(todayMinutes / dailyTarget, 1);
  const weeklyPercent = Math.min(weekMinutes / weeklyTarget, 1);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning 🌱';
    if (h < 17) return 'Good afternoon ☀️';
    return 'Good evening 🌙';
  };

  const motivationText = () => {
    if (dailyPercent >= 1) return "Goal reached! Nice work getting outside today.";
    const remaining = dailyTarget - todayMinutes;
    if (dailyPercent === 0) return `${formatMinutes(dailyTarget)} of outside time awaits today.`;
    return `${formatMinutes(remaining)} more to hit your daily goal.`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.grass} />}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.mist} />

      <ManualSessionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSessionLogged={loadData}
      />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setSheetVisible(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Main progress ring */}
      <View style={styles.ringCard}>
        <ProgressRing
          current={todayMinutes}
          target={dailyTarget}
          size={200}
          strokeWidth={16}
          label="today"
        />
        <Text style={styles.motivation}>{motivationText()}</Text>
      </View>

      {/* Weekly strip */}
      <View style={styles.weekCard}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekTitle}>This week</Text>
          <Text style={styles.weekValue}>
            {formatMinutes(weekMinutes)} <Text style={styles.weekOf}>/ {formatMinutes(weeklyTarget)}</Text>
          </Text>
        </View>
        <View style={styles.weekBar}>
          <View style={[styles.weekBarFill, { width: `${weeklyPercent * 100}%` }]} />
        </View>
        <WeekDots />
      </View>

      {/* Today's sessions */}
      {todaySessions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's sessions</Text>
          {todaySessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </View>
      )}

      {todaySessions.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🌿</Text>
          <Text style={styles.emptyText}>No outside time recorded yet today.</Text>
          <Text style={styles.emptySubtext}>Head out or log it manually!</Text>
        </View>
      )}
    </ScrollView>
  );
}

function WeekDots() {
  const today = new Date().getDay();
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // Monday-first index
  const todayMon = (today + 6) % 7;

  return (
    <View style={styles.weekDots}>
      {days.map((d, i) => (
        <View key={i} style={styles.dotWrapper}>
          <View style={[
            styles.dot,
            i < todayMon && styles.dotPast,
            i === todayMon && styles.dotToday,
          ]} />
          <Text style={[styles.dotLabel, i === todayMon && styles.dotLabelToday]}>{d}</Text>
        </View>
      ))}
    </View>
  );
}

function SessionRow({ session }: { session: any }) {
  const sourceIcon: Record<string, string> = {
    health_connect: '👟',
    gps: '📍',
    manual: '✏️',
    timeline: '🗓️',
  };

  return (
    <View style={styles.sessionRow}>
      <Text style={styles.sessionIcon}>{sourceIcon[session.source] ?? '🌿'}</Text>
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionTime}>
          {formatTime(session.startTime)} – {formatTime(session.endTime)}
        </Text>
        <Text style={styles.sessionDuration}>{formatMinutes(session.durationMinutes)}</Text>
      </View>
      {session.userConfirmed === null && (
        <View style={styles.reviewBadge}>
          <Text style={styles.reviewText}>review</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.mist },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  header: { marginBottom: spacing.lg, marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 26, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  date: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grass,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    ...shadows.soft,
  },
  addBtnText: { fontSize: 24, color: colors.textInverse, lineHeight: 30, fontWeight: '300' },

  ringCard: {
    backgroundColor: colors.textInverse,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  motivation: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  weekCard: {
    backgroundColor: colors.textInverse,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  weekTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  weekValue: { fontSize: 18, fontWeight: '700', color: colors.grass },
  weekOf: { fontSize: 13, fontWeight: '400', color: colors.textMuted },
  weekBar: {
    height: 6,
    backgroundColor: colors.fog,
    borderRadius: radius.full,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  weekBarFill: {
    height: '100%',
    backgroundColor: colors.grass,
    borderRadius: radius.full,
  },
  weekDots: { flexDirection: 'row', justifyContent: 'space-between' },
  dotWrapper: { alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.fog },
  dotPast: { backgroundColor: colors.grassLight },
  dotToday: { backgroundColor: colors.grass, width: 14, height: 14, borderRadius: 7 },
  dotLabel: { fontSize: 10, color: colors.textMuted },
  dotLabelToday: { color: colors.grass, fontWeight: '700' },

  section: { marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.textInverse,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.soft,
  },
  sessionIcon: { fontSize: 20, marginRight: spacing.sm },
  sessionInfo: { flex: 1 },
  sessionTime: { fontSize: 14, color: colors.textSecondary },
  sessionDuration: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  reviewBadge: {
    backgroundColor: colors.grassPale,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  reviewText: { fontSize: 11, color: colors.grass, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textSecondary, fontWeight: '500' },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
});
