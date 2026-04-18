import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getDailyTotalsForMonthAsync,
  getSessionsForRangeAsync,
  getCurrentDailyGoalAsync,
  startOfDay,
  startOfWeek,
} from '../storage/database';
import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import { formatMinutes } from '../utils/helpers';
import { formatLocalDate, t } from '../i18n';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BAR_AREA_WIDTH = SCREEN_WIDTH - spacing.md * 2 - spacing.lg * 2;
const DAY_MS = 86400000;

type Period = 'week' | 'month';

export default function HistoryScreen() {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const [period, setPeriod] = useState<Period>('week');
  const [dailyData, setDailyData] = useState<{ date: number; minutes: number }[]>([]);
  const [dailyTarget, setDailyTarget] = useState(30);
  const [viewDate, setViewDate] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const isFetchingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setDailyTarget((await getCurrentDailyGoalAsync())?.targetMinutes ?? 30);
        await loadData(period, viewDate);
      };
      load();
    }, [period, viewDate])
  );

  const loadData = async (p: Period, date: number) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (p === 'week') {
        const weekStart = startOfWeek(date);
        const weekEnd = weekStart + 7 * DAY_MS;
        // Single range query for the entire week, then aggregate per day in memory
        const sessions = await getSessionsForRangeAsync(weekStart, weekEnd);
        const days: { date: number; minutes: number }[] = [];
        for (let i = 0; i < 7; i++) {
          const dayStart = weekStart + i * DAY_MS;
          const dayEnd = dayStart + DAY_MS;
          const minutes = sessions
            .filter((s) => s.userConfirmed !== 0 && s.startTime >= dayStart && s.startTime < dayEnd)
            .reduce((sum, s) => sum + s.durationMinutes, 0);
          days.push({ date: dayStart, minutes });
        }
        setDailyData(days);
      } else {
        setDailyData(await getDailyTotalsForMonthAsync(date));
      }
    } catch (error) {
      console.error('[HistoryScreen.loadData] Database error:', error);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  };

  const navigate = (dir: -1 | 1) => {
    const delta = period === 'week' ? dir * 7 * DAY_MS : dir * 30 * DAY_MS;
    setViewDate((v) => v + delta);
  };

  const periodLabel = () => {
    if (period === 'week') {
      const weekStart = startOfWeek(viewDate);
      const weekEnd = weekStart + 6 * DAY_MS;
      return `${formatLocalDate(weekStart, { month: 'short', day: 'numeric' })} – ${formatLocalDate(weekEnd, { month: 'short', day: 'numeric' })}`;
    }
    return formatLocalDate(viewDate, { month: 'long', year: 'numeric' });
  };

  const totalMinutes = dailyData.reduce((sum, d) => sum + d.minutes, 0);
  const isCurrentWeek = period === 'week' && startOfWeek(viewDate) === startOfWeek(Date.now());
  const daysElapsed = isCurrentWeek
    ? Math.floor((startOfDay(Date.now()) - startOfWeek(Date.now())) / DAY_MS) + 1
    : dailyData.length;
  const avgMinutes = dailyData.length > 0 ? totalMinutes / daysElapsed : 0;
  const daysGoalMet = dailyData.filter((d) => d.minutes >= dailyTarget).length;
  const maxMinutes = Math.max(...dailyData.map((d) => d.minutes), dailyTarget, 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Period tabs */}
      <View style={styles.tabs}>
        {(['week', 'month'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.tab, period === p && styles.tabActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
              {p === 'week' ? t('history_period_week') : t('history_period_month')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Navigator */}
      <View style={styles.navigator}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigate(-1)}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.periodLabel}>{periodLabel()}</Text>
        <TouchableOpacity
          style={[styles.navBtn, viewDate >= startOfDay(Date.now()) && styles.navBtnDisabled]}
          onPress={() => navigate(1)}
          disabled={viewDate >= startOfDay(Date.now())}
        >
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatBox label={t('history_stat_total')} value={formatMinutes(totalMinutes)} />
        <StatBox label={t('history_stat_avg')} value={formatMinutes(avgMinutes)} />
        <StatBox label={t('history_stat_goals_met')} value={`${daysGoalMet}/${dailyData.length}`} />
      </View>

      {/* Bar chart */}
      <View style={styles.chartCard}>
        <BarChart
          data={dailyData}
          target={dailyTarget}
          maxValue={maxMinutes}
          period={period}
          isLoading={isLoading}
        />
      </View>
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function BarChart({
  data,
  target,
  maxValue,
  period,
  isLoading = false,
}: {
  data: { date: number; minutes: number }[];
  target: number;
  maxValue: number;
  period: Period;
  isLoading?: boolean;
}) {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const CHART_HEIGHT = 160;
  const targetY = CHART_HEIGHT - (target / maxValue) * CHART_HEIGHT;
  const [chartWidth, setChartWidth] = useState(BAR_AREA_WIDTH);
  const barCount = data.length || 1;
  const effectiveWidth = Math.max(chartWidth, 1);
  const barWidth = Math.max(4, effectiveWidth / barCount - 4);
  const xAxisLabel = period === 'week' ? t('history_axis_days_week') : t('history_axis_days_month');
  const isEmpty = data.length === 0;

  return (
    <View>
      <View style={styles.chartWithAxis}>
        <View style={styles.yAxisLabelContainer}>
          <Text style={[styles.axisLabel, styles.yAxisLabelText]}>{t('history_axis_minutes')}</Text>
        </View>

        <View style={styles.chartColumn}>
          <View
            testID="history-chart-area"
            style={[styles.chartArea, { height: CHART_HEIGHT }]}
            onLayout={({ nativeEvent: { layout } }) => {
              if (layout.width && Math.abs(layout.width - chartWidth) > 0.5) {
                setChartWidth(layout.width);
              }
            }}
          >
            {/* Target line */}
            <View style={[styles.targetLine, { top: targetY }]} />

            {/* Bars / empty state */}
            {!isLoading && isEmpty ? (
              <View style={styles.chartEmptyState}>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                  {t('history_no_data')}
                </Text>
              </View>
            ) : (
              <View style={styles.barsRow}>
                {data.map((d, i) => {
                  const fillRatio = Math.min(d.minutes / maxValue, 1);
                  const barHeight = Math.max(fillRatio * CHART_HEIGHT, d.minutes > 0 ? 4 : 0);
                  const metGoal = d.minutes >= target;
                  const isToday = startOfDay(d.date) === startOfDay(Date.now());

                  return (
                    <View
                      key={i}
                      testID="history-bar-wrapper"
                      style={[styles.barWrapper, { width: barWidth }]}
                    >
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight,
                            width: barWidth - 2,
                            backgroundColor: metGoal
                              ? colors.grass
                              : isToday
                                ? colors.sky
                                : colors.fog,
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* X-axis labels */}
          <View style={styles.xLabels}>
            {data.map((d, i) => {
              const showLabel = period === 'week' || i % 5 === 0 || i === data.length - 1;
              return (
                <View key={i} style={[styles.xLabel, { width: barWidth }]}>
                  {showLabel && (
                    <Text style={styles.xLabelText}>
                      {period === 'week'
                        ? formatLocalDate(d.date, { weekday: 'narrow' })
                        : new Date(d.date).getDate()}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.xAxisLabelContainer}>
        <Text style={styles.axisLabel}>{xAxisLabel}</Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.grass }]} />
          <Text style={styles.legendText}>{t('history_legend_goal_met')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.fog }]} />
          <Text style={styles.legendText}>{t('history_legend_below_goal')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.sky }]} />
          <Text style={styles.legendText}>{t('history_legend_today')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine]} />
          <Text style={styles.legendText}>{t('history_legend_target')}</Text>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors, shadows: Shadows) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.mist },
    content: { padding: spacing.md, paddingBottom: spacing.xxl },

    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.fog,
      borderRadius: radius.full,
      padding: 3,
      marginBottom: spacing.md,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: colors.card, ...shadows.soft },
    tabText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
    tabTextActive: { color: colors.textPrimary, fontWeight: '700' },

    navigator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.soft,
    },
    navBtnDisabled: { opacity: 0.3 },
    navBtnText: { fontSize: 22, color: colors.textPrimary, lineHeight: 26 },
    periodLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },

    statsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    statBox: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
      ...shadows.soft,
    },
    statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    statLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    chartCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      width: '100%',
      ...shadows.soft,
    },
    chartWithAxis: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
    yAxisLabelContainer: { width: 36, alignItems: 'center', justifyContent: 'center' },
    chartColumn: { flex: 1 },
    axisLabel: { fontSize: 11, color: colors.textMuted },
    yAxisLabelText: { transform: [{ rotate: '-90deg' }], textAlign: 'center' },
    chartArea: {
      position: 'relative',
      width: '100%',
      marginBottom: spacing.xs,
    },
    targetLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1.5,
      backgroundColor: colors.sun,
      zIndex: 1,
    },
    barsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      width: '100%',
      height: '100%',
    },
    barWrapper: { alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
    bar: { borderRadius: 3 },
    chartEmptyState: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    xLabels: { flexDirection: 'row', marginTop: spacing.xs, width: '100%' },
    xLabel: { alignItems: 'center' },
    xLabelText: { fontSize: 10, color: colors.textMuted },
    xAxisLabelContainer: { alignItems: 'center', marginTop: spacing.xs },

    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: spacing.lg,
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.fog,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLine: { width: 16, height: 2, backgroundColor: colors.sun },
    legendText: { fontSize: 11, color: colors.textMuted },
  });
}
