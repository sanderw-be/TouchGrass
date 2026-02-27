import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, TextInput, Platform, Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { logManualSession, startManualSession } from '../detection/manualCheckin';
import { spacing, radius, shadows } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { formatMinutes } from '../utils/helpers';
import { t, formatLocalDate, formatLocalTime } from '../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSessionLogged: () => void;
}

type Tab = 'log' | 'timer';

const DURATION_PRESETS = [15, 20, 30, 45, 60, 90];

export default function ManualSessionSheet({ visible, onClose, onSessionLogged }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('log');

  // Log past session state
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [customDuration, setCustomDuration] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  
  // Time pickers for start and end time
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<number>(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [fromTimer, setFromTimer] = useState(false);
  const stopTimerRef = useRef<(() => void) | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      setTab('log');
      setDurationMinutes(30);
      setCustomDuration('');
      setUseCustom(false);
      setFromTimer(false);
      
      // Set default times: end time is now, start time is 30 minutes ago
      const now = new Date();
      setEndTime(now);
      const start = new Date(now.getTime() - 30 * 60 * 1000);
      setStartTime(start);
    }
  }, [visible]);

  // Timer tick - calculate elapsed time from start
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
        setTimerSeconds(elapsed);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerRunning, timerStartTime]);

  // ── Log past session ──────────────────────────────────

  const handleLogSession = () => {
    // Use exact millisecond precision so very short timer sessions are not
    // blocked by rounding, and the stored times match what the user reviewed.
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = durationMs / 60000;

    if (durationMs <= 0 || durationMinutes > 720) {
      Alert.alert(t('manual_invalid_title'), t('manual_invalid_body'));
      return;
    }

    logManualSession(durationMinutes, startTime.getTime(), endTime.getTime());
    onSessionLogged();
    onClose();
  };

  const onStartTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    if (date) {
      setStartTime(date);
      // If start time is after end time, adjust end time
      if (date.getTime() >= endTime.getTime()) {
        const newEnd = new Date(date.getTime() + 30 * 60 * 1000);
        setEndTime(newEnd);
      }
    }
  };

  const onEndTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    if (date) {
      setEndTime(date);
      // If end time is before start time, adjust start time
      if (date.getTime() <= startTime.getTime()) {
        const newStart = new Date(date.getTime() - 30 * 60 * 1000);
        setStartTime(newStart);
      }
    }
  };

  // ── Timer ─────────────────────────────────────────────

  const handleStartTimer = () => {
    const stop = startManualSession();
    stopTimerRef.current = stop;
    setTimerStartTime(Date.now());
    setTimerSeconds(0);
    setTimerRunning(true);
  };

  const handleStopTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    stopTimerRef.current = null;
    setTimerRunning(false);
    setTimerSeconds(0);

    // Pre-fill the log form with the timed session's actual start and end times
    // so the user can review and edit before saving (or cancel entirely).
    const end = new Date();
    const start = timerStartTime > 0 ? new Date(timerStartTime) : new Date(end.getTime() - timerSeconds * 1000);
    setStartTime(start);
    setEndTime(end);
    setFromTimer(true);
    setTab('log');
  };

  const handleCancelTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    stopTimerRef.current = null;
    setTimerRunning(false);
    setTimerSeconds(0);
  };

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Calculate duration from start and end times
  const calculatedDuration = Math.round((endTime.getTime() - startTime.getTime()) / (60 * 1000));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('manual_title')}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'log' && styles.tabActive]}
            onPress={() => setTab('log')}
          >
            <Text style={[styles.tabText, tab === 'log' && styles.tabTextActive]}>
              {t('manual_tab_log')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'timer' && styles.tabActive]}
            onPress={() => { setTab('timer'); setFromTimer(false); }}
          >
            <Text style={[styles.tabText, tab === 'timer' && styles.tabTextActive]}>
              {t('manual_tab_timer')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── Log past session tab ── */}
          {tab === 'log' && (
            <View>
              {/* Hint shown when log form was pre-filled from a just-ended timer */}
              {fromTimer && (
                <View style={styles.timerHint}>
                  <Text style={styles.timerHintText}>{t('manual_timer_stopped_hint')}</Text>
                </View>
              )}

              {/* Start Time */}
              <Text style={styles.sectionLabel}>{t('manual_start_time')}</Text>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  display="spinner"
                  onChange={onStartTimeChange}
                  style={styles.timePicker}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <Text style={styles.timeButtonText}>
                      {formatLocalTime(startTime.getTime())}
                    </Text>
                  </TouchableOpacity>
                  {showStartPicker && (
                    <DateTimePicker
                      value={startTime}
                      mode="time"
                      is24Hour={true}
                      display="default"
                      onChange={onStartTimeChange}
                    />
                  )}
                </>
              )}

              {/* End Time */}
              <Text style={styles.sectionLabel}>{t('manual_end_time')}</Text>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={endTime}
                  mode="time"
                  display="spinner"
                  onChange={onEndTimeChange}
                  style={styles.timePicker}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <Text style={styles.timeButtonText}>
                      {formatLocalTime(endTime.getTime())}
                    </Text>
                  </TouchableOpacity>
                  {showEndPicker && (
                    <DateTimePicker
                      value={endTime}
                      mode="time"
                      is24Hour={true}
                      display="default"
                      onChange={onEndTimeChange}
                    />
                  )}
                </>
              )}

              {/* Preview */}
              {calculatedDuration > 0 && (
                <View style={styles.preview}>
                  <Text style={styles.previewLabel}>{t('manual_preview')}</Text>
                  <Text style={styles.previewTime}>
                    {formatLocalTime(startTime.getTime())} – {formatLocalTime(endTime.getTime())}
                  </Text>
                  <Text style={styles.previewDuration}>
                    {formatMinutes(calculatedDuration)}
                  </Text>
                  <Text style={styles.previewDate}>
                    {formatLocalDate(startTime.getTime(), { weekday: 'long', month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              )}

              {/* Log button */}
              <TouchableOpacity style={styles.primaryBtn} onPress={handleLogSession}>
                <Text style={styles.primaryBtnText}>{t('manual_log_btn')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Timer tab ── */}
          {tab === 'timer' && (
            <View style={styles.timerContainer}>
              <Text style={styles.timerDisplay}>{formatTimer(timerSeconds)}</Text>
              <Text style={styles.timerSub}>
                {timerRunning ? t('manual_timer_running') : t('manual_timer_ready')}
              </Text>

              {!timerRunning ? (
                <TouchableOpacity style={styles.primaryBtn} onPress={handleStartTimer}>
                  <Text style={styles.primaryBtnText}>{t('manual_timer_start')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.timerButtons}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleCancelTimer}>
                    <Text style={styles.secondaryBtnText}>{t('manual_timer_cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleStopTimer}>
                    <Text style={styles.primaryBtnText}>{t('manual_timer_stop')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.mist,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
    ...shadows.medium,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.fog,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.fog,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.fog,
    borderRadius: radius.full,
    padding: 3,
    marginHorizontal: spacing.md,
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

  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  offsetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  preset: {
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.fog,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.card,
  },
  presetActive: { backgroundColor: colors.grass, borderColor: colors.grass },
  presetText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  presetTextActive: { color: colors.textInverse, fontWeight: '700' },

  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.fog,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
  inputActive: { borderColor: colors.grass },
  inputUnit: { fontSize: 14, color: colors.textSecondary },

  preview: {
    backgroundColor: colors.grassPale,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 11,
    color: colors.grassDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  previewTime: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.grassDark,
  },
  previewDate: {
    fontSize: 13,
    color: colors.grass,
    marginTop: 2,
  },

  primaryBtn: {
    backgroundColor: colors.grass,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },

  // Timer tab
  timerContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  timerDisplay: {
    fontSize: 64,
    fontWeight: '200',
    color: colors.textPrimary,
    letterSpacing: -2,
    marginBottom: spacing.sm,
  },
  timerSub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  timerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.fog,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Time picker styles
  timePicker: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  timeButton: {
    backgroundColor: colors.fog,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timeButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  previewDuration: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.grass,
    marginTop: spacing.xs,
  },
  timerHint: {
    backgroundColor: colors.grassPale,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  timerHintText: {
    fontSize: 13,
    color: colors.grassDark,
    textAlign: 'center',
  },
  });
}
