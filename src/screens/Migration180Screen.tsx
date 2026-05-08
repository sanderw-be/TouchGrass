import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { t } from '../i18n';
import { radius, spacing, ThemeColors, Shadows } from '../utils/theme';
import { Card } from '../components/ui';
import { toggleAR } from '../detection/index';
import { PermissionService } from '../detection/PermissionService';
import { ActivityTransitionModule } from '../modules/ActivityTransitionModule';
import * as IntentLauncher from 'expo-intent-launcher';
import { setSettingAsync } from '../storage';

interface Props {
  onComplete: () => void;
}

export default function Migration180Screen({ onComplete }: Props) {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  const [activityRecognitionGranted, setActivityRecognitionGranted] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  const checkPermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      const arGranted = await PermissionService.checkActivityRecognitionPermissions();
      setActivityRecognitionGranted(arGranted);
    } else {
      setActivityRecognitionGranted(true);
    }
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkPermissions();
      }
    });
    return () => subscription.remove();
  }, [checkPermissions]);

  const handleRequestActivityRecognition = async () => {
    setRequestingPermission(true);
    try {
      const result = await toggleAR(true);
      if (result.needsPermissions) {
        const { granted } = await PermissionService.requestActivityRecognitionPermissions();
        setActivityRecognitionGranted(granted);
        if (granted) {
          await ActivityTransitionModule.startTracking();
        }
      } else {
        setActivityRecognitionGranted(true);
      }
    } catch (error) {
      console.error('Error requesting Activity Recognition:', error);
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleOpenBatterySettings = async () => {
    if (Platform.OS === 'android') {
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
        );
      } catch (e) {
        console.warn('Could not open battery optimization settings', e);
        Alert.alert(t('settings_error_title'), t('settings_error_open_settings_failed'));
      }
    }
  };

  const handleComplete = async () => {
    if (activityRecognitionGranted) {
      await setSettingAsync('ar_enabled', '1');
    }
    onComplete();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.stepContainer}>
          <Text style={styles.emoji}>🚀</Text>
          <Text style={styles.title}>{t('migration_180_title')}</Text>
          <Text style={styles.body}>{t('migration_180_body')}</Text>

          {/* Activity Recognition Card */}
          <Card style={styles.card}>
            <Text style={styles.cardEmoji}>🔋</Text>
            <Text style={styles.cardTitle}>{t('intro_ar_title')}</Text>
            <Text style={styles.cardBody}>{t('intro_ar_body')}</Text>

            <TouchableOpacity
              style={[
                styles.actionButton,
                activityRecognitionGranted && styles.actionButtonGranted,
              ]}
              onPress={handleRequestActivityRecognition}
              disabled={activityRecognitionGranted || requestingPermission}
            >
              {requestingPermission ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.actionButtonText}>
                  {activityRecognitionGranted ? t('intro_ar_button_granted') : t('intro_ar_button')}
                </Text>
              )}
            </TouchableOpacity>
          </Card>

          {/* Battery Optimization Card */}
          {Platform.OS === 'android' && (
            <Card style={styles.card}>
              <Text style={styles.cardEmoji}>⚙️</Text>
              <Text style={styles.cardTitle}>{t('migration_180_battery_title')}</Text>
              <Text style={styles.cardBody}>{t('migration_180_battery_body')}</Text>

              <TouchableOpacity style={styles.outlineButton} onPress={handleOpenBatterySettings}>
                <Text style={styles.outlineButtonText}>{t('migration_180_battery_button')}</Text>
              </TouchableOpacity>
            </Card>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleComplete}>
          <Text style={styles.nextBtnText}>{t('migration_180_continue_button')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors, shadows: Shadows) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.mist,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: spacing.xl,
      paddingBottom: spacing.xxl * 2,
    },
    stepContainer: {
      flex: 1,
      alignItems: 'center',
    },
    emoji: {
      fontSize: 64,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    body: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: spacing.xl,
    },
    card: {
      width: '100%',
      padding: spacing.lg,
      marginBottom: spacing.lg,
      alignItems: 'center',
    },
    cardEmoji: {
      fontSize: 32,
      marginBottom: spacing.sm,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    cardBody: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    actionButton: {
      backgroundColor: colors.grass,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.full,
      width: '100%',
      alignItems: 'center',
      ...shadows.soft,
    },
    actionButtonGranted: {
      backgroundColor: colors.textMuted,
    },
    actionButtonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
    },
    outlineButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.grass,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.full,
      width: '100%',
      alignItems: 'center',
    },
    outlineButtonText: {
      color: colors.grass,
      fontSize: 16,
      fontWeight: '700',
    },
    footer: {
      padding: spacing.xl,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.fog,
    },
    nextBtn: {
      backgroundColor: colors.textPrimary,
      paddingVertical: spacing.lg,
      borderRadius: radius.full,
      alignItems: 'center',
      ...shadows.medium,
    },
    nextBtnText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '800',
    },
  });
