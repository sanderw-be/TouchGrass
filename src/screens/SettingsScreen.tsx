import React, { useState, useCallback, useMemo } from 'react';
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
import {
  getKnownLocations,
  getSuggestedLocations,
  KnownLocation,
  clearAllData,
} from '../storage/database';
import {
  getDetectionStatus,
  toggleHealthConnect,
  toggleGPS,
  recheckHealthConnect,
  checkGPSPermissions,
  requestGPSPermissions,
  openHealthConnectSettings,
} from '../detection/index';

import { spacing, radius, shadows } from '../utils/theme';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { t } from '../i18n';
import { PRIVACY_POLICY_URL } from '../utils/constants';
import type { SettingsStackParamList } from '../navigation/AppNavigator';
import { useShowIntro } from '../context/IntroContext';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
];

export default function SettingsScreen() {
  const showIntro = useShowIntro();
  const { colors, themePreference, setThemePreference } = useTheme();
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

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const loadStatus = useCallback(() => {
    setDetectionStatus(getDetectionStatus());
    setKnownLocations(getKnownLocations());
    setSuggestedCount(getSuggestedLocations().length);
  }, []);

  // Re-check permission status silently (no popups) when the screen regains focus
  // or the app returns to the foreground.  The UI shows an error indicator on
  // the toggle row when the user has enabled a source but permissions are gone.
  const checkAndUpdatePermissions = useCallback(async () => {
    await Promise.all([recheckHealthConnect(), checkGPSPermissions()]);

    setDetectionStatus(getDetectionStatus());
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

  const handleToggleHC = async (value: boolean) => {
    if (togglingHC) return;
    setTogglingHC(true);
    try {
      const result = await toggleHealthConnect(value);
      setDetectionStatus(getDetectionStatus());

      if (value && result.needsPermissions) {
        // Permissions are not yet granted — open Health Connect so the user can allow them.
        const opened = await openHealthConnectSettings();
        if (!opened) {
          Alert.alert(t('settings_hc_open_error_title'), t('settings_hc_open_error_body'));
        }
        // When the user returns from HC, AppState 'active' fires and
        // checkAndUpdatePermissions silently refreshes the permission status.
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
      setDetectionStatus(getDetectionStatus());

      if (value && result.needsPermissions) {
        // OS permissions not granted — request them inline.
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
        onPress: () => {
          try {
            clearAllData();
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
            enabled={detectionStatus.healthConnect}
            permissionGranted={detectionStatus.healthConnectPermission}
            icon="👟"
            label={t('settings_health_connect')}
            desc={t('settings_health_connect_desc')}
            permissionMissingLabel={t('settings_hc_permission_missing')}
            onToggle={handleToggleHC}
            isLoading={togglingHC}
            onPermissionFix={openHealthConnectSettings}
            testID="hc-toggle"
          />
          <Divider />
          <DetectionSettingRow
            enabled={detectionStatus.gps}
            permissionGranted={detectionStatus.gpsPermission}
            icon="📍"
            label={t('settings_gps')}
            desc={t('settings_gps_desc')}
            permissionMissingLabel={t('settings_gps_permission_missing')}
            onToggle={handleToggleGPS}
            isLoading={togglingGPS}
            onPermissionFix={handleOpenAppSettings}
            testID="gps-toggle"
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

        <Text style={styles.sectionHeader}>{t('settings_section_appearance')}</Text>
        <View style={styles.card}>
          {(['system', 'light', 'dark'] as ThemePreference[]).map((pref, i) => (
            <View key={pref}>
              {i > 0 && <Divider />}
              <TouchableOpacity style={styles.row} onPress={() => setThemePreference(pref)}>
                <Text style={styles.rowIcon}>
                  {pref === 'system' ? '🌗' : pref === 'light' ? '☀️' : '🌙'}
                </Text>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>
                    {pref === 'system'
                      ? t('settings_theme_system')
                      : pref === 'light'
                        ? t('settings_theme_light')
                        : t('settings_theme_dark')}
                  </Text>
                </View>
                {themePreference === pref && <Text style={styles.checkmark}>✓</Text>}
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
                {locale === lang.code && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeader}>{t('settings_section_about')}</Text>
        <View style={styles.card}>
          <SettingRow icon="🌿" label="TouchGrass" sublabel={t('settings_app_sublabel')} />
          <Divider />
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            <SettingRow
              icon="🔒"
              label={t('settings_privacy')}
              sublabel={t('settings_privacy_sublabel')}
              hint={t('settings_privacy_hint')}
              right={<Text style={styles.chevron}>›</Text>}
            />
          </TouchableOpacity>
          <Divider />
          <SettingRow
            icon="🎓"
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
              icon="☕"
              label={t('settings_feedback_support')}
              sublabel={t('settings_feedback_support_sublabel')}
              right={<Text style={styles.chevron}>›</Text>}
            />
          </TouchableOpacity>
          <Divider />
          <SettingRow
            icon="🗑️"
            label={t('settings_clear_data')}
            sublabel={t('settings_clear_data_sublabel')}
            right={
              <TouchableOpacity style={styles.dangerBtn} onPress={handleClearData}>
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
  icon,
  label,
  sublabel,
  hint,
  right,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  icon: string;
  label: string;
  desc: string;
  permissionMissingLabel: string;
  onToggle: (value: boolean) => void;
  isLoading?: boolean;
  onPermissionFix?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const hasError = enabled && !permissionGranted;

  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.rowIcon}>{icon}</Text>
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
    rowHint: { fontSize: 12, color: colors.grass, marginTop: 2 },
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
      backgroundColor: colors.errorSurface,
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
