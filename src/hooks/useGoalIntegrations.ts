import { useState, useCallback, useRef, useMemo } from 'react';
import { Platform, Linking, Alert, AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import * as Calendar from 'expo-calendar';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from '@react-navigation/native';
import { getSettingAsync, setSettingAsync } from '../storage';
import { notificationInfrastructureService } from '../notifications/notificationManager';
import {
  hasCalendarPermissions,
  getWritableCalendars,
  getOrCreateTouchGrassCalendar,
  getSelectedCalendarId,
  setSelectedCalendarId,
  requestCalendarPermissions,
} from '../calendar/calendarService';
import { checkWeatherLocationPermissions, requestWeatherLocationPermissions } from '../detection';
import {
  BATTERY_OPTIMIZATION_SETTING_KEY,
  refreshBatteryOptimizationSetting,
  openBatteryOptimizationSettings,
} from '../utils/batteryOptimization';
import { emitPermissionIssuesChanged } from '../utils/permissionIssuesChangedEmitter';
import { t } from '../i18n';
import { PermissionSheetConfig } from '../components/PermissionExplainerSheet';
import { CATCHUP_REMINDERS_OPTIONS, CatchupRemindersOption } from '../components/goals/GoalsShared';
import {
  SMART_REMINDERS_OPTIONS,
  CALENDAR_BUFFER_OPTIONS,
  CALENDAR_DURATION_OPTIONS,
  getPermissionIssueLabels,
} from '../domain/ReminderDomain';

export function useGoalIntegrations() {
  // Reminders state
  const [smartRemindersCount, setSmartRemindersCount] = useState(2);
  const [catchupRemindersCount, setCatchupRemindersCount] = useState(2);
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);
  const [batteryOptimizationGranted, setBatteryOptimizationGranted] = useState(false);

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

  // Permission explainer sheet state
  const [permissionSheet, setPermissionSheet] = useState<PermissionSheetConfig | null>(null);

  // Refs for auto-enabling features after permission grant
  const pendingWeatherEnableRef = useRef(false);
  const pendingCalendarEnableRef = useRef(false);
  const pendingSmartRemindersEnableRef = useRef(false);
  const isFetchingRef = useRef(false);

  const loadIntegrationSettings = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const [smartCount, catchupCount, weatherEn, calEn, calBuf, calDur, selCal, battOpt] =
        await Promise.all([
          getSettingAsync('smart_reminders_count', '2'),
          getSettingAsync('smart_catchup_reminders_count', '2'),
          getSettingAsync('weather_enabled', '1'),
          getSettingAsync('calendar_integration_enabled', '0'),
          getSettingAsync('calendar_buffer_minutes', '30'),
          getSettingAsync('calendar_default_duration', '0'),
          getSelectedCalendarId(),
          getSettingAsync(BATTERY_OPTIMIZATION_SETTING_KEY, '0'),
        ]);
      setSmartRemindersCount(parseInt(smartCount, 10));
      setCatchupRemindersCount(parseInt(catchupCount, 10));
      setWeatherEnabled(weatherEn === '1');
      setCalendarEnabled(calEn === '1');
      setCalendarBuffer(parseInt(calBuf, 10));
      setCalendarDuration(parseInt(calDur, 10));
      setCalendarSelectedIdState(selCal);
      setBatteryOptimizationGranted(battOpt === '1');
    } catch (error) {
      console.error('[useGoalIntegrations.loadIntegrationSettings] Error:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  const refreshBatteryOptimizationStatus = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const granted = await refreshBatteryOptimizationSetting();
    setBatteryOptimizationGranted(granted);
  }, []);

  const checkWeatherPermissions = useCallback(async () => {
    const granted = await checkWeatherLocationPermissions();
    setWeatherLocationGranted(granted);
    if (granted && pendingWeatherEnableRef.current) {
      pendingWeatherEnableRef.current = false;
      await setSettingAsync('weather_enabled', '1');
      setWeatherEnabled(true);
      emitPermissionIssuesChanged();
    }
  }, []);

  const checkCalendarPermissions = useCallback(async () => {
    const granted = await hasCalendarPermissions();
    setCalendarPermissionGranted(granted);
    if (granted) {
      const cals = await getWritableCalendars();
      setCalendarOptions(cals.map((c) => ({ id: c.id, title: c.title })));
      if (pendingCalendarEnableRef.current) {
        pendingCalendarEnableRef.current = false;
        await setSettingAsync('calendar_integration_enabled', '1');
        setCalendarEnabled(true);
        emitPermissionIssuesChanged();
      }
    }
  }, []);

  const checkNotificationPermissions = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    const granted = status === 'granted';
    setNotificationPermissionGranted(granted);
    if (granted && pendingSmartRemindersEnableRef.current) {
      pendingSmartRemindersEnableRef.current = false;
      await setSettingAsync('smart_reminders_count', '1');
      setSmartRemindersCount(1);
      emitPermissionIssuesChanged();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadIntegrationSettings();
      checkCalendarPermissions();
      checkWeatherPermissions();
      checkNotificationPermissions();
      refreshBatteryOptimizationStatus();

      const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') {
          checkCalendarPermissions();
          checkWeatherPermissions();
          checkNotificationPermissions();
          refreshBatteryOptimizationStatus();
        }
      });
      return () => sub.remove();
    }, [
      loadIntegrationSettings,
      checkCalendarPermissions,
      checkWeatherPermissions,
      checkNotificationPermissions,
      refreshBatteryOptimizationStatus,
    ])
  );

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
      openLabel: t('settings_weather_location_request'),
      onOpen: async () => {
        const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' && canAskAgain === false) {
          await handleOpenAppSettings();
          setPermissionSheet(null);
          return;
        }
        const granted = await requestWeatherLocationPermissions();
        setWeatherLocationGranted(granted);
        if (granted) {
          pendingWeatherEnableRef.current = false;
          await setSettingAsync('weather_enabled', '1');
          setWeatherEnabled(true);
          emitPermissionIssuesChanged();
        } else {
          await handleOpenAppSettings();
        }
        setPermissionSheet(null);
      },
      onCancel: () => {
        pendingWeatherEnableRef.current = false;
      },
      onDisable: async () => {
        pendingWeatherEnableRef.current = false;
        try {
          await setSettingAsync('weather_enabled', '0');
          setWeatherEnabled(false);
          emitPermissionIssuesChanged();
        } catch (error) {
          console.error('[useGoalIntegrations.showWeatherPermissionSheet.onDisable] Error:', error);
        }
      },
    });
  }, []);

  const showCalendarPermissionSheet = useCallback(() => {
    pendingCalendarEnableRef.current = true;
    setPermissionSheet({
      title: t('settings_calendar_permission_title'),
      body: t('settings_calendar_permission_body'),
      openLabel: t('intro_calendar_button'),
      onOpen: async () => {
        const { status, canAskAgain } = await Calendar.getCalendarPermissionsAsync();
        if (status !== 'granted' && canAskAgain === false) {
          await handleOpenAppSettings();
          setPermissionSheet(null);
          return;
        }
        const granted = await requestCalendarPermissions();
        setCalendarPermissionGranted(granted);
        if (granted) {
          const cals = await getWritableCalendars();
          setCalendarOptions(cals.map((c) => ({ id: c.id, title: c.title })));
          pendingCalendarEnableRef.current = false;
          await setSettingAsync('calendar_integration_enabled', '1');
          setCalendarEnabled(true);
          emitPermissionIssuesChanged();
        } else {
          await handleOpenAppSettings();
        }
        setPermissionSheet(null);
      },
      onCancel: () => {
        pendingCalendarEnableRef.current = false;
      },
      onDisable: async () => {
        pendingCalendarEnableRef.current = false;
        try {
          await setSettingAsync('calendar_integration_enabled', '0');
          setCalendarEnabled(false);
          emitPermissionIssuesChanged();
        } catch (error) {
          console.error(
            '[useGoalIntegrations.showCalendarPermissionSheet.onDisable] Error:',
            error
          );
        }
      },
    });
  }, []);

  const showNotificationPermissionSheet = useCallback(() => {
    setPermissionSheet({
      title: t('settings_notification_permission_title'),
      body: t('settings_notification_permission_body'),
      openLabel: t('intro_notifications_button'),
      onOpen: async () => {
        const { status, canAskAgain } = await Notifications.getPermissionsAsync();
        if (status !== 'granted' && canAskAgain === false) {
          await handleOpenAppSettings();
          setPermissionSheet(null);
          return;
        }
        const granted = await notificationInfrastructureService.requestNotificationPermissions();
        setNotificationPermissionGranted(granted);
        if (granted) {
          pendingSmartRemindersEnableRef.current = false;
          await setSettingAsync('smart_reminders_count', '1');
          setSmartRemindersCount(1);
          emitPermissionIssuesChanged();
        }
        setPermissionSheet(null);
      },
      onCancel: () => {
        pendingSmartRemindersEnableRef.current = false;
      },
      onDisable: async () => {
        pendingSmartRemindersEnableRef.current = false;
        try {
          await setSettingAsync('smart_reminders_count', '0');
          setSmartRemindersCount(0);
          emitPermissionIssuesChanged();
        } catch (error) {
          console.error(
            '[useGoalIntegrations.showNotificationPermissionSheet.onDisable] Error:',
            error
          );
        }
      },
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
          await setSettingAsync(BATTERY_OPTIMIZATION_SETTING_KEY, '1');
        }
      },
    });
  }, []);

  const cycleSmartRemindersCount = async () => {
    const idx = SMART_REMINDERS_OPTIONS.indexOf(smartRemindersCount);
    const next = SMART_REMINDERS_OPTIONS[(idx + 1) % SMART_REMINDERS_OPTIONS.length];
    if (smartRemindersCount === 0 && next > 0 && !notificationPermissionGranted) {
      pendingSmartRemindersEnableRef.current = true;
      showNotificationPermissionSheet();
      return;
    }
    try {
      await setSettingAsync('smart_reminders_count', String(next));
      setSmartRemindersCount(next);
      emitPermissionIssuesChanged();
    } catch (error) {
      console.error('[useGoalIntegrations.cycleSmartRemindersCount] Error:', error);
    }
  };

  const cycleCatchupRemindersCount = async () => {
    const idx = CATCHUP_REMINDERS_OPTIONS.indexOf(catchupRemindersCount as CatchupRemindersOption);
    const next = CATCHUP_REMINDERS_OPTIONS[(idx + 1) % CATCHUP_REMINDERS_OPTIONS.length];
    try {
      await setSettingAsync('smart_catchup_reminders_count', String(next));
      setCatchupRemindersCount(next);
    } catch (error) {
      console.error('[useGoalIntegrations.cycleCatchupRemindersCount] Error:', error);
    }
  };

  const toggleWeatherEnabled = async (value: boolean) => {
    if (!value) {
      pendingWeatherEnableRef.current = false;
    } else if (!weatherLocationGranted) {
      showWeatherPermissionSheet();
      return;
    }
    try {
      await setSettingAsync('weather_enabled', value ? '1' : '0');
      setWeatherEnabled(value);
      emitPermissionIssuesChanged();
    } catch (error) {
      console.error('[useGoalIntegrations.toggleWeatherEnabled] Error:', error);
    }
  };

  const toggleCalendarIntegration = async (value: boolean) => {
    if (!value) {
      pendingCalendarEnableRef.current = false;
    } else if (!calendarPermissionGranted) {
      showCalendarPermissionSheet();
      return;
    }
    try {
      await setSettingAsync('calendar_integration_enabled', value ? '1' : '0');
      setCalendarEnabled(value);
      emitPermissionIssuesChanged();
    } catch (error) {
      console.error('[useGoalIntegrations.toggleCalendarIntegration] Error:', error);
    }
  };

  const cycleCalendarBuffer = async () => {
    const idx = CALENDAR_BUFFER_OPTIONS.indexOf(calendarBuffer);
    const next = CALENDAR_BUFFER_OPTIONS[(idx + 1) % CALENDAR_BUFFER_OPTIONS.length];
    try {
      await setSettingAsync('calendar_buffer_minutes', String(next));
      setCalendarBuffer(next);
    } catch (error) {
      console.error('[useGoalIntegrations.cycleCalendarBuffer] Error:', error);
    }
  };

  const cycleCalendarDuration = async () => {
    const idx = CALENDAR_DURATION_OPTIONS.indexOf(calendarDuration);
    const next = CALENDAR_DURATION_OPTIONS[(idx + 1) % CALENDAR_DURATION_OPTIONS.length];
    try {
      await setSettingAsync('calendar_default_duration', String(next));
      setCalendarDuration(next);
    } catch (error) {
      console.error('[useGoalIntegrations.cycleCalendarDuration] Error:', error);
    }
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

  const goalsPermissionIssues = useMemo(() => {
    return getPermissionIssueLabels(
      smartRemindersCount,
      notificationPermissionGranted,
      weatherEnabled,
      weatherLocationGranted,
      calendarEnabled,
      calendarPermissionGranted,
      {
        reminders: t('settings_reminders_label'),
        weather: t('settings_weather_enabled'),
        calendar: t('settings_calendar_integration'),
      }
    );
  }, [
    smartRemindersCount,
    notificationPermissionGranted,
    weatherEnabled,
    weatherLocationGranted,
    calendarEnabled,
    calendarPermissionGranted,
  ]);

  return {
    smartRemindersCount,
    catchupRemindersCount,
    notificationPermissionGranted,
    batteryOptimizationGranted,
    weatherEnabled,
    weatherLocationGranted,
    calendarEnabled,
    calendarPermissionGranted,
    calendarBuffer,
    calendarDuration,
    calendarSelectedId,
    calendarOptions,
    permissionSheet,
    setPermissionSheet,
    goalsPermissionIssues,
    cycleSmartRemindersCount,
    cycleCatchupRemindersCount,
    toggleWeatherEnabled,
    showWeatherPermissionSheet,
    toggleCalendarIntegration,
    showCalendarPermissionSheet,
    cycleCalendarBuffer,
    cycleCalendarDuration,
    handleSelectCalendar,
    showNotificationPermissionSheet,
    showBatteryPermissionSheet,
    loadIntegrationSettings,
  };
}
