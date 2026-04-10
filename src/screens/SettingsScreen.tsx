import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import {
  getKnownLocationsAsync,
  getSuggestedLocationsAsync,
  KnownLocation,
  clearAllDataAsync,
} from '../storage/database';
import {
  getDetectionStatus,
  toggleHealthConnect,
  toggleGPS,
  recheckHealthConnect,
  checkGPSPermissions,
  openHealthConnectSettings,
} from '../detection/index';
import PermissionExplainerSheet, {
  PermissionSheetConfig,
} from '../components/PermissionExplainerSheet';
import DiagnosticSheet from '../components/DiagnosticSheet';

import { spacing, radius } from '../utils/theme';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { t } from '../i18n';
import { PRIVACY_POLICY_URL } from '../utils/constants';
import type { SettingsStackParamList } from '../navigation/AppNavigator';
import { useShowIntro } from '../context/IntroContext';
import { emitPermissionIssuesChanged } from '../utils/permissionIssuesChangedEmitter';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
];

export default function SettingsScreen() {
  const showIntro = useShowIntro();
  const { colors, shadows, themePreference, setThemePreference } = useTheme();
  const { locale, setLocale } = useLanguage();
  const navigation = useNavigation<StackNavigationProp<SettingsStackParamList>>();
  const insets = useSafeAreaInsets();
  const [detectionStatus, setDetectionStatus] = useState({
    healthConnect: false,
    healthConnectPermission: false,
    gps: false,
    gpsPermission: false,
  });
  const [knownLocations, setKnownLocations] = useState<KnownLocation[]>([]);
  const [suggestedCount, setSuggestedCount] = useState(0);
  const [togglingHC, setTogglingHC] = useState(false);
  const [togglingGPS, setTogglingGPS] = useState(false);
  const [permissionSheet, setPermissionSheet] = useState<PermissionSheetConfig | null>(null);
  const [showDiagnosticSheet, setShowDiagnosticSheet] = useState(false);

  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const isFetchingRef = useRef(false);

  const loadStatus = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setDetectionStatus(await getDetectionStatus());
      setKnownLocations(await getKnownLocationsAsync());
      setSuggestedCount((await getSuggestedLocationsAsync()).length);
    } catch (error) {
      console.error('[SettingsScreen.loadStatus] Error:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Re-check permission status silently (no popups) when the screen regains focus
  // or the app returns to the foreground.  The UI shows an error indicator on
  // the toggle row when the user has enabled a source but permissions are gone.
  const checkAndUpdatePermissions = useCallback(async () => {
    await Promise.all([recheckHealthConnect(), checkGPSPermissions()]);

    setDetectionStatus(await getDetectionStatus());
  }, []);

  useFocusEffect(
    useCallback(() => {
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
    }, [loadStatus, checkAndUpdatePermissions])
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

  const showHCPermissionSheet = useCallback(() => {
    setPermissionSheet({
      title: t('settings_hc_permission_title'),
      body: t('settings_hc_permission_body'),
      openLabel: t('settings_hc_open_btn'),
      onOpen: async () => {
        const opened = await openHealthConnectSettings();
        if (!opened) {
          Alert.alert(t('settings_hc_open_error_title'), t('settings_hc_open_error_body'));
        }
      },
      onDisable: async () => {
        try {
          await toggleHealthConnect(false);
          setDetectionStatus(await getDetectionStatus());
          emitPermissionIssuesChanged();
        } catch (error) {
          console.error('[SettingsScreen.showHCPermissionSheet.onDisable] Error:', error);
        }
      },
    });
  }, []);

  const showGPSPermissionSheet = useCallback(() => {
    setPermissionSheet({
      title: t('settings_gps_permission_required_title'),
      body: t('settings_gps_permission_required_body'),
      onOpen: handleOpenAppSettings,
      onDisable: async () => {
        try {
          await toggleGPS(false);
          setDetectionStatus(await getDetectionStatus());
          emitPermissionIssuesChanged();
        } catch (error) {
          console.error('[SettingsScreen.showGPSPermissionSheet.onDisable] Error:', error);
        }
      },
    });
  }, []);

  const handleToggleHC = async (value: boolean) => {
    if (togglingHC) return;
    setTogglingHC(true);
    try {
      const result = await toggleHealthConnect(value);
      setDetectionStatus(await getDetectionStatus());
      emitPermissionIssuesChanged();

      if (value && result.needsPermissions) {
        showHCPermissionSheet();
      }
    } catch (error) {
      console.error('Error toggling Health Connect:', error);
      Alert.alert(t('settings_hc_open_error_title'), t('settings_hc_open_error_body'));
    } finally {
      setTogglingHC(false);
    }
  };

  const handleToggleGPS = async (value: boolean) => {
    if (togglingGPS) return;
    setTogglingGPS(true);
    try {
      const result = await toggleGPS(value);
      setDetectionStatus(await getDetectionStatus());
      emitPermissionIssuesChanged();

      if (value && result.needsPermissions) {
        showGPSPermissionSheet();
      }
    } catch (error) {
      console.error('Error toggling GPS:', error);
    } finally {
      setTogglingGPS(false);
    }
  };

  const changeLanguage = (code: string) => {
    // Delegates to context's setLocale which updates i18n, saves to storage, and triggers re-render
    setLocale(code);
  };

  const handleClearData = () => {
    Alert.alert(t('settings_clear_data_confirm_title'), t('settings_clear_data_confirm_body'), [
      { text: t('settings_clear_cancel'), style: 'cancel' },
      {
        text: t('settings_clear_delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await clearAllDataAsync();
            showIntro();
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
  };

  const settingsPermissionIssues: string[] = [];
  if (detectionStatus.gps && !detectionStatus.gpsPermission) {
    settingsPermissionIssues.push(t('settings_gps'));
  }
  if (detectionStatus.healthConnect && !detectionStatus.healthConnectPermission) {
    settingsPermissionIssues.push(t('settings_health_connect'));
  }

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>{t('nav_settings')}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {settingsPermissionIssues.length > 0 && (
          <View style={styles.permissionWarning}>
            <Text style={styles.permissionWarningText}>
              {t('permission_issues_banner', { features: settingsPermissionIssues.join(', ') })}
            </Text>
          </View>
        )}
        {/* Detection sources */}
        <Text style={styles.sectionHeader}>{t('settings_section_detection')}</Text>
        <View style={styles.card}>
          <DetectionSettingRow
            enabled={detectionStatus.healthConnect}
            permissionGranted={detectionStatus.healthConnectPermission}
            icon={<Ionicons name="fitness-outline" size={20} color={colors.textSecondary} />}
            label={t('settings_health_connect')}
            desc={t('settings_health_connect_desc')}
            permissionMissingLabel={t('settings_hc_permission_missing')}
            onToggle={handleToggleHC}
            isLoading={togglingHC}
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
            onPermissionFix={showGPSPermissionSheet}
            testID="gps-toggle"
          />
          <Divider />
          <SettingRow
            icon={<Ionicons name="radio-outline" size={20} color={colors.textSecondary} />}
            label={t('settings_background_tracking_label')}
            sublabel={t('settings_background_tracking_sublabel')}
          />
        </View>

        {/* Known locations */}
        <Text style={styles.sectionHeader}>{t('settings_section_locations')}</Text>
        <View style={styles.card}>
          <TouchableOpacity onPress={() => navigation.navigate('KnownLocations')}>
            <SettingRow
              icon={<Ionicons name="location-outline" size={20} color={colors.textSecondary} />}
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
        </View>

        <Text style={styles.sectionHeader}>{t('settings_section_appearance')}</Text>
        <View style={styles.card}>
          {(['system', 'light', 'dark'] as ThemePreference[]).map((pref, i) => (
            <View key={pref}>
              {i > 0 && <Divider />}
              <TouchableOpacity style={styles.row} onPress={() => setThemePreference(pref)}>
                <View style={styles.rowIconContainer}>
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
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>
                    {pref === 'system'
                      ? t('settings_theme_system')
                      : pref === 'light'
                        ? t('settings_theme_light')
                        : t('settings_theme_dark')}
                  </Text>
                </View>
                {themePreference === pref && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.grass}
                    style={styles.checkmark}
                  />
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeader}>{t('settings_section_language')}</Text>
        <View style={styles.card}>
          {LANGUAGES.map((lang, i) => (
            <View key={lang.code}>
              {i > 0 && <Divider />}
              <TouchableOpacity style={styles.row} onPress={() => changeLanguage(lang.code)}>
                <Text style={styles.rowLabel}>{lang.label}</Text>
                {locale === lang.code && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.grass}
                    style={styles.checkmark}
                  />
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeader}>{t('settings_section_about')}</Text>
        <View style={styles.card}>
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
                      <Text style={styles.versionBadge}>{`v${Constants.expoConfig.version}`}</Text>
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
              icon={<Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />}
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
              <TouchableOpacity style={styles.editBtn} onPress={showIntro}>
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
        </View>

        {/* Activity Log (Transparency) */}
        <Text style={styles.sectionHeader}>{t('settings_section_activity_log')}</Text>
        <View style={styles.card}>
          <TouchableOpacity onPress={() => navigation.navigate('ActivityLog')}>
            <SettingRow
              icon={
                <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
              }
              label={t('settings_activity_log')}
              sublabel={t('settings_activity_log_sublabel')}
              right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {permissionSheet && (
        <PermissionExplainerSheet
          visible
          title={permissionSheet.title}
          body={permissionSheet.body}
          openSettingsLabel={permissionSheet.openLabel}
          onOpenSettings={permissionSheet.onOpen}
          onDisable={permissionSheet.onDisable}
          disableLabel={permissionSheet.disableLabel}
          onClose={() => setPermissionSheet(null)}
        />
      )}
      <DiagnosticSheet
        visible={showDiagnosticSheet}
        onClose={() => setShowDiagnosticSheet(false)}
      />
    </>
  );
}

function SettingRow({
  icon,
  label,
  sublabel,
  hint,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  return (
    <View style={styles.row}>
      <View style={styles.rowIconContainer}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
        {hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      {right && <View style={styles.rowRight}>{right}</View>}
    </View>
  );
}

function Divider() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  return <View style={styles.divider} />;
}

function DetectionSettingRow({
  enabled,
  permissionGranted,
  icon,
  label,
  desc,
  permissionMissingLabel,
  onToggle,
  isLoading,
  onPermissionFix,
  testID,
}: {
  enabled: boolean;
  permissionGranted: boolean;
  icon: React.ReactNode;
  label: string;
  desc: string;
  permissionMissingLabel: string;
  onToggle: (value: boolean) => void;
  isLoading?: boolean;
  onPermissionFix?: () => void;
  testID?: string;
}) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const hasError = enabled && !permissionGranted;

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.rowIconContainer}>{icon}</View>
        <View style={styles.rowContent}>
          <Text style={styles.rowLabel}>{label}</Text>
          {hasError ? (
            <TouchableOpacity
              onPress={onPermissionFix}
              disabled={!onPermissionFix}
              accessibilityRole="button"
              accessibilityLabel={permissionMissingLabel}
              accessibilityHint={t('settings_permission_open')}
            >
              <Text style={[styles.rowSublabel, { color: colors.error }]}>
                {permissionMissingLabel}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.rowSublabel}>{desc}</Text>
          )}
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          disabled={isLoading}
          trackColor={{ false: colors.fog, true: colors.grassLight }}
          thumbColor={enabled ? colors.grass : colors.inactive}
          testID={testID}
        />
      </View>
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  shadows: ReturnType<typeof useTheme>['shadows']
) {
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
      overflow: 'hidden',
      ...shadows.soft,
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
    rowHint: { fontSize: 12, color: colors.grass, marginTop: 2 },
    rowRight: { marginLeft: spacing.sm },
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
      backgroundColor: colors.errorSurface,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    dangerBtnText: { fontSize: 12, color: colors.error, fontWeight: '600' },

    checkmark: { marginLeft: spacing.md },

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
      backgroundColor: colors.warningSurface,
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      borderRadius: radius.md,
      padding: spacing.sm,
    },
    permissionWarningText: { fontSize: 12, color: colors.warningText, lineHeight: 18 },

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
}
