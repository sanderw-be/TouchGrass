import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, StatusBar,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useFocusEffect } from '@react-navigation/native';
import ManualSessionSheet from '../components/ManualSessionSheet';
import ProgressRing from '../components/ProgressRing';
import {
  getTodayMinutes, getWeekMinutes,
  getCurrentDailyGoal, getCurrentWeeklyGoal,
  getSessionsForDay, confirmSession,
} from '../storage/database';
import { spacing, radius, shadows } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { formatMinutes, formatTime } from '../utils/helpers';
import { t, formatLocalDate } from '../i18n';
import { updateTimeSlotProbability } from '../detection/sessionConfidence';

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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

  const handleConfirm = (id: number, startTime: number, confirmed: boolean) => {
    confirmSession(id, confirmed);
    const d = new Date(startTime);
    updateTimeSlotProbability(d.getHours(), d.getDay(), confirmed);
    loadData();
  };

  const dailyPercent = Math.min(todayMinutes / dailyTarget, 1);
  const weeklyPercent = Math.min(weekMinutes / weeklyTarget, 1);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('greeting_morning');
    if (h < 17) return t('greeting_afternoon');
    return t('greeting_evening');
  };

  const motivationText = () => {
    if (dailyPercent >= 1) return t('goal_reached');
    const remaining = dailyTarget - todayMinutes;
    if (dailyPercent === 0) return t('outside_time_awaits', { amount: formatMinutes(dailyTarget) });
    return t('remaining_for_goal', { amount: formatMinutes(remaining) });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.grass} />}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.mist} />

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
            {formatLocalDate(Date.now(), { weekday: 'long', month: 'long', day: 'numeric' })}
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
          label={t('today')}
        />
        <Text style={styles.motivation}>{motivationText()}</Text>
      </View>

      {/* Weekly strip */}
      <View style={styles.weekCard}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekTitle}>{t('this_week')}</Text>
          <Text style={styles.weekValue}>
            {formatMinutes(weekMinutes)}{' '}
            <Text style={styles.weekOf}>{t('of')} {formatMinutes(weeklyTarget)}</Text>
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
          <Text style={styles.sectionTitle}>{t('todays_sessions')}</Text>
          {todaySessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              onConfirm={(confirmed) => handleConfirm(session.id, session.startTime, confirmed)}
            />
          ))}
        </View>
      )}

      {todaySessions.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🌿</Text>
          <Text style={styles.emptyText}>{t('no_sessions_title')}</Text>
          <Text style={styles.emptySubtext}>{t('no_sessions_sub')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function WeekDots() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const today = new Date().getDay();
  const days = [
    t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'),
    t('day_fri'), t('day_sat'), t('day_sun'),
  ];
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

function SessionRow({ session, onConfirm }: { session: any; onConfirm: (confirmed: boolean) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const swipeableRef = useRef<Swipeable>(null);
  const isPending = session.userConfirmed === null && session.discarded !== 1;
  const sourceIcon: Record<string, string> = {
    health_connect: '👟',
    gps: '📍',
    manual: '✏️',
    timeline: '🗓️',
  };

  const renderConfirmAction = () => (
    <TouchableOpacity
      style={[styles.swipeAction, styles.swipeConfirm]}
      onPress={() => { swipeableRef.current?.close(); onConfirm(true); }}
      testID="home-swipe-confirm-action"
    >
      <Text style={styles.swipeConfirmIcon}>✓</Text>
      <Text style={styles.swipeConfirmLabel}>{t('events_confirm')}</Text>
    </TouchableOpacity>
  );

  const renderRejectAction = () => (
    <TouchableOpacity
      style={[styles.swipeAction, styles.swipeReject]}
      onPress={() => { swipeableRef.current?.close(); onConfirm(false); }}
      testID="home-swipe-reject-action"
    >
      <Text style={styles.swipeRejectIcon}>✕</Text>
      <Text style={styles.swipeRejectLabel}>{t('events_not_outside')}</Text>
    </TouchableOpacity>
  );

  const rowContent = (
    <View style={styles.sessionRow}>
      <Text style={[styles.sessionIcon, isPending && styles.sessionPending]}>
        {sourceIcon[session.source] ?? '🌿'}
      </Text>
      <View style={[styles.sessionInfo, isPending && styles.sessionPending]}>
        <Text style={styles.sessionTime}>
          {formatTime(session.startTime)} – {formatTime(session.endTime)}
        </Text>
        <Text style={styles.sessionDuration}>{formatMinutes(session.durationMinutes)}</Text>
      </View>
      {isPending && (
        <View style={styles.reviewBadge}>
          <Text style={styles.reviewText}>{t('review')}</Text>
        </View>
      )}
    </View>
  );

  if (!isPending) {
    return rowContent;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderConfirmAction}
      renderLeftActions={renderRejectAction}
      onSwipeableOpen={(direction) => {
        // direction 'right' = right panel opened = user swiped left = accept
        // direction 'left' = left panel opened = user swiped right = reject
        if (direction === 'right') {
          onConfirm(true);
        } else {
          onConfirm(false);
        }
      }}
    >
      {rowContent}
    </Swipeable>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.mist },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  header: {
    marginBottom: spacing.lg,
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
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
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
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
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.soft,
  },
  sessionIcon: { fontSize: 20, marginRight: spacing.sm },
  sessionInfo: { flex: 1 },
  sessionPending: { opacity: 0.5 },
  sessionTime: { fontSize: 14, color: colors.textSecondary },
  sessionDuration: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  reviewBadge: {
    backgroundColor: colors.grassPale,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  reviewText: { fontSize: 11, color: colors.grass, fontWeight: '600' },

  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  swipeConfirm: { backgroundColor: colors.grass },
  swipeConfirmIcon: { fontSize: 22, color: colors.textInverse, fontWeight: '700' },
  swipeConfirmLabel: { fontSize: 11, color: colors.textInverse, fontWeight: '600', marginTop: 2 },
  swipeReject: { backgroundColor: colors.fog },
  swipeRejectIcon: { fontSize: 22, color: colors.textSecondary, fontWeight: '700' },
  swipeRejectLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textSecondary, fontWeight: '500' },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  });
}
