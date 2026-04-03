import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Image,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ManualSessionSheet from '../components/ManualSessionSheet';
import ProgressRing from '../components/ProgressRing';
import {
  getTodayMinutes,
  getWeekMinutes,
  getCurrentDailyGoal,
  getCurrentWeeklyGoal,
  getSessionsForDay,
  confirmSession,
  getDailyStreak,
  getWeeklyStreak,
  OutsideSession,
} from '../storage/database';
import { spacing, radius } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { formatMinutes, formatTime } from '../utils/helpers';
import { t, formatLocalDate } from '../i18n';
import { updateTimeSlotProbability } from '../detection/sessionConfidence';
import { startManualSession } from '../detection/manualCheckin';
import { onSessionsChanged, emitSessionsChanged } from '../utils/sessionsChangedEmitter';
import { cancelRemindersIfGoalReached } from '../notifications/notificationManager';

export default function HomeScreen() {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(30);
  const [weeklyTarget, setWeeklyTarget] = useState(150);
  const [todaySessions, setTodaySessions] = useState<OutsideSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [weeklyStreak, setWeeklyStreak] = useState(0);

  // Inline ring timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerStartRef = useRef<number>(0);
  const stopTimerRef = useRef<(() => void) | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(Math.floor((Date.now() - timerStartRef.current) / 1000));
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timerRunning]);

  const loadData = useCallback(() => {
    setTodayMinutes(getTodayMinutes());
    setWeekMinutes(getWeekMinutes());
    setDailyTarget(getCurrentDailyGoal()?.targetMinutes ?? 30);
    setWeeklyTarget(getCurrentWeeklyGoal()?.targetMinutes ?? 150);
    setTodaySessions(getSessionsForDay(Date.now()));
    setDailyStreak(getDailyStreak());
    setWeeklyStreak(getWeeklyStreak());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Refresh whenever background work (e.g. Health Connect sync) inserts new sessions.
  useEffect(() => onSessionsChanged(loadData), [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  const handleConfirm = async (id: number, startTime: number, confirmed: boolean) => {
    confirmSession(id, confirmed);
    const d = new Date(startTime);
    updateTimeSlotProbability(d.getHours(), d.getDay(), confirmed);
    emitSessionsChanged();
    if (confirmed) {
      await cancelRemindersIfGoalReached();
    }
    loadData();
  };

  const handleTimerPress = () => {
    if (timerRunning) {
      // Stop timer — auto-save and refresh
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (stopTimerRef.current) stopTimerRef.current();
      stopTimerRef.current = null;
      setTimerRunning(false);
      setTimerSeconds(0);
      loadData();
    } else {
      // Start timer
      const stop = startManualSession();
      stopTimerRef.current = stop;
      timerStartRef.current = Date.now();
      setTimerSeconds(0);
      setTimerRunning(true);
    }
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.grass} />
      }
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.mist}
      />

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
          <Ionicons name="add" size={24} color={colors.textInverse} />
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
          onTimerPress={handleTimerPress}
          timerRunning={timerRunning}
          timerSeconds={timerSeconds}
        />
        <Text style={styles.motivation}>{motivationText()}</Text>
        {(dailyStreak > 0 || weeklyStreak > 0) && (
          <View style={styles.streakContainer}>
            {dailyStreak > 0 && (
              <Text style={styles.streakText}>
                {t(dailyStreak === 1 ? 'streak_daily_singular' : 'streak_daily_plural', {
                  count: dailyStreak,
                })}
              </Text>
            )}
            {dailyStreak > 0 && weeklyStreak > 0 && (
              <Text style={styles.streakSeparator}>{t('streak_separator')}</Text>
            )}
            {weeklyStreak > 0 && (
              <Text style={styles.streakText}>
                {t(weeklyStreak === 1 ? 'streak_weekly_singular' : 'streak_weekly_plural', {
                  count: weeklyStreak,
                })}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Weekly strip */}
      <View style={styles.weekCard}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekTitle}>{t('this_week')}</Text>
          <Text style={styles.weekValue}>
            {formatMinutes(weekMinutes)}{' '}
            <Text style={styles.weekOf}>
              {t('of')} {formatMinutes(weeklyTarget)}
            </Text>
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
              onConfirm={(confirmed) => handleConfirm(session.id!, session.startTime, confirmed)}
            />
          ))}
        </View>
      )}

      {todaySessions.length === 0 && (
        <View style={styles.emptyState}>
          <Image
            source={require('../../assets/herb.png')}
            style={styles.emptyIcon}
            resizeMode="contain"
          />
          <Text style={styles.emptyText}>{t('no_sessions_title')}</Text>
          <Text style={styles.emptySubtext}>{t('no_sessions_sub')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function WeekDots() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const today = new Date().getDay();
  const days = [
    t('day_mon'),
    t('day_tue'),
    t('day_wed'),
    t('day_thu'),
    t('day_fri'),
    t('day_sat'),
    t('day_sun'),
  ];
  const todayMon = (today + 6) % 7;

  return (
    <View style={styles.weekDots}>
      {days.map((d, i) => (
        <View key={i} style={styles.dotWrapper}>
          <View
            style={[styles.dot, i < todayMon && styles.dotPast, i === todayMon && styles.dotToday]}
          />
          <Text style={[styles.dotLabel, i === todayMon && styles.dotLabelToday]}>{d}</Text>
        </View>
      ))}
    </View>
  );
}

function SessionRow({
  session,
  onConfirm,
}: {
  session: OutsideSession;
  onConfirm: (confirmed: boolean) => void;
}) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const swipeableRef = useRef<Swipeable>(null);
  const isPending = session.userConfirmed === null && session.discarded !== 1;
  const sourceIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
    health_connect: 'fitness-outline',
    gps: 'location-outline',
    manual: 'pencil-outline',
    timeline: 'calendar-outline',
  };

  const renderConfirmAction = () => (
    <TouchableOpacity
      style={[styles.swipeAction, styles.swipeConfirm]}
      onPress={() => {
        swipeableRef.current?.close();
        onConfirm(true);
      }}
      testID="home-swipe-confirm-action"
    >
      <Ionicons name="checkmark" size={24} color={colors.textInverse} />
      <Text style={styles.swipeConfirmLabel}>{t('events_confirm')}</Text>
    </TouchableOpacity>
  );

  const renderRejectAction = () => (
    <TouchableOpacity
      style={[styles.swipeAction, styles.swipeReject]}
      onPress={() => {
        swipeableRef.current?.close();
        onConfirm(false);
      }}
      testID="home-swipe-reject-action"
    >
      <Ionicons name="close" size={24} color={colors.textSecondary} />
      <Text style={styles.swipeRejectLabel}>{t('events_not_outside')}</Text>
    </TouchableOpacity>
  );

  const rowContent = (
    <View style={styles.sessionCard}>
      <View style={styles.sessionRow}>
        <View style={styles.sessionIconContainer}>
          <Ionicons
            name={sourceIcon[session.source] ?? 'leaf-outline'}
            size={20}
            color={isPending ? colors.textMuted : colors.grass}
          />
        </View>
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

      {isPending && (
        <View style={styles.swipeHint} pointerEvents="none" testID="home-swipe-hint">
          <Ionicons name="arrow-back-outline" size={14} color={colors.textMuted} />
          <Text style={styles.swipeHintText}>{t('session_swipe_hint')}</Text>
          <Ionicons name="arrow-forward-outline" size={14} color={colors.textMuted} />
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

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  shadows: ReturnType<typeof useTheme>['shadows']
) {
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
    streakContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
    },
    streakText: {
      fontSize: 13,
      color: colors.grass,
      fontWeight: '600',
    },
    streakSeparator: {
      fontSize: 13,
      color: colors.textMuted,
      marginHorizontal: spacing.xs,
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
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },

    sessionCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      marginBottom: spacing.xs,
      ...shadows.soft,
    },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
    },
    sessionIconContainer: { width: 28, marginRight: spacing.sm, alignItems: 'center' },
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
    swipeConfirmLabel: { fontSize: 11, color: colors.textInverse, fontWeight: '600', marginTop: 2 },
    swipeReject: { backgroundColor: colors.fog },
    swipeRejectLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
      marginTop: 2,
    },

    swipeHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.fog,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    swipeHintText: { fontSize: 12, color: colors.textMuted },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
    emptyIcon: { width: 64, height: 64, marginBottom: spacing.md },
    emptyText: { fontSize: 16, color: colors.textSecondary, fontWeight: '500' },
    emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  });
}
