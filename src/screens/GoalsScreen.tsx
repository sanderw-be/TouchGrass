import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import * as Notifications from 'expo-notifications';
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
  hasCalendarPermissions,
  getWritableCalendars,
  getOrCreateTouchGrassCalendar,
  getSelectedCalendarId,
  setSelectedCalendarId,
} from '../calendar/calendarService';
import { checkWeatherLocationPermissions } from '../detection';
import { spacing } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { formatMinutes } from '../utils/helpers';
import { t } from '../i18n';
import type { GoalsStackParamList } from '../navigation/AppNavigator';
import PermissionExplainerSheet, {
  PermissionSheetConfig,
} from '../components/PermissionExplainerSheet';
import {
  BATTERY_OPTIMIZATION_SETTING_KEY,
  refreshBatteryOptimizationSetting,
  openBatteryOptimizationSettings,
} from '../utils/batteryOptimization';
import RemindersSection from '../components/goals/RemindersSection';
import WeatherSection from '../components/goals/WeatherSection';
import CalendarSection from '../components/goals/CalendarSection';
import { makeStyles } from '../components/goals/GoalsShared';

const DAILY_PRESETS = [15, 20, 30, 45, 60, 90];
const WEEKLY_PRESETS = [60, 90, 120, 150, 210, 300];
const SMART_REMINDERS_OPTIONS = [0, 1, 2, 3];

