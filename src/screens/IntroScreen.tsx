import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Platform, ActivityIndicator, AppState, AppStateStatus, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { spacing, radius, shadows } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { t } from '../i18n';
import { toggleHealthConnect, toggleGPS, recheckHealthConnect, openHealthConnectSettings } from '../detection/index';
import { requestGPSPermissions, checkGPSPermissions } from '../detection/index';
import { requestNotificationPermissions } from '../notifications/notificationManager';
import { requestCalendarPermissions, hasCalendarPermissions } from '../calendar/calendarService';
import { getSetting, setSetting } from '../storage/database';
import EditLocationSheet from '../components/EditLocationSheet';

interface Props {
  onComplete: () => void;
}

type Step = 'welcome' | 'health-connect' | 'location' | 'notifications' | 'calendar' | 'ready';

export default function IntroScreen({ onComplete }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [healthConnectGranted, setHealthConnectGranted] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [calendarGranted, setCalendarGranted] = useState(false);
  const [calendarBuffer, setCalendarBuffer] = useState(30);
  const [calendarDuration, setCalendarDuration] = useState(0);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [homeSet, setHomeSet] = useState(false);
  const [workSet, setWorkSet] = useState(false);
  const [fetchingLocationType, setFetchingLocationType] = useState<'home' | 'work' | null>(null);
  const [introSheetVisible, setIntroSheetVisible] = useState(false);
  const [introSheetCoords, setIntroSheetCoords] = useState<{ latitude: number; longitude: number } | undefined>();
  const [introSheetLabel, setIntroSheetLabel] = useState('');
  const [pendingLocationType, setPendingLocationType] = useState<'home' | 'work' | null>(null);

  const steps: Step[] = ['welcome', 'health-connect', 'location', 'notifications', 'calendar', 'ready'];
  const currentIndex = steps.indexOf(currentStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  // Load saved calendar settings on mount
  useEffect(() => {
    const rawBuffer = getSetting('calendar_buffer_minutes', '30');
    const parsedBuffer = parseInt(rawBuffer, 10);
    setCalendarBuffer(Number.isNaN(parsedBuffer) ? 30 : parsedBuffer);

    const rawDuration = getSetting('calendar_default_duration', '0');
    const parsedDuration = parseInt(rawDuration, 10);
    setCalendarDuration(Number.isNaN(parsedDuration) ? 0 : parsedDuration);
  }, []);

  // Re-check permissions when app comes back to foreground
  // (user may have granted permissions in Health Connect or Android Settings)
  const checkPermissions = useCallback(async () => {
    // Only check permissions on relevant steps
    if (currentStep === 'health-connect' && Platform.OS === 'android') {
      const hcGranted = await recheckHealthConnect();
      setHealthConnectGranted(hcGranted);
    } else if (currentStep === 'location') {
      const gpsGranted = await checkGPSPermissions();
      setLocationGranted(gpsGranted);
    } else if (currentStep === 'notifications') {
      // Check notification permissions
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationsGranted(status === 'granted');
    } else if (currentStep === 'calendar') {
      const calGranted = await hasCalendarPermissions();
      setCalendarGranted(calGranted);
      if (calGranted && getSetting('calendar_integration_enabled', '0') !== '1') {
        setSetting('calendar_integration_enabled', '1');
      }
    } else if (currentStep === 'ready') {
      // Refresh all permissions so the summary stays accurate
      if (Platform.OS === 'android') {
        const hcGranted = await recheckHealthConnect();
        setHealthConnectGranted(hcGranted);
      }
      const gpsGranted = await checkGPSPermissions();
      setLocationGranted(gpsGranted);
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationsGranted(status === 'granted');
      const calGranted = await hasCalendarPermissions();
      setCalendarGranted(calGranted);
    }
  }, [currentStep]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkPermissions();
      }
    });

    return () => subscription.remove();
  }, [checkPermissions]);

  // Check permissions when entering permission-related steps
  useEffect(() => {
    if (currentStep === 'health-connect' || currentStep === 'location' || currentStep === 'notifications' || currentStep === 'calendar' || currentStep === 'ready') {
      checkPermissions();
    }
  }, [currentStep, checkPermissions]);

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleRequestHealthConnect = async () => {
    setRequestingPermission(true);
    try {
      // Enable the user toggle and check current permissions.
      const result = await toggleHealthConnect(true);
      if (result.needsPermissions) {
        // Permissions not yet granted — open Health Connect so the user can allow them.
        // When the user returns, the AppState listener fires checkPermissions() which
        // calls recheckHealthConnect() and updates healthConnectGranted.
        await openHealthConnectSettings();
      } else {
        setHealthConnectGranted(true);
      }
    } catch (error) {
      console.error('Error requesting Health Connect:', error);
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleRequestLocation = async () => {
    setRequestingPermission(true);
    try {
      // Enable the user toggle and check current permissions.
      const result = await toggleGPS(true);
      if (result.needsPermissions) {
        // Permissions not yet granted — request them inline via the OS dialog.
        const granted = await requestGPSPermissions();
        setLocationGranted(granted);
      } else {
        setLocationGranted(true);
      }
    } catch (error) {
      console.error('Error requesting location:', error);
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleSetKnownLocation = async (type: 'home' | 'work') => {
    setFetchingLocationType(type);
    try {
      const cachedPosition = await Location.getLastKnownPositionAsync();
      const pos = cachedPosition ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!pos) {
        Alert.alert(t('location_position_error_title'), t('location_position_error_body'));
        return;
      }
      setIntroSheetCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setIntroSheetLabel(type === 'home' ? 'Home' : 'Work');
      setPendingLocationType(type);
      setIntroSheetVisible(true);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(t('location_position_error_title'), t('location_position_error_body'));
    } finally {
      setFetchingLocationType(null);
    }
  };

  const handleIntroSheetSave = () => {
    if (pendingLocationType === 'home') {
      setHomeSet(true);
    } else if (pendingLocationType === 'work') {
      setWorkSet(true);
    }
    setPendingLocationType(null);
    setIntroSheetVisible(false);
  };

  const handleIntroSheetClose = () => {
    setPendingLocationType(null);
    setIntroSheetVisible(false);
  };

  const handleRequestNotifications = async () => {
    setRequestingPermission(true);
    try {
      const granted = await requestNotificationPermissions();
      setNotificationsGranted(granted);
    } catch (error) {
      console.error('Error requesting notifications:', error);
    } finally {
      setRequestingPermission(false);
    }
  };

  const CALENDAR_BUFFER_OPTIONS = [10, 20, 30, 45, 60];
  const CALENDAR_DURATION_OPTIONS = [0, 5, 10, 15, 20, 30];

  const handleRequestCalendar = async () => {
    setRequestingPermission(true);
    try {
      const granted = await requestCalendarPermissions();
      setCalendarGranted(granted);
      if (granted) {
        setSetting('calendar_integration_enabled', '1');
      }
    } catch (error) {
      console.error('Error requesting calendar:', error);
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleCycleCalendarBuffer = () => {
    const idx = CALENDAR_BUFFER_OPTIONS.indexOf(calendarBuffer);
    const next = CALENDAR_BUFFER_OPTIONS[(idx + 1) % CALENDAR_BUFFER_OPTIONS.length];
    setSetting('calendar_buffer_minutes', String(next));
    setCalendarBuffer(next);
  };

  const handleCycleCalendarDuration = () => {
    const idx = CALENDAR_DURATION_OPTIONS.indexOf(calendarDuration);
    const next = CALENDAR_DURATION_OPTIONS[(idx + 1) % CALENDAR_DURATION_OPTIONS.length];
    setSetting('calendar_default_duration', String(next));
    setCalendarDuration(next);
  };

  return (
    <>
      <EditLocationSheet
        visible={introSheetVisible}
        location={null}
        initialCoords={introSheetCoords}
        initialLabel={introSheetLabel}
        onClose={handleIntroSheetClose}
        onSave={handleIntroSheetSave}
      />
      <SafeAreaView style={styles.container}>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {currentStep === 'welcome' && <WelcomeStep />}
          {currentStep === 'health-connect' && (
            <HealthConnectStep
              onRequest={handleRequestHealthConnect}
              granted={healthConnectGranted}
              requesting={requestingPermission}
            />
          )}
          {currentStep === 'location' && (
            <LocationStep
              onRequest={handleRequestLocation}
              granted={locationGranted}
              requesting={requestingPermission}
              homeSet={homeSet}
              workSet={workSet}
              settingLocation={fetchingLocationType}
              onSetLocation={handleSetKnownLocation}
            />
          )}
          {currentStep === 'notifications' && (
            <NotificationsStep
              onRequest={handleRequestNotifications}
              granted={notificationsGranted}
              requesting={requestingPermission}
            />
          )}
          {currentStep === 'calendar' && (
            <CalendarStep
              onRequest={handleRequestCalendar}
              granted={calendarGranted}
              requesting={requestingPermission}
              calendarBuffer={calendarBuffer}
              calendarDuration={calendarDuration}
              onCycleBuffer={handleCycleCalendarBuffer}
              onCycleDuration={handleCycleCalendarDuration}
            />
          )}
          {currentStep === 'ready' && (
            <ReadyStep
              healthConnectGranted={healthConnectGranted}
              locationGranted={locationGranted}
              notificationsGranted={notificationsGranted}
              calendarGranted={calendarGranted}
            />
          )}
        </ScrollView>

        {/* Bottom buttons */}
        <View style={styles.footer}>
          {currentStep !== 'ready' && (
            <TouchableOpacity onPress={handleSkip}>
              <Text style={styles.skipBtn}>{t('intro_skip')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>
              {currentStep === 'ready' ? t('intro_get_started') : t('intro_next')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

function WelcomeStep() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>🌱</Text>
      <Text style={styles.title}>{t('intro_welcome_title')}</Text>
      <Text style={styles.body}>{t('intro_welcome_body')}</Text>
      <View style={styles.featureList}>
        <FeatureItem icon="👟" text={t('intro_welcome_feature_1')} />
        <FeatureItem icon="📍" text={t('intro_welcome_feature_2')} />
        <FeatureItem icon="🎯" text={t('intro_welcome_feature_3')} />
        <FeatureItem icon="🔒" text={t('intro_welcome_feature_4')} />
      </View>
    </View>
  );
}

function HealthConnectStep({ onRequest, granted, requesting }: { onRequest: () => void; granted: boolean; requesting: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>👟</Text>
      <Text style={styles.title}>{t('intro_hc_title')}</Text>
      <Text style={styles.body}>{t('intro_hc_body')}</Text>
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>{t('intro_hc_why_title')}</Text>
        <Text style={styles.permissionBody}>{t('intro_hc_why_body')}</Text>
      </View>
      {Platform.OS === 'android' && (
        <TouchableOpacity
          style={[styles.permissionButton, granted && styles.permissionButtonGranted]}
          onPress={onRequest}
          disabled={granted || requesting}
        >
          {requesting ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.permissionButtonText}>
              {granted ? t('intro_hc_button_granted') : t('intro_hc_button')}
            </Text>
          )}
        </TouchableOpacity>
      )}
      <Text style={styles.hint}>{t('intro_hc_hint')}</Text>
    </View>
  );
}

function LocationStep({
  onRequest,
  granted,
  requesting,
  homeSet,
  workSet,
  settingLocation,
  onSetLocation,
}: {
  onRequest: () => void;
  granted: boolean;
  requesting: boolean;
  homeSet: boolean;
  workSet: boolean;
  settingLocation: 'home' | 'work' | null;
  onSetLocation: (type: 'home' | 'work') => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>📍</Text>
      <Text style={styles.title}>{t('intro_location_title')}</Text>
      <Text style={styles.body}>{t('intro_location_body')}</Text>
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>{t('intro_location_why_title')}</Text>
        <Text style={styles.permissionBody}>{t('intro_location_why_body')}</Text>
      </View>
      <TouchableOpacity
        style={[styles.permissionButton, granted && styles.permissionButtonGranted]}
        onPress={onRequest}
        disabled={granted || requesting}
      >
        {requesting ? (
          <ActivityIndicator size="small" color={colors.textInverse} />
        ) : (
          <Text style={styles.permissionButtonText}>
            {granted ? t('intro_location_button_granted') : t('intro_location_button')}
          </Text>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>{t('intro_location_hint')}</Text>
      {granted && (
        <View style={styles.knownLocationsCard}>
          <Text style={styles.knownLocationsTitle}>{t('intro_location_known_title')}</Text>
          <Text style={styles.knownLocationsBody}>{t('intro_location_known_body')}</Text>
          <View style={styles.knownLocationsButtons}>
            <TouchableOpacity
              style={[styles.knownLocationBtn, homeSet && styles.knownLocationBtnDone]}
              onPress={() => onSetLocation('home')}
              disabled={homeSet || settingLocation !== null}
            >
              {settingLocation === 'home' ? (
                <ActivityIndicator size="small" color={homeSet ? colors.grassDark : colors.textInverse} />
              ) : (
                <Text style={[styles.knownLocationBtnText, homeSet && styles.knownLocationBtnTextDone]}>
                  {homeSet ? t('intro_location_known_set_home_done') : `🏠 ${t('intro_location_known_set_home')}`}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.knownLocationBtn, workSet && styles.knownLocationBtnDone]}
              onPress={() => onSetLocation('work')}
              disabled={workSet || settingLocation !== null}
            >
              {settingLocation === 'work' ? (
                <ActivityIndicator size="small" color={workSet ? colors.grassDark : colors.textInverse} />
              ) : (
                <Text style={[styles.knownLocationBtnText, workSet && styles.knownLocationBtnTextDone]}>
                  {workSet ? t('intro_location_known_set_work_done') : `🏢 ${t('intro_location_known_set_work')}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.knownLocationsHint}>{t('intro_location_known_hint')}</Text>
        </View>
      )}
    </View>
  );
}

function NotificationsStep({ onRequest, granted, requesting }: { onRequest: () => void; granted: boolean; requesting: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>🔔</Text>
      <Text style={styles.title}>{t('intro_notifications_title')}</Text>
      <Text style={styles.body}>{t('intro_notifications_body')}</Text>
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>{t('intro_notifications_why_title')}</Text>
        <Text style={styles.permissionBody}>{t('intro_notifications_why_body')}</Text>
      </View>
      <TouchableOpacity
        style={[styles.permissionButton, granted && styles.permissionButtonGranted]}
        onPress={onRequest}
        disabled={granted || requesting}
      >
        {requesting ? (
          <ActivityIndicator size="small" color={colors.textInverse} />
        ) : (
          <Text style={styles.permissionButtonText}>
            {granted ? t('intro_notifications_button_granted') : t('intro_notifications_button')}
          </Text>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>{t('intro_notifications_hint')}</Text>
    </View>
  );
}

function ReadyStep({ healthConnectGranted, locationGranted, notificationsGranted, calendarGranted }: { 
  healthConnectGranted: boolean; 
  locationGranted: boolean; 
  notificationsGranted: boolean;
  calendarGranted: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Determine the status symbol for each permission
  const getStatusSymbol = (granted: boolean) => granted ? '✓' : '-';
  const getStatusColor = (granted: boolean) => granted ? colors.grass : colors.textMuted;

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>✨</Text>
      <Text style={styles.title}>{t('intro_ready_title')}</Text>
      <Text style={styles.body}>{t('intro_ready_body')}</Text>
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 {t('intro_ready_tip_title')}</Text>
        <Text style={styles.tipBody}>{t('intro_ready_tip_body')}</Text>
      </View>
      <View style={styles.checklistCard}>
        <Text style={styles.checklistTitle}>{t('intro_ready_checklist_title')}</Text>
        <View style={styles.checklistItem}>
          <Text style={[styles.checklistBullet, { color: getStatusColor(healthConnectGranted) }]}>
            {getStatusSymbol(healthConnectGranted)}
          </Text>
          <Text style={styles.checklistText}>{t('intro_ready_checklist_item_hc')}</Text>
        </View>
        <View style={styles.checklistItem}>
          <Text style={[styles.checklistBullet, { color: getStatusColor(locationGranted) }]}>
            {getStatusSymbol(locationGranted)}
          </Text>
          <Text style={styles.checklistText}>{t('intro_ready_checklist_item_gps')}</Text>
        </View>
        <View style={styles.checklistItem}>
          <Text style={[styles.checklistBullet, { color: getStatusColor(notificationsGranted) }]}>
            {getStatusSymbol(notificationsGranted)}
          </Text>
          <Text style={styles.checklistText}>{t('intro_ready_checklist_item_notifications')}</Text>
        </View>
        <View style={styles.checklistItem}>
          <Text style={[styles.checklistBullet, { color: getStatusColor(calendarGranted) }]}>
            {getStatusSymbol(calendarGranted)}
          </Text>
          <Text style={styles.checklistText}>{t('intro_ready_checklist_item_calendar')}</Text>
        </View>
      </View>
    </View>
  );
}

function CalendarStep({
  onRequest,
  granted,
  requesting,
  calendarBuffer,
  calendarDuration,
  onCycleBuffer,
  onCycleDuration,
}: {
  onRequest: () => void;
  granted: boolean;
  requesting: boolean;
  calendarBuffer: number;
  calendarDuration: number;
  onCycleBuffer: () => void;
  onCycleDuration: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>📆</Text>
      <Text style={styles.title}>{t('intro_calendar_title')}</Text>
      <Text style={styles.body}>{t('intro_calendar_body')}</Text>
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>{t('intro_calendar_why_title')}</Text>
        <Text style={styles.permissionBody}>{t('intro_calendar_why_body')}</Text>
      </View>
      <TouchableOpacity
        style={[styles.permissionButton, granted && styles.permissionButtonGranted]}
        onPress={onRequest}
        disabled={granted || requesting}
      >
        {requesting ? (
          <ActivityIndicator size="small" color={colors.textInverse} />
        ) : (
          <Text style={styles.permissionButtonText}>
            {granted ? t('intro_calendar_button_granted') : t('intro_calendar_button')}
          </Text>
        )}
      </TouchableOpacity>
      <View style={styles.calendarSettingsCard}>
        <TouchableOpacity onPress={onCycleBuffer} style={styles.calendarSettingRow}>
          <View style={styles.calendarSettingContent}>
            <Text style={styles.calendarSettingLabel}>{t('intro_calendar_buffer_label')}</Text>
            <Text style={styles.calendarSettingDesc}>{t('intro_calendar_buffer_desc')}</Text>
          </View>
          <Text style={styles.valueChip}>
            {t('settings_calendar_buffer_minutes', { minutes: calendarBuffer })}
          </Text>
        </TouchableOpacity>
        <View style={styles.calendarSettingDivider} />
        <TouchableOpacity onPress={onCycleDuration} style={styles.calendarSettingRow}>
          <View style={styles.calendarSettingContent}>
            <Text style={styles.calendarSettingLabel}>{t('intro_calendar_duration_label')}</Text>
            <Text style={styles.calendarSettingDesc}>{t('intro_calendar_duration_desc')}</Text>
          </View>
          <Text style={styles.valueChip}>
            {calendarDuration === 0
              ? t('settings_calendar_duration_off')
              : t('settings_calendar_duration_minutes', { minutes: calendarDuration })}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>{t('intro_calendar_hint')}</Text>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.fog,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.grass,
    borderRadius: radius.full,
  },

  content: { flex: 1 },
  contentInner: {
    padding: spacing.md,
    paddingTop: spacing.xxl,
  },

  stepContainer: {
    flex: 1,
    alignItems: 'center',
  },
  emoji: { fontSize: 80, marginBottom: spacing.lg },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
  },

  featureList: {
    width: '100%',
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.soft,
  },
  featureIcon: { fontSize: 24, marginRight: spacing.md },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },

  permissionCard: {
    width: '100%',
    backgroundColor: colors.grassPale,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.grass,
    marginBottom: spacing.xs,
  },
  permissionBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  permissionButton: {
    width: '100%',
    backgroundColor: colors.grass,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  permissionButtonGranted: {
    backgroundColor: colors.grassDark,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textInverse,
  },

  tipCard: {
    width: '100%',
    backgroundColor: colors.warningSurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.warningText,
    marginBottom: spacing.xs,
  },
  tipBody: {
    fontSize: 14,
    color: colors.warningText,
    lineHeight: 20,
  },
  checklistCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.soft,
  },
  checklistTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  checklistBullet: {
    width: 16,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 20,
  },
  checklistText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },

  knownLocationsCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadows.soft,
  },
  knownLocationsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  knownLocationsBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  knownLocationsButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  knownLocationBtn: {
    flex: 1,
    backgroundColor: colors.grass,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    ...shadows.soft,
  },
  knownLocationBtnDone: {
    backgroundColor: colors.grassPale,
  },
  knownLocationBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textInverse,
  },
  knownLocationBtnTextDone: {
    color: colors.grassDark,
  },
  knownLocationsHint: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    textAlign: 'center',
  },

  calendarSettingsCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  calendarSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  calendarSettingContent: {
    flex: 1,
  },
  calendarSettingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  calendarSettingDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  calendarSettingDivider: {
    height: 1,
    backgroundColor: colors.fog,
    marginLeft: spacing.md,
  },
  valueChip: {
    fontSize: 13,
    color: colors.grass,
    fontWeight: '600',
    backgroundColor: colors.grassPale,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.fog,
  },
  skipBtn: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '500',
  },
  nextBtn: {
    backgroundColor: colors.grass,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.soft,
  },
  nextBtnText: {
    fontSize: 16,
    color: colors.textInverse,
    fontWeight: '700',
  },
  });
}
