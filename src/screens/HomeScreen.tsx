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
  AppState,
  AppStateStatus,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ManualSessionSheet from '../components/ManualSessionSheet';
import ProgressRing from '../components/ProgressRing';
import SessionNotesSheet from '../components/SessionNotesSheet';
import UndoSnackbar from '../components/UndoSnackbar';
import {
  getTodayMinutesAsync,
  getWeekMinutesAsync,
  getCurrentDailyGoalAsync,
  getCurrentWeeklyGoalAsync,
  getSessionsForDayAsync,
  confirmSessionAsync,
  getDailyStreakAsync,
  getWeeklyStreakAsync,
  getSettingAsync,
  setSettingAsync,
  OutsideSession,
} from '../storage';
import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import { formatMinutes, formatTime } from '../utils/helpers';
import { t, formatLocalDate } from '../i18n';
import { updateTimeSlotProbability } from '../detection/sessionConfidence';
import { startManualSession, logManualSession } from '../detection/manualCheckin';
import { onSessionsChanged, emitSessionsChanged } from '../utils/sessionsChangedEmitter';
import { smartReminderScheduler } from '../notifications/notificationManager';
import {
  WIDGET_TIMER_KEY,
  isWidgetTimerRunning,
  requestWidgetRefresh,
} from '../utils/widgetHelper';

import { Card } from '../components/ui';