export default function GoalsScreen() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
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
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);

  // Weather state
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [weatherLocationGranted, setWeatherLocationGranted] = useState(false);

  // Calendar state
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [calendarPermissionGranted, setCalendarPermissionGranted] = useState(false);
  const [calendarBuffer, setCalendarBuffer] = useState(30);
  const [calendarDuration, setCalendarDuration] = useState(0);
  const [calendarSelectedId, setCalendarSelectedIdState] = useState('');
  const [calendarOptions, setCalendarOptions] = useState<{ id: string; title: string }[]>([]);
  const [batteryOptimizationGranted, setBatteryOptimizationGranted] = useState(false);

  // Permission explainer sheet state
  const [permissionSheet, setPermissionSheet] = useState<PermissionSheetConfig | null>(null);

  // Tracks whether the user tried to enable weather/calendar but was blocked by missing
  // permissions. If true and the permission is later granted (on app resume), the setting
  // is automatically enabled so the user doesn't have to toggle it again.
  const pendingWeatherEnableRef = useRef(false);
  const pendingCalendarEnableRef = useRef(false);
  const pendingSmartRemindersEnableRef = useRef(false);

  const loadGoalSettings = useCallback(() => {
    setDailyTargetState(getCurrentDailyGoal()?.targetMinutes ?? 30);
    setWeeklyTargetState(getCurrentWeeklyGoal()?.targetMinutes ?? 150);
    setSmartRemindersCount(parseInt(getSetting('smart_reminders_count', '2'), 10));
    setCatchupRemindersCount(parseInt(getSetting('smart_catchup_reminders_count', '2'), 10));
    setWeatherEnabled(getSetting('weather_enabled', '1') === '1');
    setCalendarEnabled(getSetting('calendar_integration_enabled', '0') === '1');
    setCalendarBuffer(parseInt(getSetting('calendar_buffer_minutes', '30'), 10));
    setCalendarDuration(parseInt(getSetting('calendar_default_duration', '0'), 10));
    setCalendarSelectedIdState(getSelectedCalendarId());
    setBatteryOptimizationGranted(getSetting(BATTERY_OPTIMIZATION_SETTING_KEY, '0') === '1');
  }, []);

  const refreshBatteryOptimizationStatus = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    const granted = await refreshBatteryOptimizationSetting();
    setBatteryOptimizationGranted(granted);
  }, []);

  const checkWeatherPermissions = useCallback(async () => {
    const granted = await checkWeatherLocationPermissions();
    setWeatherLocationGranted(granted);
    // Auto-enable weather if the user was blocked by missing permissions and just granted them
    if (granted && pendingWeatherEnableRef.current) {
      pendingWeatherEnableRef.current = false;
      setSetting('weather_enabled', '1');
      setWeatherEnabled(true);
    }
  }, []);

  const checkCalendarPermissions = useCallback(async () => {
    const granted = await hasCalendarPermissions();
    setCalendarPermissionGranted(granted);
    if (granted) {
      const cals = await getWritableCalendars();
      setCalendarOptions(cals.map((c) => ({ id: c.id, title: c.title })));
      // Auto-enable calendar if the user was blocked by missing permissions and just granted them
      if (pendingCalendarEnableRef.current) {
        pendingCalendarEnableRef.current = false;
        setSetting('calendar_integration_enabled', '1');
        setCalendarEnabled(true);
      }
    }
  }, []);

  const checkNotificationPermissions = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    const granted = status === 'granted';
    setNotificationPermissionGranted(granted);
    // Auto-enable smart reminders if the user was blocked by missing permissions and just granted them
    if (granted && pendingSmartRemindersEnableRef.current) {
      pendingSmartRemindersEnableRef.current = false;
      setSetting('smart_reminders_count', '1');
      setSmartRemindersCount(1);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGoalSettings();
      checkCalendarPermissions();
      checkWeatherPermissions();
      checkNotificationPermissions();
      refreshBatteryOptimizationStatus();

      const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') {
          loadGoalSettings();
          checkCalendarPermissions();
          checkWeatherPermissions();
          checkNotificationPermissions();
          refreshBatteryOptimizationStatus();
        }
      });
      return () => sub.remove();
    }, [
      loadGoalSettings,
      checkCalendarPermissions,
      checkWeatherPermissions,
      checkNotificationPermissions,
      refreshBatteryOptimizationStatus,
    ])
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

  const cycleSmartRemindersCount = () => {
    const idx = SMART_REMINDERS_OPTIONS.indexOf(smartRemindersCount);
    const next = SMART_REMINDERS_OPTIONS[(idx + 1) % SMART_REMINDERS_OPTIONS.length];
    // When enabling smart reminders (0 → positive value), check notification permission first
    if (smartRemindersCount === 0 && next > 0 && !notificationPermissionGranted) {
      pendingSmartRemindersEnableRef.current = true;
      showNotificationPermissionSheet();
      return;
    }
    setSetting('smart_reminders_count', String(next));
    setSmartRemindersCount(next);
  };

  const cycleCatchupRemindersCount = () => {
    const catchupOptions = [0, 1, 2, 3] as const;
    const idx = catchupOptions.indexOf(catchupRemindersCount as 0 | 1 | 2 | 3);
    const next = catchupOptions[(idx + 1) % catchupOptions.length];
    setSetting('smart_catchup_reminders_count', String(next));
    setCatchupRemindersCount(next);
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

  const showWeatherPermissionSheet = useCallback(() => {
    pendingWeatherEnableRef.current = true;
    setPermissionSheet({
      title: t('settings_weather_permission_title'),
      body: t('settings_weather_location_permission_missing'),
      onOpen: handleOpenAppSettings,
    });
  }, []);

  const showCalendarPermissionSheet = useCallback(() => {
    pendingCalendarEnableRef.current = true;
    setPermissionSheet({
      title: t('settings_calendar_permission_title'),
      body: t('settings_calendar_permission_body'),
      onOpen: handleOpenAppSettings,
    });
  }, []);

  const showNotificationPermissionSheet = useCallback(() => {
    setPermissionSheet({
      title: t('settings_notification_permission_title'),
      body: t('settings_notification_permission_body'),
      onOpen: handleOpenAppSettings,
    });
  }, []);

  const showBatteryPermissionSheet = useCallback(() => {
    setPermissionSheet({
      title: t('settings_battery_optimization'),
      body: t('settings_battery_optimization_sublabel'),
      onOpen: async () => {
        const opened = await openBatteryOptimizationSettings();
        if (opened) {
          setBatteryOptimizationGranted(true);
          setSetting(BATTERY_OPTIMIZATION_SETTING_KEY, '1');
        }
      },
    });
  }, []);

  const toggleWeatherEnabled = (value: boolean) => {
    if (!value) {
      // User explicitly disabled weather – clear any pending enable
      pendingWeatherEnableRef.current = false;
    } else if (!weatherLocationGranted) {
      showWeatherPermissionSheet();
      return;
    }
    setSetting('weather_enabled', value ? '1' : '0');
    setWeatherEnabled(value);
  };

  const CALENDAR_BUFFER_OPTIONS = [10, 20, 30, 45, 60];
  const CALENDAR_DURATION_OPTIONS = [0, 5, 10, 15, 20, 30];

  const toggleCalendarIntegration = (value: boolean) => {
    if (!value) {
      // User explicitly disabled calendar – clear any pending enable
      pendingCalendarEnableRef.current = false;
    } else if (!calendarPermissionGranted) {
      showCalendarPermissionSheet();
      return;
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
        <RemindersSection
          smartRemindersCount={smartRemindersCount}
          catchupRemindersCount={catchupRemindersCount}
          notificationPermissionGranted={notificationPermissionGranted}
          batteryOptimizationGranted={batteryOptimizationGranted}
          onCycleSmartReminders={cycleSmartRemindersCount}
          onCycleCatchupReminders={cycleCatchupRemindersCount}
          onNavigateScheduledNotifications={() => navigation.navigate('ScheduledNotifications')}
          onShowNotificationPermissionSheet={showNotificationPermissionSheet}
          onShowBatteryPermissionSheet={showBatteryPermissionSheet}
        />

        {/* Weather */}
        <WeatherSection
          weatherEnabled={weatherEnabled}
          weatherLocationGranted={weatherLocationGranted}
          onToggleWeather={toggleWeatherEnabled}
          onShowWeatherPermissionSheet={showWeatherPermissionSheet}
          onNavigateWeatherSettings={() => navigation.navigate('WeatherSettings')}
        />

        {/* Calendar integration */}
        <CalendarSection
          calendarEnabled={calendarEnabled}
          calendarPermissionGranted={calendarPermissionGranted}
          calendarBuffer={calendarBuffer}
          calendarDuration={calendarDuration}
          calendarSelectedId={calendarSelectedId}
          calendarOptions={calendarOptions}
          onToggleCalendar={toggleCalendarIntegration}
          onCycleCalendarBuffer={cycleCalendarBuffer}
          onCycleCalendarDuration={cycleCalendarDuration}
          onSelectCalendar={handleSelectCalendar}
          onShowCalendarPermissionSheet={showCalendarPermissionSheet}
        />
      </ScrollView>

      {permissionSheet && (
        <PermissionExplainerSheet
          visible
          title={permissionSheet.title}
          body={permissionSheet.body}
          openSettingsLabel={permissionSheet.openLabel}
          onOpenSettings={permissionSheet.onOpen}
          onClose={() => setPermissionSheet(null)}
        />
      )}
    </>
  );
}
