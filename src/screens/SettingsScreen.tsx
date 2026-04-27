import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  BackHandler,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import Constants from 'expo-constants';

import { clearAllDataAsync, getSettingAsync, setSettingAsync } from '../storage';
import PermissionExplainerSheet from '../components/PermissionExplainerSheet';
import DiagnosticSheet from '../components/DiagnosticSheet';
import { SettingRow, Divider, DetectionSettingRow, Card } from '../components/ui';
import { ResponsiveGridList } from '../components/ResponsiveGridList';

import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { t, getDeviceSupportedLocale, TxKey } from '../i18n';
import { PRIVACY_POLICY_URL } from '../utils/constants';
import type { SettingsStackParamList } from '../navigation/AppNavigator';
import { useAppStore, ThemePreference } from '../store/useAppStore';
import { useDetectionSettings } from '../hooks/useDetectionSettings';
import {
  getSmartReminderScheduler,
  getReminderMessageBuilder,
} from '../notifications/notificationManager';
import { SmartReminderModule } from '../modules/SmartReminderModule';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  nl: 'Nederlands',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português (Portugal)',
  'pt-BR': 'Português (Brasil)',
  fr: 'Français',
  ja: '日本語',
};

const LANGUAGES = [
  { code: 'system', label: 'settings_theme_system', isTranslationKey: true },
  ...Object.entries(LANGUAGE_LABELS).map(([code, label]) => ({
    code,
    label,
    isTranslationKey: false,
  })),
];

