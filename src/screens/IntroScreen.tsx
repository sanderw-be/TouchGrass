import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Platform, ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius, shadows } from '../utils/theme';
import { t } from '../i18n';
import { requestHealthConnect } from '../detection/index';
import { requestGPSPermissions } from '../detection/index';
import { requestNotificationPermissions } from '../notifications/notificationManager';

interface Props {
  onComplete: () => void;
}

type Step = 'welcome' | 'health-connect' | 'location' | 'notifications' | 'ready';

export default function IntroScreen({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [healthConnectGranted, setHealthConnectGranted] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  const steps: Step[] = ['welcome', 'health-connect', 'location', 'notifications', 'ready'];
  const currentIndex = steps.indexOf(currentStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;

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
      const granted = await requestHealthConnect();
      setHealthConnectGranted(granted);
    } catch (error) {
      console.error('Error requesting Health Connect:', error);
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleRequestLocation = async () => {
    setRequestingPermission(true);
    try {
      const granted = await requestGPSPermissions();
      setLocationGranted(granted);
    } catch (error) {
      console.error('Error requesting location:', error);
    } finally {
      setRequestingPermission(false);
    }
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

  return (
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
          />
        )}
        {currentStep === 'notifications' && (
          <NotificationsStep
            onRequest={handleRequestNotifications}
            granted={notificationsGranted}
            requesting={requestingPermission}
          />
        )}
        {currentStep === 'ready' && <ReadyStep />}
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
  );
}

function WelcomeStep() {
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

function LocationStep({ onRequest, granted, requesting }: { onRequest: () => void; granted: boolean; requesting: boolean }) {
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
    </View>
  );
}

function NotificationsStep({ onRequest, granted, requesting }: { onRequest: () => void; granted: boolean; requesting: boolean }) {
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

function ReadyStep() {
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
          <Text style={styles.checklistBullet}>•</Text>
          <Text style={styles.checklistText}>{t('intro_ready_checklist_item_hc')}</Text>
        </View>
        <View style={styles.checklistItem}>
          <Text style={styles.checklistBullet}>•</Text>
          <Text style={styles.checklistText}>{t('intro_ready_checklist_item_gps')}</Text>
        </View>
        <View style={styles.checklistItem}>
          <Text style={styles.checklistBullet}>•</Text>
          <Text style={styles.checklistText}>{t('intro_ready_checklist_item_notifications')}</Text>
        </View>
      </View>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.textInverse,
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
    backgroundColor: '#FEF3C7',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: spacing.xs,
  },
  tipBody: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  checklistCard: {
    width: '100%',
    backgroundColor: colors.textInverse,
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

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.textInverse,
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
