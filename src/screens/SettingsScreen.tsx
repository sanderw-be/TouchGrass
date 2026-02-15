import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Alert, Linking, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSetting, setSetting, getKnownLocations, KnownLocation, clearAllData } from '../storage/database';
import { getDetectionStatus, requestHealthConnect, recheckHealthConnect, checkGPSPermissions, requestGPSPermissions } from '../detection/index';
import { AppState, AppStateStatus } from 'react-native';
import { colors, spacing, radius, shadows } from '../utils/theme';
import { t } from '../i18n';
import i18n from '../i18n';
import EditLocationSheet from '../components/EditLocationSheet';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
];

export default function SettingsScreen() {
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState({ healthConnect: false, gps: false });
  const [knownLocations, setKnownLocations] = useState<KnownLocation[]>([]);
  const [language, setLanguage] = useState(i18n.locale);
  const [connectingHC, setConnectingHC] = useState(false);
  const [editingLocation, setEditingLocation] = useState<KnownLocation | null>(null);

  const loadStatus = useCallback(() => {
    setRemindersEnabled(getSetting('reminders_enabled', '1') === '1');
    setDetectionStatus(getDetectionStatus());
    setKnownLocations(getKnownLocations());
    setLanguage(i18n.locale);
  }, []);

  useFocusEffect(useCallback(() => {
    loadStatus();

    // Re-check Health Connect when screen comes into focus
    // (user may have granted permissions in Android Settings)
    recheckHealthConnect().then((granted) => {
      if (granted) setDetectionStatus((s) => ({ ...s, healthConnect: true }));
    });

    // Re-check GPS permissions
    checkGPSPermissions().then((granted) => {
      setDetectionStatus((s) => ({ ...s, gps: granted }));
    });

    // Also re-check when app comes back to foreground
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        recheckHealthConnect().then((granted) => {
          setDetectionStatus(getDetectionStatus());
        });
        checkGPSPermissions().then((granted) => {
          setDetectionStatus(getDetectionStatus());
        });
      }
    });
    return () => sub.remove();
  }, [loadStatus]));

  const handleConnectHealthConnect = async () => {
    setConnectingHC(true);
    const granted = await requestHealthConnect();
    setDetectionStatus(getDetectionStatus());
    setConnectingHC(false);
    if (!granted) {
      Alert.alert(
        t('settings_hc_failed_title'),
        t('settings_hc_failed_body'),
      );
    }
  };

  const openHealthConnectSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        // Try to open Health Connect app directly
        const healthConnectPackage = 'com.google.android.apps.healthdata';
        const url = `package:${healthConnectPackage}`;
        
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          // Fallback: Open app settings for TouchGrass
          Alert.alert(
            t('settings_hc_not_installed_title'),
            t('settings_hc_not_installed_body'),
          );
        }
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
        'Error',
        'Could not open settings. Please open Settings manually.',
      );
    }
  };

  const handleRequestGPSPermission = async () => {
    const granted = await requestGPSPermissions();
    setDetectionStatus(getDetectionStatus());
    if (!granted) {
      Alert.alert(
        'GPS Permission Required',
        'Background location permission is required for GPS detection. Please grant permissions in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: handleOpenAppSettings },
        ]
      );
    }
  };

  return (
    <>
      <EditLocationSheet
        visible={editingLocation !== null}
        location={editingLocation}
        onClose={() => setEditingLocation(null)}
        onSave={() => {
          loadStatus();
          setEditingLocation(null);
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Detection sources */}
        <Text style={styles.sectionHeader}>{t('settings_section_detection')}</Text>
        <View style={styles.card}>
          <SettingRow
            icon="👟"
            label={t('settings_health_connect')}
            sublabel={detectionStatus.healthConnect ? t('settings_health_connected') : t('settings_health_unavailable')}
            right={
              detectionStatus.healthConnect
                ? <StatusDot active={true} />
              : (
                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={handleConnectHealthConnect}
                  disabled={connectingHC}
                >
                  <Text style={styles.connectBtnText}>
                    {connectingHC ? '...' : t('settings_hc_connect')}
                  </Text>
                </TouchableOpacity>
              )
          }
        />
        {detectionStatus.healthConnect && (
          <>
            <Divider />
            <SettingRow
              icon="⚙️"
              label={t('settings_hc_manage')}
              sublabel={t('settings_hc_manage_sublabel')}
              right={
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={openHealthConnectSettings}
                >
                  <Text style={styles.editBtnText}>{t('settings_hc_open')}</Text>
                </TouchableOpacity>
              }
            />
          </>
        )}
        <Divider />
        <SettingRow
          icon="📍"
          label={t('settings_gps')}
          sublabel={detectionStatus.gps ? t('settings_gps_active') : t('settings_gps_permission')}
          right={
            detectionStatus.gps
              ? <StatusDot active={true} />
              : (
                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={handleRequestGPSPermission}
                >
                  <Text style={styles.connectBtnText}>Grant</Text>
                </TouchableOpacity>
              )
          }
        />
        {!detectionStatus.gps && (
          <>
            <Divider />
            <SettingRow
              icon="⚙️"
              label="Open Settings"
              sublabel="Grant location permissions in app settings"
              right={
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={handleOpenAppSettings}
                >
                  <Text style={styles.editBtnText}>Open</Text>
                </TouchableOpacity>
              }
            />
            <View style={styles.permissionWarning}>
              <Text style={styles.permissionWarningText}>{t('settings_gps_warning')}</Text>
            </View>
          </>
        )}
      </View>

      {/* Known locations */}
      <Text style={styles.sectionHeader}>{t('settings_section_locations')}</Text>
      <View style={styles.card}>
        {knownLocations.length === 0 && (
          <Text style={styles.emptyText}>{t('settings_locations_empty')}</Text>
        )}
        {knownLocations.map((loc, i) => (
          <View key={loc.id}>
            {i > 0 && <Divider />}
            <SettingRow
              icon={loc.label === 'Home' ? '🏠' : loc.label === 'Work' ? '🏢' : '📌'}
              label={loc.label}
              sublabel={t('settings_location_radius', {
                radius: loc.radiusMeters,
                type: loc.isIndoor ? t('settings_location_indoor') : t('settings_location_outdoor'),
              })}
              right={
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditingLocation(loc)}
                >
                  <Text style={styles.editBtnText}>{t('settings_location_edit')}</Text>
                </TouchableOpacity>
              }
            />
          </View>
        ))}
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
        <SettingRow
          icon="📡"
          label={t('settings_background_tracking_label')}
          sublabel={t('settings_background_tracking_sublabel')}
        />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.mist },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

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
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  rowSublabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowRight: { marginLeft: spacing.sm },

  divider: { height: 1, backgroundColor: colors.fog, marginLeft: spacing.md + 28 + spacing.md },

  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusDotActive: { backgroundColor: colors.grass },
  statusDotInactive: { backgroundColor: colors.inactive },

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
});
