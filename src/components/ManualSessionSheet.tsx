import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, TextInput, Platform, Alert,
} from 'react-native';
import { logManualSession, startManualSession } from '../detection/manualCheckin';
import { colors, spacing, radius, shadows, formatMinutes } from '../utils/theme';
import { t, formatLocalDate, formatLocalTime } from '../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSessionLogged: () => void;
}

type Tab = 'log' | 'timer';

const DURATION_PRESETS = [15, 20, 30, 45, 60, 90];

export default function ManualSessionSheet({ visible, onClose, onSessionLogged }: Props) {
  const [tab, setTab] = useState<Tab>('log');

  // Log past session state
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [customDuration, setCustomDuration] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [offsetHours, setOffsetHours] = useState(0); // hours ago session started

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const stopTimerRef = useRef<(() => void) | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      setTab('log');
      setDurationMinutes(30);
      setCustomDuration('');
      setUseCustom(false);
      setOffsetHours(0);
    }
  }, [visible]);

  // Timer tick
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerRunning]);

  // ── Log past session ──────────────────────────────────

  const handleLogSession = () => {
    const duration = useCustom ? parseInt(customDuration, 10) : durationMinutes;
    if (isNaN(duration) || duration < 1 || duration > 720) {
      Alert.alert(t('manual_invalid_title'), t('manual_invalid_body'));
      return;
    }
    const startTime = Date.now() - offsetHours * 60 * 60 * 1000 - duration * 60 * 1000;
    logManualSession(duration, startTime);
    onSessionLogged();
    onClose();
  };

  // ── Timer ─────────────────────────────────────────────

  const handleStartTimer = () => {
    const stop = startManualSession();
    stopTimerRef.current = stop;
    setTimerSeconds(0);
    setTimerRunning(true);
  };

  const handleStopTimer = () => {
    if (stopTimerRef.current) {
      stopTimerRef.current();
      stopTimerRef.current = null;
    }
    setTimerRunning(false);
    onSessionLogged();
    onClose();
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

  // Compute preview start time for log tab
  const previewDuration = useCustom ? parseInt(customDuration, 10) || 0 : durationMinutes;
  const previewStart = Date.now() - offsetHours * 60 * 60 * 1000 - previewDuration * 60 * 1000;
  const previewEnd = Date.now() - offsetHours * 60 * 60 * 1000;

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
            onPress={() => setTab('timer')}
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
              {/* Duration */}
              <Text style={styles.sectionLabel}>{t('manual_duration')}</Text>
              <View style={styles.presets}>
                {DURATION_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.preset,
                      !useCustom && durationMinutes === p && styles.presetActive,
                    ]}
                    onPress={() => { setDurationMinutes(p); setUseCustom(false); }}
                  >
                    <Text style={[
                      styles.presetText,
                      !useCustom && durationMinutes === p && styles.presetTextActive,
                    ]}>
                      {formatMinutes(p)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom duration */}
              <View style={styles.customRow}>
                <TextInput
                  style={[styles.input, useCustom && styles.inputActive]}
                  value={customDuration}
                  onChangeText={(v) => { setCustomDuration(v); setUseCustom(true); }}
                  onFocus={() => setUseCustom(true)}
                  keyboardType="number-pad"
                  placeholder={t('manual_custom_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={4}
                />
                <Text style={styles.inputUnit}>{t('manual_minutes')}</Text>
              </View>

              {/* How long ago */}
              <Text style={styles.sectionLabel}>{t('manual_when')}</Text>
              <View style={styles.offsetRow}>
                {[0, 1, 2, 3, 4, 6].map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.preset, offsetHours === h && styles.presetActive]}
                    onPress={() => setOffsetHours(h)}
                  >
                    <Text style={[styles.presetText, offsetHours === h && styles.presetTextActive]}>
                      {h === 0 ? t('manual_just_now') : t('manual_hours_ago', { hours: h })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Preview */}
              {previewDuration > 0 && (
                <View style={styles.preview}>
                  <Text style={styles.previewLabel}>{t('manual_preview')}</Text>
                  <Text style={styles.previewTime}>
                    {formatLocalTime(previewStart)} – {formatLocalTime(previewEnd)}
                  </Text>
                  <Text style={styles.previewDate}>
                    {formatLocalDate(previewStart, { weekday: 'long', month: 'short', day: 'numeric' })}
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

const styles = StyleSheet.create({
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
  tabActive: { backgroundColor: colors.textInverse, ...shadows.soft },
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
    backgroundColor: colors.textInverse,
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
    backgroundColor: colors.textInverse,
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
});