export default function HomeScreen() {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const isDark = useAppStore((state) => state.isDark);
  useAppStore((state) => state.locale);
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
  const [undoSnackbar, setUndoSnackbar] = useState<{
    visible: boolean;
    sessionId: number | null;
  }>({ visible: false, sessionId: null });
  const [notesSession, setNotesSession] = useState<OutsideSession | null>(null);

  // Inline ring timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerStartRef = useRef<number>(0);
  const stopTimerRef = useRef<(() => void) | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRunningRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    timerRunningRef.current = timerRunning;
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

  const isFetchingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const [todayMin, weekMin, dailyGoal, weeklyGoal, sessions, dStreak, wStreak] =
        await Promise.all([
          getTodayMinutesAsync(),
          getWeekMinutesAsync(),
          getCurrentDailyGoalAsync(),
          getCurrentWeeklyGoalAsync(),
          getSessionsForDayAsync(Date.now()),
          getDailyStreakAsync(),
          getWeeklyStreakAsync(),
        ]);
      setTodayMinutes(todayMin);
      setWeekMinutes(weekMin);
      setDailyTarget(dailyGoal?.targetMinutes ?? 30);
      setWeeklyTarget(weeklyGoal?.targetMinutes ?? 150);
      setTodaySessions(sessions);
      setDailyStreak(dStreak);
      setWeeklyStreak(wStreak);
    } catch (error) {
      console.error('[HomeScreen.loadData] Database error:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  /**
   * Sync the in-app timer state with the widget's SQLite marker.
   *
   * Called on every screen focus and on every app-foreground event so that:
   *  - A timer started from the widget is adopted into the app UI.
   *  - A timer stopped from the widget (while the app had it running) clears
   *    the in-app UI without saving a duplicate session (the widget already
   *    saved the session via logManualSession).
   */
  const syncWidgetTimer = useCallback(async () => {
    try {
      const marker = await getSettingAsync(WIDGET_TIMER_KEY, '');
      const widgetTs = isWidgetTimerRunning(marker) ? parseInt(marker, 10) : 0;

      if (timerRunningRef.current) {
        // Timer is running in the app — check if the widget stopped it.
        if (widgetTs === 0) {
          // Widget cleared the marker: it stopped the timer and already saved the
          // session. Just reset the in-app UI without calling stopTimerRef (which
          // would save a duplicate session).
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          stopTimerRef.current = null;
          setTimerRunning(false);
          setTimerSeconds(0);
          loadData();
        }
        return;
      }

      // Timer is not running in the app — check if the widget started one.
      if (widgetTs > 0) {
        const startTs = widgetTs;
        timerStartRef.current = startTs;
        // Build a stop function that saves the session with the widget's original
        // start time (not Date.now() which would give the wrong duration).
        stopTimerRef.current = () => {
          const endTime = Date.now();
          const durationMinutes = (endTime - startTs) / 60000;
          logManualSession(durationMinutes, startTs, endTime);
        };
        setTimerSeconds(Math.floor((Date.now() - startTs) / 1000));
        setTimerRunning(true);
      }
    } catch (error) {
      console.error('[HomeScreen.syncWidgetTimer] Database error:', error);
      // Fail silently to avoid disrupting timer sync
    }
  }, [loadData]);

  // Sync on every screen-focus event (navigation tab switch, back navigation, etc.)
  useFocusEffect(
    useCallback(() => {
      syncWidgetTimer();
    }, [syncWidgetTimer])
  );

  // Sync when the app comes to the foreground (belt-and-suspenders alongside
  // useFocusEffect, which may not fire if the screen was already focused when
  // the app was backgrounded).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        syncWidgetTimer();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [syncWidgetTimer]);

  // Refresh whenever background work (e.g. Health Connect sync) inserts new sessions.
  useEffect(() => onSessionsChanged(loadData), [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleConfirm = async (id: number, startTime: number, confirmed: boolean) => {
    try {
      await confirmSessionAsync(id, confirmed);
      const d = new Date(startTime);
      await updateTimeSlotProbability(d.getHours(), d.getDay(), confirmed);
      emitSessionsChanged();
      if (confirmed) {
        await smartReminderScheduler.cancelRemindersIfGoalReached();
        requestWidgetRefresh();
      } else {
        setUndoSnackbar({ visible: true, sessionId: id });
      }
      loadData();
    } catch (error) {
      console.error('[HomeScreen.handleConfirm] Error:', error);
    }
  };

  const handleUndoReject = async () => {
    try {
      if (undoSnackbar.sessionId !== null) {
        await confirmSessionAsync(undoSnackbar.sessionId, null);
        emitSessionsChanged();
        loadData();
      }
    } catch (error) {
      console.error('[HomeScreen.handleUndoReject] Error:', error);
    }
    setUndoSnackbar({ visible: false, sessionId: null });
  };

  const handleTimerPress = async () => {
    try {
      if (timerRunning) {
        // Stop timer — auto-save and refresh
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        if (stopTimerRef.current) stopTimerRef.current();
        stopTimerRef.current = null;
        // Clear widget marker so the widget shows the play icon again
        await setSettingAsync(WIDGET_TIMER_KEY, '');
        setTimerRunning(false);
        setTimerSeconds(0);
        loadData();
        requestWidgetRefresh();
      } else {
        // Start timer
        const stop = startManualSession();
        stopTimerRef.current = stop;
        timerStartRef.current = Date.now();
        // Write marker so the widget can show the stop icon
        await setSettingAsync(WIDGET_TIMER_KEY, String(Date.now()));
        setTimerSeconds(0);
        setTimerRunning(true);
        requestWidgetRefresh();
      }
    } catch (error) {
      console.error('[HomeScreen.handleTimerPress] Error:', error);
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
    <View style={styles.screenContainer}>
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
          onSessionLogged={() => {
            loadData();
            requestWidgetRefresh();
          }}
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
        <Card style={styles.ringCard}>
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
          {!timerRunning && (
            <View style={styles.timerInfoRow} testID="ring-timer-info">
              <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
              <Text style={styles.timerInfoText}>{t('ring_timer_info')}</Text>
            </View>
          )}
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
        </Card>

        {/* Weekly strip */}
        <Card style={styles.weekCard}>
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
        </Card>

        {/* Today's sessions */}
        {todaySessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('todays_sessions')}</Text>
            {todaySessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onConfirm={(confirmed) => handleConfirm(session.id!, session.startTime, confirmed)}
                onNotes={() => setNotesSession(session)}
              />
            ))}
          </View>
        )}

        {todaySessions.length === 0 && (
          <View style={styles.emptyState} testID="home-empty-state">
            <Image
              source={require('../../assets/herb.png')}
              style={styles.emptyIcon}
              resizeMode="contain"
              testID="home-empty-icon"
            />
            <Text style={styles.emptyText} testID="home-empty-title">
              {t('no_sessions_title')}
            </Text>
            <Text style={styles.emptySubtext} testID="home-empty-sub">
              {t('no_sessions_sub')}
            </Text>
          </View>
        )}
      </ScrollView>

      <SessionNotesSheet
        visible={notesSession !== null}
        session={notesSession}
        onClose={() => setNotesSession(null)}
        onNoteSaved={loadData}
      />

      <UndoSnackbar
        visible={undoSnackbar.visible}
        message={t('session_rejected_snackbar')}
        onUndo={handleUndoReject}
        onDismiss={() => setUndoSnackbar({ visible: false, sessionId: null })}
      />
    </View>
  );
}

function WeekDots() {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
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
  onNotes,
}: {
  session: OutsideSession;
  onConfirm: (confirmed: boolean) => void;
  onNotes: () => void;
}) {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
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
    <Card style={styles.sessionCard}>
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
        <TouchableOpacity onPress={onNotes} testID="home-notes-icon" style={styles.notesIcon}>
          <Ionicons
            name={session.notes ? 'document-text' : 'document-text-outline'}
            size={18}
            color={session.notes ? colors.grass : colors.textMuted}
          />
        </TouchableOpacity>
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
    </Card>
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

function makeStyles(colors: ThemeColors, shadows: Shadows) {
  return StyleSheet.create({
    screenContainer: { flex: 1, backgroundColor: colors.mist },
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
      padding: spacing.xl,
      alignItems: 'center',
    },
    motivation: {
      marginTop: spacing.md,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    timerInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    timerInfoText: {
      fontSize: 12,
      color: colors.textMuted,
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
      padding: spacing.lg,
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
      borderRadius: radius.md,
      marginBottom: spacing.xs,
    },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
    },
    sessionIconContainer: { width: 28, marginRight: spacing.sm, alignItems: 'center' },
    sessionInfo: { flex: 1 },
    sessionPending: { opacity: 0.5 },
    notesIcon: { paddingHorizontal: spacing.sm },
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