export default function SettingsScreen() {
  const handleShowIntro = useAppStore((state) => state.handleShowIntro);
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const themePreference = useAppStore((state) => state.themePreference);
  const setThemePreference = useAppStore((state) => state.setThemePreference);
  const locale = useAppStore((state) => state.locale);
  const setLocale = useAppStore((state) => state.setLocale);

  const navigation = useNavigation<StackNavigationProp<SettingsStackParamList>>();

  const {
    detectionStatus,
    knownLocations,
    suggestedCount,
    togglingHC,
    togglingGPS,
    permissionSheet,
    isInitializing,
    setPermissionSheet,
    handleToggleHC,
    handleToggleGPS,
    showHCPermissionSheet,
    showGPSPermissionSheet,
  } = useDetectionSettings();

  // Update navigation header title reactively
  React.useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav_settings') });
  }, [navigation, locale]);

  const insets = useSafeAreaInsets();
  const [showDiagnosticSheet, setShowDiagnosticSheet] = React.useState(false);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [devForceHalfHour, setDevForceHalfHour] = React.useState(false);
  const languageSheetRef = useRef<BottomSheetModal>(null);
  const systemLocale = getDeviceSupportedLocale();

  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  // Load dev settings
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_SHOW_DEV_MENU === 'true') {
      getSettingAsync('dev_force_half_hour_reminders', 'false').then((val) => {
        setDevForceHalfHour(val === 'true');
      });
    }
  }, []);

  // Hardware back press to close language sheet
  useEffect(() => {
    if (!isSheetOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      languageSheetRef.current?.dismiss();
      return true; // Consume event
    });
    return () => sub.remove();
  }, [isSheetOpen]);

  const handleSheetChange = useCallback((index: number) => {
    setIsSheetOpen(index >= 0);
  }, []);

  const changeLanguage = (code: string) => {
    setLocale(code);
    languageSheetRef.current?.dismiss();
  };

  const presentLanguageSheet = () => {
    languageSheetRef.current?.present();
  };

  const getLanguageOptionLabel = (
    code: string,
    label: TxKey | string,
    isTranslationKey: boolean
  ) => {
    if (code === 'system') {
      return `${t(label as TxKey)} (${LANGUAGE_LABELS[systemLocale] ?? LANGUAGE_LABELS.en})`;
    }
    return isTranslationKey ? t(label as TxKey) : label;
  };

  const handleClearData = useCallback(() => {
    Alert.alert(t('settings_clear_data_confirm_title'), t('settings_clear_data_confirm_body'), [
      { text: t('settings_clear_cancel'), style: 'cancel' },
      {
        text: t('settings_clear_delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await clearAllDataAsync();
            handleShowIntro();
            Alert.alert(
              t('settings_clear_data_success_title'),
              t('settings_clear_data_success_body')
            );
          } catch (error) {
            console.error('Error clearing data:', error);
            Alert.alert(t('settings_clear_data_error_title'), t('settings_clear_data_error_body'));
          }
        },
      },
    ]);
  }, [handleShowIntro]);

  const handleClearDayPlan = useCallback(async () => {
    getSmartReminderScheduler()._resetSchedulingGuards();
    await setSettingAsync('reminders_last_planned_date', '');
    Alert.alert('Dev Menu', 'dayPlanLastDate cleared. Reminders will re-plan on next trigger.');
  }, []);

  const handleToggleDevForceHalfHour = useCallback(async () => {
    const newValue = !devForceHalfHour;
    setDevForceHalfHour(newValue);
    await setSettingAsync('dev_force_half_hour_reminders', newValue ? 'true' : 'false');
  }, [devForceHalfHour]);

  const handleTest10sAlarm = useCallback(async () => {
    const builder = getReminderMessageBuilder();
    const hour = new Date().getHours();

    // Build a realistic reminder message
    const { title, body } = await builder.buildReminderMessage(
      0, // todayMinutes
      30, // dailyTarget
      hour, // hour
      [t('notif_reason_pattern')], // contributors
      true // includeWeather
    );

    await SmartReminderModule.scheduleReminders([
      {
        timestamp: Date.now() + 10000,
        type: 'smart_reminder',
        goalThreshold: 0,
        title,
        body,
      },
    ]);
    Alert.alert('Developer Mode', 'Test alarm scheduled for 10 seconds from now.');
  }, []);

  const settingsPermissionIssues: string[] = [];
  if (detectionStatus.gps && !detectionStatus.gpsPermission) {
    settingsPermissionIssues.push(t('settings_gps'));
  }
  if (detectionStatus.healthConnect && !detectionStatus.healthConnectPermission) {
    settingsPermissionIssues.push(t('settings_health_connect'));
  }

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  const SECTIONS = useMemo(() => {
    const sections = [
      { id: 'detection' },
      { id: 'locations' },
      { id: 'appearance' },
      { id: 'language' },
      { id: 'about' },
      { id: 'activity_log' },
    ];
    // Show dev menu if in local development OR running a build from the development channel
    if (process.env.EXPO_PUBLIC_SHOW_DEV_MENU === 'true') {
      sections.push({ id: 'dev_menu' });
    }
    return sections;
  }, []);

  const HeaderComponent = () => (
    <>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>{t('nav_settings')}</Text>
      </View>
      {settingsPermissionIssues.length > 0 && (
        <View style={styles.permissionWarning}>
          <Text style={styles.permissionWarningText}>
            {t('permission_issues_banner', { features: settingsPermissionIssues.join(', ') })}
          </Text>
        </View>
      )}
    </>
  );

  const renderSection = useCallback(
    ({ item }: { item: (typeof SECTIONS)[0] }) => {
      switch (item.id) {
        case 'detection':
          return (
            <View>
              <Text style={styles.sectionHeader}>{t('settings_section_detection')}</Text>
              <Card style={styles.card}>
                <DetectionSettingRow
                  enabled={detectionStatus.healthConnect}
                  permissionGranted={detectionStatus.healthConnectPermission}
                  icon={<Ionicons name="fitness-outline" size={20} color={colors.textSecondary} />}
                  label={t('settings_health_connect')}
                  desc={t('settings_health_connect_desc')}
                  permissionMissingLabel={t('settings_hc_permission_missing')}
                  onToggle={handleToggleHC}
                  isLoading={togglingHC}
                  isInitializing={isInitializing}
                  onPermissionFix={showHCPermissionSheet}
                  testID="hc-toggle"
                />
                <Divider />
                <DetectionSettingRow
                  enabled={detectionStatus.gps}
                  permissionGranted={detectionStatus.gpsPermission}
                  icon={<Ionicons name="location-outline" size={20} color={colors.textSecondary} />}
                  label={t('settings_gps')}
                  desc={t('settings_gps_desc')}
                  permissionMissingLabel={t('settings_gps_permission_missing')}
                  onToggle={handleToggleGPS}
                  isLoading={togglingGPS}
                  isInitializing={isInitializing}
                  onPermissionFix={showGPSPermissionSheet}
                  testID="gps-toggle"
                />
                <Divider />
                <SettingRow
                  icon={<Ionicons name="radio-outline" size={20} color={colors.textSecondary} />}
                  label={t('settings_background_tracking_label')}
                  sublabel={t('settings_background_tracking_sublabel')}
                />
              </Card>
            </View>
          );
        case 'locations':
          return (
            <View>
              <Text style={styles.sectionHeader}>{t('settings_section_locations')}</Text>
              <Card style={styles.card}>
                <TouchableOpacity onPress={() => navigation.navigate('KnownLocations')}>
                  <SettingRow
                    icon={
                      <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
                    }
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
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                      </View>
                    }
                  />
                </TouchableOpacity>
              </Card>
            </View>
          );
        case 'appearance':
          return (
            <View>
              <Text style={styles.sectionHeader}>{t('settings_section_appearance')}</Text>
              <Card style={styles.card}>
                {(['system', 'light', 'dark'] as ThemePreference[]).map((pref, i) => (
                  <View key={pref}>
                    {i > 0 && <Divider />}
                    <TouchableOpacity onPress={() => setThemePreference(pref)}>
                      <SettingRow
                        icon={
                          <Ionicons
                            name={
                              pref === 'system'
                                ? 'phone-portrait-outline'
                                : pref === 'light'
                                  ? 'sunny-outline'
                                  : 'moon-outline'
                            }
                            size={20}
                            color={colors.textSecondary}
                          />
                        }
                        label={
                          pref === 'system'
                            ? t('settings_theme_system')
                            : pref === 'light'
                              ? t('settings_theme_light')
                              : t('settings_theme_dark')
                        }
                        right={
                          themePreference === pref && (
                            <Ionicons name="checkmark" size={20} color={colors.grass} />
                          )
                        }
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </Card>
            </View>
          );
        case 'language':
          return (
            <View>
              <Text style={styles.sectionHeader}>{t('settings_section_language')}</Text>
              <Card style={styles.card}>
                <TouchableOpacity onPress={presentLanguageSheet} testID="language-picker-toggle">
                  <SettingRow
                    icon={
                      <Ionicons name="language-outline" size={20} color={colors.textSecondary} />
                    }
                    label={
                      locale === 'en' || (locale === 'system' && systemLocale === 'en')
                        ? 'Language'
                        : `${t('settings_section_language')} / Language`
                    }
                    right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
                  />
                </TouchableOpacity>
              </Card>
            </View>
          );
        case 'about':
          return (
            <View>
              <Text style={styles.sectionHeader}>{t('settings_section_about')}</Text>
              <Card style={styles.card}>
                <TouchableOpacity onPress={() => navigation.navigate('AboutApp')}>
                  <SettingRow
                    icon={<Ionicons name="leaf-outline" size={20} color={colors.textSecondary} />}
                    label="TouchGrass"
                    sublabel={t('settings_app_sublabel')}
                    right={
                      <View style={styles.rowRightInline}>
                        {Constants.expoConfig?.version ? (
                          <TouchableOpacity
                            onPress={() => setShowDiagnosticSheet(true)}
                            testID="version-badge"
                          >
                            <Text
                              style={styles.versionBadge}
                            >{`v${Constants.expoConfig.version}`}</Text>
                          </TouchableOpacity>
                        ) : null}
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                      </View>
                    }
                  />
                </TouchableOpacity>
                <Divider />
                <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
                  <SettingRow
                    icon={
                      <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                    }
                    label={t('settings_privacy')}
                    sublabel={t('settings_privacy_sublabel')}
                    hint={t('settings_privacy_hint')}
                    right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
                  />
                </TouchableOpacity>
                <Divider />
                <SettingRow
                  icon={<Ionicons name="school-outline" size={20} color={colors.textSecondary} />}
                  label={t('settings_rerun_tutorial')}
                  sublabel={t('settings_rerun_tutorial_sublabel')}
                  right={
                    <TouchableOpacity style={styles.editBtn} onPress={handleShowIntro}>
                      <Text style={styles.editBtnText}>{t('settings_rerun_tutorial')}</Text>
                    </TouchableOpacity>
                  }
                />
                <Divider />
                <TouchableOpacity onPress={() => navigation.navigate('FeedbackSupport')}>
                  <SettingRow
                    icon={<Ionicons name="cafe-outline" size={20} color={colors.textSecondary} />}
                    label={t('settings_feedback_support')}
                    sublabel={t('settings_feedback_support_sublabel')}
                    right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
                  />
                </TouchableOpacity>
                <Divider />
                <SettingRow
                  icon={<Ionicons name="trash-outline" size={20} color={colors.textSecondary} />}
                  label={t('settings_clear_data')}
                  sublabel={t('settings_clear_data_sublabel')}
                  right={
                    <TouchableOpacity style={styles.dangerBtn} onPress={handleClearData}>
                      <Text style={styles.dangerBtnText}>{t('settings_clear_data')}</Text>
                    </TouchableOpacity>
                  }
                />
              </Card>
            </View>
          );
        case 'activity_log':
          return (
            <View>
              <Text style={styles.sectionHeader}>{t('settings_section_activity_log')}</Text>
              <Card style={styles.card}>
                <TouchableOpacity onPress={() => navigation.navigate('ActivityLog')}>
                  <SettingRow
                    icon={
                      <Ionicons
                        name="document-text-outline"
                        size={20}
                        color={colors.textSecondary}
                      />
                    }
                    label={t('settings_activity_log')}
                    sublabel={t('settings_activity_log_sublabel')}
                    right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
                  />
                </TouchableOpacity>
              </Card>
            </View>
          );
        case 'dev_menu':
          return (
            <View>
              <Text style={styles.sectionHeader}>Developer Menu</Text>
              <Card style={styles.card}>
                <TouchableOpacity onPress={handleTest10sAlarm}>
                  <SettingRow
                    icon={<Ionicons name="alarm-outline" size={20} color={colors.textSecondary} />}
                    label="Test 10s Alarm"
                    sublabel="Schedule a smart reminder 10s from now"
                  />
                </TouchableOpacity>
                <Divider />
                <TouchableOpacity onPress={handleClearDayPlan}>
                  <SettingRow
                    icon={<Ionicons name="bug-outline" size={20} color={colors.textSecondary} />}
                    label="Clear dayPlanLastDate"
                    sublabel="Force re-planning of today's reminders"
                  />
                </TouchableOpacity>
                <Divider />
                <SettingRow
                  icon={<Ionicons name="time-outline" size={20} color={colors.textSecondary} />}
                  label="Force half-hour reminders"
                  sublabel="Ignores user count and sends every 30 mins"
                  right={
                    <TouchableOpacity
                      style={[
                        styles.editBtn,
                        devForceHalfHour && { backgroundColor: colors.grass },
                      ]}
                      onPress={handleToggleDevForceHalfHour}
                    >
                      <Text
                        style={[
                          styles.editBtnText,
                          devForceHalfHour && { color: colors.textInverse },
                        ]}
                      >
                        {devForceHalfHour ? 'ENABLED' : 'DISABLED'}
                      </Text>
                    </TouchableOpacity>
                  }
                />
              </Card>
            </View>
          );
        default:
          return null;
      }
    },
    [
      colors,
      detectionStatus,
      devForceHalfHour,
      handleClearDayPlan,
      handleTest10sAlarm,
      handleToggleDevForceHalfHour,
      handleToggleGPS,
      handleToggleHC,
      isInitializing,
      knownLocations.length,
      locale,
      navigation,
      showGPSPermissionSheet,
      showHCPermissionSheet,
      suggestedCount,
      systemLocale,
      togglingGPS,
      togglingHC,
      styles,
      handleClearData,
      handleShowIntro,
      setThemePreference,
      themePreference,
    ]
  );

  return (
    <>
      <ResponsiveGridList
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        data={SECTIONS}
        keyExtractor={(item) => item.id}
        renderItem={renderSection}
        ListHeaderComponent={HeaderComponent}
      />

      {permissionSheet && (
        <PermissionExplainerSheet
          visible
          title={permissionSheet.title}
          body={permissionSheet.body}
          openSettingsLabel={permissionSheet.openLabel}
          onOpenSettings={permissionSheet.onOpen}
          onDisable={permissionSheet.onDisable}
          disableLabel={permissionSheet.disableLabel}
          onCancel={permissionSheet.onCancel}
          onClose={() => setPermissionSheet(null)}
        />
      )}
      <DiagnosticSheet
        visible={showDiagnosticSheet}
        onClose={() => setShowDiagnosticSheet(false)}
      />

      <BottomSheetModal
        ref={languageSheetRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        onChange={handleSheetChange}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.fog }}
      >
        <BottomSheetView
          style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
        >
          <Text style={styles.sheetTitle}>{t('settings_section_language')}</Text>
          {LANGUAGES.map((lang, index) => (
            <View key={lang.code}>
              {index > 0 && <Divider />}
              <TouchableOpacity onPress={() => changeLanguage(lang.code)}>
                <SettingRow
                  icon={
                    <Ionicons
                      name="language-outline"
                      size={20}
                      color={locale === lang.code ? colors.grass : colors.textSecondary}
                    />
                  }
                  label={getLanguageOptionLabel(lang.code, lang.label, lang.isTranslationKey)}
                  right={
                    locale === lang.code && (
                      <Ionicons name="checkmark" size={20} color={colors.grass} />
                    )
                  }
                />
              </TouchableOpacity>
            </View>
          ))}
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

function makeStyles(colors: ThemeColors, shadows: Shadows) {
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
      padding: 0,
      overflow: 'hidden',
    },

    rowRightInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

    versionBadge: {
      fontSize: 12,
      color: colors.grass,
      fontWeight: '600',
      backgroundColor: colors.grassPale,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
    },

    editBtn: {
      backgroundColor: colors.grassPale,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    editBtnText: { fontSize: 12, color: colors.grass, fontWeight: '600' },

    dangerBtn: {
      backgroundColor: colors.errorSurface,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    dangerBtnText: { fontSize: 12, color: colors.error, fontWeight: '600' },

    checkmark: { marginLeft: spacing.md },

    permissionWarning: {
      backgroundColor: colors.warningSurface,
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      borderRadius: radius.md,
      padding: spacing.sm,
    },
    permissionWarningText: { fontSize: 12, color: colors.warningText, lineHeight: 18 },

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

    sheetContent: {
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
  });
}
