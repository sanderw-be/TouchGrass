import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Platform,
} from 'react-native';
import { colors, spacing, radius, shadows } from '../utils/theme';
import { t } from '../i18n';

interface Props {
  onComplete: () => void;
}

type Step = 'welcome' | 'health-connect' | 'location' | 'notifications' | 'ready';

export default function IntroScreen({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {currentStep === 'welcome' && <WelcomeStep />}
        {currentStep === 'health-connect' && <HealthConnectStep />}
        {currentStep === 'location' && <LocationStep />}
        {currentStep === 'notifications' && <NotificationsStep />}
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

function HealthConnectStep() {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>👟</Text>
      <Text style={styles.title}>{t('intro_hc_title')}</Text>
      <Text style={styles.body}>{t('intro_hc_body')}</Text>
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>{t('intro_hc_why_title')}</Text>
        <Text style={styles.permissionBody}>{t('intro_hc_why_body')}</Text>
      </View>
      <Text style={styles.hint}>{t('intro_hc_hint')}</Text>
    </View>
  );
}

function LocationStep() {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>📍</Text>
      <Text style={styles.title}>{t('intro_location_title')}</Text>
      <Text style={styles.body}>{t('intro_location_body')}</Text>
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>{t('intro_location_why_title')}</Text>
        <Text style={styles.permissionBody}>{t('intro_location_why_body')}</Text>
      </View>
      <Text style={styles.hint}>{t('intro_location_hint')}</Text>
    </View>
  );
}

function NotificationsStep() {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>🔔</Text>
      <Text style={styles.title}>{t('intro_notifications_title')}</Text>
      <Text style={styles.body}>{t('intro_notifications_body')}</Text>
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>{t('intro_notifications_why_title')}</Text>
        <Text style={styles.permissionBody}>{t('intro_notifications_why_body')}</Text>
      </View>
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
