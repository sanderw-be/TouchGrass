import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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

import { clearAllDataAsync } from '../storage/database';
import PermissionExplainerSheet from '../components/PermissionExplainerSheet';
import DiagnosticSheet from '../components/DiagnosticSheet';
import { SettingRow } from '../components/Settings/SettingRow';
import { Divider } from '../components/Settings/Divider';
import { DetectionSettingRow } from '../components/Settings/DetectionSettingRow';

import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { t, getDeviceSupportedLocale } from '../i18n';
import { PRIVACY_POLICY_URL } from '../utils/constants';
import type { SettingsStackParamList } from '../navigation/AppNavigator';
import { useAppStore, ThemePreference } from '../store/useAppStore';
import { useDetectionSettings } from '../hooks/useDetectionSettings';

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
  const languageSheetRef = useRef<BottomSheetModal>(null);
  const systemLocale = getDeviceSupportedLocale();

  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

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

  const getLanguageOptionLabel = (code: string, label: string, isTranslationKey: boolean) => {
    if (code === 'system') {
      return `${t(label)} (${LANGUAGE_LABELS[systemLocale] ?? LANGUAGE_LABELS.en})`;
    }
    return isTranslationKey ? t(label) : label;
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
  };

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
            colors={colors}
          />
          <Divider colors={colors} />
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
            colors={colors}
          />
          <Divider colors={colors} />
          <SettingRow
            icon={<Ionicons name="radio-outline" size={20} color={colors.textSecondary} />}
            label={t('settings_background_tracking_label')}
            sublabel={t('settings_background_tracking_sublabel')}
            colors={colors}
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
              colors={colors}
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
              {i > 0 && <Divider colors={colors} />}
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
          <TouchableOpacity
            style={styles.row}
            onPress={presentLanguageSheet}
            testID="language-picker-toggle"
          >
            <View style={styles.rowIconContainer}>
              <Ionicons name="language-outline" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>
                {locale === 'en' || (locale === 'system' && systemLocale === 'en')
                  ? 'Language'
                  : `${t('settings_section_language')} / Language`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>{t('settings_section_about')}</Text>
        <View style={styles.card}>
          <TouchableOpacity onPress={() => navigation.navigate('AboutApp')}>
            <SettingRow
              icon={<Ionicons name="leaf-outline" size={20} color={colors.textSecondary} />}
              label="TouchGrass"
              sublabel={t('settings_app_sublabel')}
              colors={colors}
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
          <Divider colors={colors} />
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            <SettingRow
              icon={<Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />}
              label={t('settings_privacy')}
              sublabel={t('settings_privacy_sublabel')}
              hint={t('settings_privacy_hint')}
              colors={colors}
              right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            />
          </TouchableOpacity>
          <Divider colors={colors} />
          <SettingRow
            icon={<Ionicons name="school-outline" size={20} color={colors.textSecondary} />}
            label={t('settings_rerun_tutorial')}
            sublabel={t('settings_rerun_tutorial_sublabel')}
            colors={colors}
            right={
              <TouchableOpacity style={styles.editBtn} onPress={handleShowIntro}>
                <Text style={styles.editBtnText}>{t('settings_rerun_tutorial')}</Text>
              </TouchableOpacity>
            }
          />
          <Divider colors={colors} />
          <TouchableOpacity onPress={() => navigation.navigate('FeedbackSupport')}>
            <SettingRow
              icon={<Ionicons name="cafe-outline" size={20} color={colors.textSecondary} />}
              label={t('settings_feedback_support')}
              sublabel={t('settings_feedback_support_sublabel')}
              colors={colors}
              right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
            />
          </TouchableOpacity>
          <Divider colors={colors} />
          <SettingRow
            icon={<Ionicons name="trash-outline" size={20} color={colors.textSecondary} />}
            label={t('settings_clear_data')}
            sublabel={t('settings_clear_data_sublabel')}
            colors={colors}
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
              colors={colors}
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
              {index > 0 && <Divider colors={colors} />}
              <TouchableOpacity style={styles.row} onPress={() => changeLanguage(lang.code)}>
                <View style={styles.rowIconContainer}>
                  <Ionicons
                    name="language-outline"
                    size={20}
                    color={locale === lang.code ? colors.grass : colors.textSecondary}
                  />
                </View>
                <View style={styles.rowContent}>
                  <Text
                    style={[
                      styles.rowLabel,
                      locale === lang.code && { color: colors.grass, fontWeight: '700' },
                    ]}
                  >
                    {getLanguageOptionLabel(lang.code, lang.label, lang.isTranslationKey)}
                  </Text>
                </View>
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
