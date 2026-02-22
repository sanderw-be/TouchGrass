import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Alert, Linking, Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSetting, setSetting, getKnownLocations, getSuggestedLocations, KnownLocation, clearAllData } from '../storage/database';
import { getDetectionStatus, requestHealthConnect, recheckHealthConnect, checkGPSPermissions, requestGPSPermissions, openHealthConnectSettings } from '../detection/index';
import { AppState, AppStateStatus } from 'react-native';
import { colors, spacing, radius, shadows } from '../utils/theme';
import { t } from '../i18n';
import i18n from '../i18n';
import type { SettingsStackParamList } from '../navigation/AppNavigator';
import { requestCalendarPermissions, hasCalendarPermissions } from '../calendar/calendarService';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
];

export default function SettingsScreen() {
  const navigation = useNavigation<StackNavigationProp<SettingsStackParamList>>();
  const insets = useSafeAreaInsets();
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState({ healthConnect: false, gps: false });
  const [knownLocations, setKnownLocations] = useState<KnownLocation[]>([]);
  const [suggestedCount, setSuggestedCount] = useState(0);
  const [language, setLanguage] = useState(i18n.locale);
  const [connectingHC, setConnectingHC] = useState(false);
  
  // Weather state - only the main toggle
  const [weatherEnabled, setWeatherEnabled] = useState(true);

  // Calendar state
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [calendarPermissionGranted, setCalendarPermissionGranted] = useState(false);
  const [calendarBuffer, setCalendarBuffer] = useState(30);
  const [calendarDuration, setCalendarDuration] = useState(0);

  const loadStatus = useCallback(() => {
    setRemindersEnabled(getSetting('reminders_enabled', '1') === '1');
    setDetectionStatus(getDetectionStatus());
    setKnownLocations(getKnownLocations());
    setSuggestedCount(getSuggestedLocations().length);
    setLanguage(i18n.locale);
    
    // Load weather settings
    setWeatherEnabled(getSetting('weather_enabled', '1') === '1');

    // Load calendar settings
    setCalendarEnabled(getSetting('calendar_integration_enabled', '0') === '1');
    setCalendarBuffer(parseInt(getSetting('calendar_buffer_minutes', '30'), 10));
    setCalendarDuration(parseInt(getSetting('calendar_default_duration', '0'), 10));
  }, []);

  // Check permissions and show success message if Health Connect was just enabled
  const checkAndUpdatePermissions = useCallback(async () => {
    // Get current status before rechecking
    const currentStatus = getDetectionStatus();
    const previousHCStatus = currentStatus.healthConnect;
    
    await recheckHealthConnect();
    await checkGPSPermissions();
    
    // Reload status after permission checks complete
    const newStatus = getDetectionStatus();
    setDetectionStatus(newStatus);
    
    // If Health Connect was just enabled, show success message
    if (!previousHCStatus && newStatus.healthConnect) {
      Alert.alert(
        t('settings_hc_verified_title'),
        t('settings_hc_verified_body'),
      );
    }

    // Refresh calendar permission status
    const calGranted = await hasCalendarPermissions();
    setCalendarPermissionGranted(calGranted);
  }, []);

  useFocusEffect(useCallback(() => {
    loadStatus();

    // Re-check Health Connect and GPS when screen comes into focus
    // (user may have granted permissions in Android Settings or Health Connect)
    checkAndUpdatePermissions();

    // Also re-check when app comes back to foreground
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkAndUpdatePermissions();
      }
    });
    return () => sub.remove();
  }, [loadStatus, checkAndUpdatePermissions]));

  const handleConnectHealthConnect = async () => {
    setConnectingHC(true);
    
    try {
      // Request Health Connect (this will open the Health Connect app)
      const opened = await requestHealthConnect();
      
      if (!opened) {
        // If we couldn't open Health Connect, show instructions
        setConnectingHC(false);
        Alert.alert(
          t('settings_hc_failed_title'),
          t('settings_hc_failed_body'),
        );
        return;
      }
      
      // Health Connect was opened - user will grant permissions there
      // We'll verify when they return (via AppState listener)
      // For now, just reset the connecting state after a delay
      setTimeout(() => {
        setConnectingHC(false);
        // Recheck will happen automatically when app comes to foreground
      }, 1000);
      
    } catch (error) {
      console.error('Error connecting to Health Connect:', error);
      setConnectingHC(false);
      Alert.alert(
        t('settings_hc_failed_title'),
        t('settings_hc_failed_body'),
      );
    }
  };

  const handleOpenHealthConnectSettings = async () => {
    try {
      // Use the dedicated function for managing existing permissions
      // This always tries to open Health Connect, even when already connected
      const opened = await openHealthConnectSettings();
      
      if (!opened) {
        Alert.alert(
          t('settings_hc_open_error_title'),
          t('settings_hc_open_error_body'),
        );
      }
    } catch (error) {
      console.error('Error opening Health Connect settings:', error);
      Alert.alert(
        t('settings_hc_open_error_title'),
        t('settings_hc_open_error_body'),
      );
    }
  };

  const toggleReminders = (value: boolean) => {
    setSetting('reminders_enabled', value ? '1' : '0');
    setRemindersEnabled(value);
  };

  const changeLanguage = (code: string) => {
    i18n.locale = code;
    setSetting('language', code);
    setLanguage(code);
    Alert.alert(
      t('settings_language_changed_title'),
      t('settings_language_changed_body'),
    );
  };

  const handleClearData = () => {
    Alert.alert(
      t('settings_clear_data_confirm_title'),
      t('settings_clear_data_confirm_body'),
      [
        { text: t('settings_clear_cancel'), style: 'cancel' },
        {
          text: t('settings_clear_delete'),
          style: 'destructive',
          onPress: () => {
            try {
              clearAllData();
              loadStatus(); // Reload to show reset state
              Alert.alert(
                t('settings_clear_data_success_title'),
                t('settings_clear_data_success_body'),
              );
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert(
                t('settings_clear_data_error_title'),
                t('settings_clear_data_error_body'),
              );
            }
          },
        },
      ]
    );
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
      Alert.alert(
        t('settings_error_title'),
        t('settings_error_open_settings_failed'),
      );
    }
  };

  const handleRequestGPSPermission = async () => {
    const granted = await requestGPSPermissions();
    setDetectionStatus(getDetectionStatus());
    if (!granted) {
      Alert.alert(
        t('settings_gps_permission_required_title'),
        t('settings_gps_permission_required_body'),
        [
          { text: t('settings_permission_cancel'), style: 'cancel' },
          { text: t('settings_permission_open'), onPress: handleOpenAppSettings },
        ]
      );
    }
  };

  const toggleWeatherEnabled = (value: boolean) => {
    setSetting('weather_enabled', value ? '1' : '0');
    setWeatherEnabled(value);
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
          ],
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

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>{t('nav_settings')}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Detection sources */}
        <Text style={styles.sectionHeader}>{t('settings_section_detection')}</Text>
        <View style={styles.card}>
          <DetectionSettingRow
            active={detectionStatus.healthConnect}
            icon="👟"
            label={t('settings_health_connect')}
            onPress={detectionStatus.healthConnect ? handleOpenHealthConnectSettings : handleConnectHealthConnect}
            isLoading={connectingHC}
          />
          <Divider />
          <DetectionSettingRow
            active={detectionStatus.gps}
            icon="📍"
            label={t('settings_gps')}
            onPress={handleOpenAppSettings}
          />
        </View>

      {/* Known locations */}
      <Text style={styles.sectionHeader}>{t('settings_section_locations')}</Text>
      <View style={styles.card}>
        <TouchableOpacity onPress={() => navigation.navigate('KnownLocations')}>
          <SettingRow
            icon="📍"
            label={t('settings_locations_manage')}
            sublabel={
              knownLocations.length > 0
                ? t('settings_locations_count', { count: knownLocations.length })
                : t('settings_locations_manage_desc')
            }
            right={
              <View style={styles.locationRight}>
                {suggestedCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{suggestedCount}</Text>
                  </View>
                )}
                <Text style={styles.chevron}>›</Text>
              </View>
            }
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>{t('settings_section_reminders')}</Text>
      <View style={styles.card}>
        <SettingRow
          icon="🔔"
          label={t('settings_reminders_label')}
          sublabel={t('settings_reminders_sublabel')}
          right={
            <Switch
              value={remindersEnabled}
              onValueChange={toggleReminders}
              trackColor={{ false: colors.fog, true: colors.grassLight }}
              thumbColor={remindersEnabled ? colors.grass : colors.inactive}
            />
          }
        />
        <Divider />
        <TouchableOpacity onPress={() => navigation.navigate('ScheduledNotifications')}>
          <SettingRow
            icon="📅"
            label={t('settings_scheduled_reminders')}
            sublabel={t('settings_scheduled_reminders_sublabel')}
            right={<Text style={styles.chevron}>›</Text>}
          />
        </TouchableOpacity>
        <Divider />
        <SettingRow
          icon="📡"
          label={t('settings_background_tracking_label')}
          sublabel={t('settings_background_tracking_sublabel')}
        />
      </View>

      {/* Weather settings */}
      <Text style={styles.sectionHeader}>{t('settings_weather_title')}</Text>
      <View style={styles.card}>
        <SettingRow
          icon="🌤️"
          label={t('settings_weather_enabled')}
          sublabel={t('settings_weather_enabled_desc')}
          right={
            <Switch
              value={weatherEnabled}
              onValueChange={toggleWeatherEnabled}
              trackColor={{ false: colors.fog, true: colors.grassLight }}
              thumbColor={weatherEnabled ? colors.grass : colors.inactive}
            />
          }
        />
        {weatherEnabled && (
          <>
            <Divider />
            <TouchableOpacity
              onPress={() => navigation.navigate('WeatherSettings')}
            >
              <SettingRow
                icon="⚙️"
                label={t('settings_weather_more')}
                sublabel={t('settings_weather_more_desc')}
                right={
                  <Text style={styles.chevron}>›</Text>
                }
              />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Calendar integration */}
      <Text style={styles.sectionHeader}>{t('settings_section_calendar')}</Text>
      <View style={styles.card}>
        <SettingRow
          icon="📆"
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
                icon="⏱️"
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
                icon="🕐"
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
          </>
        )}
      </View>

      <Text style={styles.sectionHeader}>{t('settings_section_language')}</Text>
      <View style={styles.card}>
        {LANGUAGES.map((lang, i) => (
          <View key={lang.code}>
            {i > 0 && <Divider />}
            <TouchableOpacity
              style={styles.row}
              onPress={() => changeLanguage(lang.code)}
            >
              <Text style={styles.rowLabel}>{lang.label}</Text>
              {language === lang.code && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <Text style={styles.sectionHeader}>{t('settings_section_about')}</Text>
      <View style={styles.card}>
        <SettingRow icon="🌿" label="TouchGrass" sublabel={t('settings_app_sublabel')} />
        <Divider />
        <SettingRow icon="🔒" label={t('settings_privacy')} sublabel={t('settings_privacy_sublabel')} />
        <Divider />
        <SettingRow
          icon="🗑️"
          label={t('settings_clear_data')}
          sublabel={t('settings_clear_data_sublabel')}
          right={
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={handleClearData}
            >
              <Text style={styles.dangerBtnText}>{t('settings_clear_data')}</Text>
            </TouchableOpacity>
          }
        />
      </View>

    </ScrollView>
    </>
  );
}

function SettingRow({
  icon, label, sublabel, right,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      {right && <View style={styles.rowRight}>{right}</View>}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <View style={[styles.statusDot, active ? styles.statusDotActive : styles.statusDotInactive]} />
  );
}

function DetectionSettingRow({
  active,
  icon,
  label,
  onPress,
  isLoading,
}: {
  active: boolean;
  icon: string;
  label: string;
  onPress: () => void;
  isLoading?: boolean;
}) {
  return (
    <View style={styles.row}>
      {active && <StatusDot active={true} />}
      <Text style={[styles.rowIcon, active && styles.rowIconWithDot]}>{icon}</Text>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={onPress}
        disabled={isLoading}
      >
        <Text style={styles.settingsBtnText}>
          {isLoading ? '...' : '⚙️'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.textInverse,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.soft,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  rowIcon: { fontSize: 20, marginRight: spacing.md, width: 28, textAlign: 'center' },
  rowIconWithDot: { marginLeft: spacing.sm },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  rowSublabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowRight: { marginLeft: spacing.sm },

  divider: { height: 1, backgroundColor: colors.fog, marginLeft: spacing.md + 28 + spacing.md },

  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusDotActive: { backgroundColor: colors.grass },
  statusDotInactive: { backgroundColor: colors.inactive },

  settingsBtn: {
    backgroundColor: colors.grassPale,
    borderRadius: radius.full,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnText: { fontSize: 16 },

  editBtn: {
    backgroundColor: colors.grassPale,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  editBtnText: { fontSize: 12, color: colors.grass, fontWeight: '600' },
  connectBtn: {
    backgroundColor: colors.grass,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  connectBtnText: { fontSize: 12, color: colors.textInverse, fontWeight: '600' },

  dangerBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  dangerBtnText: { fontSize: 12, color: colors.error, fontWeight: '600' },

  checkmark: { fontSize: 18, color: colors.grass, fontWeight: '700', marginLeft: spacing.md },
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

  permissionWarning: {
    backgroundColor: '#FEF3C7',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  permissionWarningText: { fontSize: 12, color: '#92400E', lineHeight: 18 },

  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    padding: spacing.md,
    lineHeight: 20,
  },

  locationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    backgroundColor: colors.error,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, color: colors.textInverse, fontWeight: '700' },
});
