import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Platform,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getCurrentDailyGoal,
  getCurrentWeeklyGoal,
  setDailyGoal,
  setWeeklyGoal,
  getSetting,
  setSetting,
} from '../storage/database';
import {
  requestCalendarPermissions,
  hasCalendarPermissions,
  getWritableCalendars,
  getOrCreateTouchGrassCalendar,
  getSelectedCalendarId,
  setSelectedCalendarId,
} from '../calendar/calendarService';
import * as IntentLauncher from 'expo-intent-launcher';
import { spacing, radius, shadows } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { formatMinutes } from '../utils/helpers';
import { t } from '../i18n';
import type { GoalsStackParamList } from '../navigation/AppNavigator';

const DAILY_PRESETS = [15, 20, 30, 45, 60, 90];
const WEEKLY_PRESETS = [60, 90, 120, 150, 210, 300];

export default function GoalsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<StackNavigationProp<GoalsStackParamList>>();
  const insets = useSafeAreaInsets();

  // Goals state
  const [dailyTarget, setDailyTargetState] = useState(30);
  const [weeklyTarget, setWeeklyTargetState] = useState(150);
  const [editingDaily, setEditingDaily] = useState(false);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [customDaily, setCustomDaily] = useState('');
  const [customWeekly, setCustomWeekly] = useState('');

  // Reminders state
  const [smartRemindersCount, setSmartRemindersCount] = useState(2);
  const [catchupRemindersCount, setCatchupRemindersCount] = useState(2);

  // Weather state
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [gpsEnabled, setGpsEnabled] = useState(false);

  // Calendar state
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [calendarPermissionGranted, setCalendarPermissionGranted] = useState(false);
  const [calendarBuffer, setCalendarBuffer] = useState(30);
  const [calendarDuration, setCalendarDuration] = useState(0);
  const [calendarSelectedId, setCalendarSelectedIdState] = useState('');
  const [calendarOptions, setCalendarOptions] = useState<{ id: string; title: string }[]>([]);

  const loadGoalSettings = useCallback(() => {
    setDailyTargetState(getCurrentDailyGoal()?.targetMinutes ?? 30);
    setWeeklyTargetState(getCurrentWeeklyGoal()?.targetMinutes ?? 150);
    setSmartRemindersCount(parseInt(getSetting('smart_reminders_count', '2'), 10));
    setCatchupRemindersCount(parseInt(getSetting('smart_catchup_reminders_count', '2'), 10));
    setWeatherEnabled(getSetting('weather_enabled', '1') === '1');
    setGpsEnabled(getSetting('gps_user_enabled', '0') === '1');
    setCalendarEnabled(getSetting('calendar_integration_enabled', '0') === '1');
    setCalendarBuffer(parseInt(getSetting('calendar_buffer_minutes', '30'), 10));
    setCalendarDuration(parseInt(getSetting('calendar_default_duration', '0'), 10));
    setCalendarSelectedIdState(getSelectedCalendarId());
  }, []);

  const checkCalendarPermissions = useCallback(async () => {
    const granted = await hasCalendarPermissions();
    setCalendarPermissionGranted(granted);
    if (granted) {
      const cals = await getWritableCalendars();
      setCalendarOptions(cals.map((c) => ({ id: c.id, title: c.title })));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGoalSettings();
      checkCalendarPermissions();

      const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') {
          loadGoalSettings();
          checkCalendarPermissions();
        }
      });
      return () => sub.remove();
    }, [loadGoalSettings, checkCalendarPermissions])
  );

  const saveDaily = (minutes: number) => {
    if (isNaN(minutes) || minutes < 1 || minutes > 720) {
      Alert.alert(t('goals_invalid_title'), t('goals_invalid_daily'));
      return;
    }
    setDailyGoal(minutes);
    setDailyTargetState(minutes);
    setEditingDaily(false);
  };

  const saveWeekly = (minutes: number) => {
    if (isNaN(minutes) || minutes < 1 || minutes > 5040) {
      Alert.alert(t('goals_invalid_title'), t('goals_invalid_weekly'));
      return;
    }
    setWeeklyGoal(minutes);
    setWeeklyTargetState(minutes);
    setEditingWeekly(false);
  };

  const SMART_REMINDERS_OPTIONS = [0, 1, 2, 3];

  const cycleSmartRemindersCount = () => {
    const idx = SMART_REMINDERS_OPTIONS.indexOf(smartRemindersCount);
    const next = SMART_REMINDERS_OPTIONS[(idx + 1) % SMART_REMINDERS_OPTIONS.length];
    setSetting('smart_reminders_count', String(next));
    setSmartRemindersCount(next);
  };

  const CATCHUP_REMINDERS_OPTIONS = [0, 1, 2, 3] as const;
  const CATCHUP_REMINDERS_LABELS: Record<number, string> = {
    0: t('settings_catchup_off'),
    1: t('settings_catchup_mellow'),
    2: t('settings_catchup_medium'),
    3: t('settings_catchup_aggressive'),
  };

  const cycleCatchupRemindersCount = () => {
    const idx = CATCHUP_REMINDERS_OPTIONS.indexOf(catchupRemindersCount as 0 | 1 | 2 | 3);
    const next = CATCHUP_REMINDERS_OPTIONS[(idx + 1) % CATCHUP_REMINDERS_OPTIONS.length];
    setSetting('smart_catchup_reminders_count', String(next));
    setCatchupRemindersCount(next);
  };

  const toggleWeatherEnabled = (value: boolean) => {
    setSetting('weather_enabled', value ? '1' : '0');
    setWeatherEnabled(value);
  };

  const handleNavigateToSettings = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Settings');
    } else {
      console.warn(
        'GoalsScreen: could not navigate to Settings tab — parent navigator unavailable'
      );
    }
  };

  const handleOpenAppSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.openSettings();
      } else if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      }
    } catch (error) {
      console.error('Error opening app settings:', error);
      Alert.alert(t('settings_error_title'), t('settings_error_open_settings_failed'));
    }
  };

  const CALENDAR_BUFFER_OPTIONS = [10, 20, 30, 45, 60];
  const CALENDAR_DURATION_OPTIONS = [0, 5, 10, 15, 20, 30];

  const toggleCalendarIntegration = async (value: boolean) => {
    if (value && !calendarPermissionGranted) {
      const granted = await requestCalendarPermissions();
      setCalendarPermissionGranted(granted);
      if (!granted) {
        Alert.alert(
          t('settings_calendar_permission_title'),
          t('settings_calendar_permission_body'),
          [
            { text: t('settings_calendar_permission_cancel'), style: 'cancel' },
            { text: t('settings_calendar_permission_open'), onPress: handleOpenAppSettings },
          ]
        );
        return;
      }
    }
    setSetting('calendar_integration_enabled', value ? '1' : '0');
    setCalendarEnabled(value);
  };

  const cycleCalendarBuffer = () => {
    const idx = CALENDAR_BUFFER_OPTIONS.indexOf(calendarBuffer);
    const next = CALENDAR_BUFFER_OPTIONS[(idx + 1) % CALENDAR_BUFFER_OPTIONS.length];
    setSetting('calendar_buffer_minutes', String(next));
    setCalendarBuffer(next);
  };

  const cycleCalendarDuration = () => {
    const idx = CALENDAR_DURATION_OPTIONS.indexOf(calendarDuration);
    const next = CALENDAR_DURATION_OPTIONS[(idx + 1) % CALENDAR_DURATION_OPTIONS.length];
    setSetting('calendar_default_duration', String(next));
    setCalendarDuration(next);
  };

  const handleSelectCalendar = async () => {
    const hasAlternatives = calendarOptions.some(
      (c) => !c.title.toLowerCase().includes('touchgrass')
    );
    if (!hasAlternatives) return;

    const otherCalendars = calendarOptions.filter((c) => !c.title.includes('TouchGrass'));
    const options = [
      { id: '__touchgrass__', title: t('settings_calendar_select_touchgrass') },
      ...otherCalendars,
    ];
    const isSelected = (optId: string) =>
      optId === calendarSelectedId || (optId === '__touchgrass__' && !calendarSelectedId);
    Alert.alert(t('settings_calendar_select_title'), undefined, [
      ...options.map((opt) => ({
        text: isSelected(opt.id) ? `${opt.title} ✓` : opt.title,
        onPress: async () => {
          if (opt.id === '__touchgrass__') {
            const id = await getOrCreateTouchGrassCalendar();
            const newId = id ?? '';
            setSelectedCalendarId(newId);
            setCalendarSelectedIdState(newId);
          } else {
            setSelectedCalendarId(opt.id);
            setCalendarSelectedIdState(opt.id);
          }
        },
      })),
      { text: t('settings_calendar_permission_cancel'), style: 'cancel' },
    ]);
  };

  const calendarSelectedTitle = (): string => {
    if (!calendarSelectedId) return t('settings_calendar_select_touchgrass');
    const match = calendarOptions.find((c) => c.id === calendarSelectedId);
    return match?.title ?? t('settings_calendar_select_touchgrass');
  };

  const hasAlternativeCalendars = calendarOptions.some(
    (c) => !c.title.toLowerCase().includes('touchgrass')
  );

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>{t('nav_goals')}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* WHO recommendation note */}
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={18} color={colors.grassDark} style={styles.tipIcon} />
          <Text style={styles.tipText}>{t('goals_who_tip')}</Text>
        </View>

        {/* Daily goal */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{t('daily_goal')}</Text>
              <Text style={styles.cardValue}>{formatMinutes(dailyTarget)}</Text>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                setEditingDaily(!editingDaily);
                setEditingWeekly(false);
                setCustomDaily(String(dailyTarget));
              }}
            >
              <Text style={styles.editButtonText}>
                {editingDaily ? t('goals_cancel') : t('goals_edit')}
              </Text>
            </TouchableOpacity>
          </View>

          {editingDaily && (
            <View style={styles.editor}>
              <Text style={styles.editorLabel}>{t('goals_quick_select')}</Text>
              <View style={styles.presets}>
                {DAILY_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.preset, dailyTarget === p && styles.presetActive]}
                    onPress={() => saveDaily(p)}
                  >
                    <Text style={[styles.presetText, dailyTarget === p && styles.presetTextActive]}>
                      {formatMinutes(p)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.editorLabel}>{t('goals_custom_minutes')}</Text>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.input}
                  value={customDaily}
                  onChangeText={setCustomDaily}
                  keyboardType="number-pad"
                  placeholder={t('goals_placeholder_daily')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={4}
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={() => saveDaily(parseInt(customDaily, 10))}
                >
                  <Text style={styles.saveButtonText}>{t('goals_save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Weekly goal */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{t('weekly_goal')}</Text>
              <Text style={styles.cardValue}>{formatMinutes(weeklyTarget)}</Text>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                setEditingWeekly(!editingWeekly);
                setEditingDaily(false);
                setCustomWeekly(String(weeklyTarget));
              }}
            >
              <Text style={styles.editButtonText}>
                {editingWeekly ? t('goals_cancel') : t('goals_edit')}
              </Text>
            </TouchableOpacity>
          </View>

          {editingWeekly && (
            <View style={styles.editor}>
              <Text style={styles.editorLabel}>{t('goals_quick_select')}</Text>
              <View style={styles.presets}>
                {WEEKLY_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.preset, weeklyTarget === p && styles.presetActive]}
                    onPress={() => saveWeekly(p)}
                  >
                    <Text
                      style={[styles.presetText, weeklyTarget === p && styles.presetTextActive]}
                    >
                      {formatMinutes(p)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.editorLabel}>{t('goals_custom_minutes')}</Text>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.input}
                  value={customWeekly}
                  onChangeText={setCustomWeekly}
                  keyboardType="number-pad"
                  placeholder={t('goals_placeholder_weekly')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={5}
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={() => saveWeekly(parseInt(customWeekly, 10))}
                >
                  <Text style={styles.saveButtonText}>{t('goals_save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Reminders */}
        <Text style={styles.sectionHeader}>{t('settings_section_reminders')}</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity onPress={cycleSmartRemindersCount}>
            <SettingRow
              icon={
                <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              }
              label={t('settings_reminders_label')}
              sublabel={t('settings_reminders_sublabel')}
              right={
                <Text style={styles.valueChip}>
                  {smartRemindersCount === 0
                    ? t('settings_reminders_count_off')
                    : t('settings_reminders_count_per_day', { count: smartRemindersCount })}
                </Text>
              }
            />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity onPress={cycleCatchupRemindersCount}>
            <SettingRow
              icon={<Ionicons name="flag-outline" size={20} color={colors.textSecondary} />}
              label={t('settings_catchup_label')}
              sublabel={t('settings_catchup_sublabel')}
              right={
                <Text style={styles.valueChip}>
                  {CATCHUP_REMINDERS_LABELS[catchupRemindersCount] ?? t('settings_catchup_medium')}
                </Text>
              }
            />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity onPress={() => navigation.navigate('ScheduledNotifications')}>
            <SettingRow
              icon={<Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />}
              label={t('settings_scheduled_reminders')}
              sublabel={t('settings_scheduled_reminders_sublabel')}
              right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            />
          </TouchableOpacity>
          <Divider />
          <SettingRow
            icon={<Ionicons name="radio-outline" size={20} color={colors.textSecondary} />}
            label={t('settings_background_tracking_label')}
            sublabel={t('settings_background_tracking_sublabel')}
          />
          {Platform.OS === 'android' && (
            <>
              <Divider />
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await IntentLauncher.startActivityAsync(
                      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
                    );
                  } catch (error) {
                    console.error('Error opening battery settings:', error);
                  }
                }}
              >
                <SettingRow
                  icon={
                    <Ionicons
                      name="battery-charging-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                  }
                  label={t('settings_battery_optimization')}
                  sublabel={t('settings_battery_optimization_sublabel')}
                  right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
                />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Weather */}
        <Text style={styles.sectionHeader}>{t('settings_weather_title')}</Text>
        <TouchableOpacity
          onPress={!gpsEnabled ? handleNavigateToSettings : undefined}
          disabled={gpsEnabled}
          activeOpacity={gpsEnabled ? 1 : 0.7}
        >
          <View style={[styles.settingsCard, !gpsEnabled && styles.settingsCardDisabled]}>
            <SettingRow
              icon={<Ionicons name="partly-sunny-outline" size={20} color={colors.textSecondary} />}
              label={t('settings_weather_enabled')}
              sublabel={t('settings_weather_enabled_desc')}
              right={
                <Switch
                  value={weatherEnabled}
                  onValueChange={toggleWeatherEnabled}
                  trackColor={{ false: colors.fog, true: colors.grassLight }}
                  thumbColor={weatherEnabled ? colors.grass : colors.inactive}
                  disabled={!gpsEnabled}
                />
              }
            />
            {!gpsEnabled && (
              <>
                <Divider />
                <View style={styles.row}>
                  <View style={styles.rowIconContainer}>
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowSublabel}>{t('settings_weather_gps_disabled')}</Text>
                  </View>
                </View>
              </>
            )}
            {gpsEnabled && weatherEnabled && (
              <>
                <Divider />
                <TouchableOpacity onPress={() => navigation.navigate('WeatherSettings')}>
                  <SettingRow
                    icon={
                      <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
                    }
                    label={t('settings_weather_more')}
                    sublabel={t('settings_weather_more_desc')}
                    right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Calendar integration */}
        <Text style={styles.sectionHeader}>{t('settings_section_calendar')}</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            icon={<Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />}
            label={t('settings_calendar_integration')}
            sublabel={t('settings_calendar_integration_desc')}
            right={
              <Switch
                value={calendarEnabled}
                onValueChange={toggleCalendarIntegration}
                trackColor={{ false: colors.fog, true: colors.grassLight }}
                thumbColor={calendarEnabled ? colors.grass : colors.inactive}
              />
            }
          />
          {calendarEnabled && (
            <>
              <Divider />
              <TouchableOpacity onPress={cycleCalendarBuffer}>
                <SettingRow
                  icon={<Ionicons name="timer-outline" size={20} color={colors.textSecondary} />}
                  label={t('settings_calendar_buffer')}
                  sublabel={t('settings_calendar_buffer_desc')}
                  right={
                    <Text style={styles.valueChip}>
                      {t('settings_calendar_buffer_minutes', { minutes: calendarBuffer })}
                    </Text>
                  }
                />
              </TouchableOpacity>
              <Divider />
              <TouchableOpacity onPress={cycleCalendarDuration}>
                <SettingRow
                  icon={<Ionicons name="time-outline" size={20} color={colors.textSecondary} />}
                  label={t('settings_calendar_duration')}
                  sublabel={t('settings_calendar_duration_desc')}
                  right={
                    <Text style={styles.valueChip}>
                      {calendarDuration === 0
                        ? t('settings_calendar_duration_off')
                        : t('settings_calendar_duration_minutes', { minutes: calendarDuration })}
                    </Text>
                  }
                />
              </TouchableOpacity>
              <Divider />
              <TouchableOpacity onPress={handleSelectCalendar} disabled={!hasAlternativeCalendars}>
                <SettingRow
                  icon={<Ionicons name="list-outline" size={20} color={colors.textSecondary} />}
                  label={t('settings_calendar_select')}
                  sublabel={t('settings_calendar_select_desc')}
                  right={<Text style={styles.valueChip}>{calendarSelectedTitle()}</Text>}
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function SettingRow({
  icon,
  label,
  sublabel,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <View style={styles.rowIconContainer}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      {right && <View style={styles.rowRight}>{right}</View>}
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.divider} />;
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.mist },
    content: { padding: spacing.md, paddingBottom: spacing.xxl },

    header: {
      backgroundColor: colors.mist,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.md,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    sectionHeader: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
      marginLeft: spacing.xs,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.soft,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 13,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    cardValue: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2,
      letterSpacing: -1,
    },

    editButton: {
      backgroundColor: colors.grassPale,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    editButtonText: { fontSize: 13, fontWeight: '600', color: colors.grass },

    editor: {
      marginTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.fog,
      paddingTop: spacing.lg,
    },
    editorLabel: {
      fontSize: 12,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },

    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
    preset: {
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.fog,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    presetActive: { backgroundColor: colors.grass, borderColor: colors.grass },
    presetText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
    presetTextActive: { color: colors.textInverse, fontWeight: '700' },

    customRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    input: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.fog,
      borderRadius: radius.md,
      padding: spacing.sm,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.mist,
    },
    saveButton: {
      backgroundColor: colors.grass,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    saveButtonText: { color: colors.textInverse, fontWeight: '700', fontSize: 15 },

    tipCard: {
      flexDirection: 'row',
      backgroundColor: colors.grassPale,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    tipIcon: { marginTop: 1 },
    tipText: { flex: 1, fontSize: 13, color: colors.grassDark, lineHeight: 20 },

    settingsCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      overflow: 'hidden',
      ...shadows.soft,
    },
    settingsCardDisabled: {
      opacity: 0.5,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
    },
    rowIconContainer: {
      width: 28,
      marginRight: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowContent: { flex: 1 },
    rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
    rowSublabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    rowRight: { marginLeft: spacing.sm },

    divider: { height: 1, backgroundColor: colors.fog, marginLeft: spacing.md + 28 + spacing.md },

    chevron: { fontSize: 24, color: colors.textMuted, fontWeight: '300' },

    valueChip: {
      fontSize: 13,
      color: colors.grass,
      fontWeight: '600',
      backgroundColor: colors.grassPale,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
  });
}
