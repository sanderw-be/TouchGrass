import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import { t } from '../i18n';
import { requestHealthConnect } from '../detection/index';

export default function HealthConnectRationaleScreen() {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleConnect = async () => {
    const granted = await requestHealthConnect();
    if (granted) {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={styles.header}>
          <Image
            source={require('../../assets/seedling.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t('hc_rationale_title')}</Text>
        </View>

        <Text style={styles.intro}>{t('hc_rationale_intro')}</Text>

        <View style={styles.section}>
          <View style={styles.iconCircle}>
            <Ionicons name="footsteps-outline" size={24} color={colors.grass} />
          </View>
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>{t('hc_rationale_steps_title')}</Text>
            <Text style={styles.sectionBody}>{t('hc_rationale_steps_body')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.iconCircle}>
            <Ionicons name="fitness-outline" size={24} color={colors.grass} />
          </View>
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>{t('hc_rationale_exercise_title')}</Text>
            <Text style={styles.sectionBody}>{t('hc_rationale_exercise_body')}</Text>
          </View>
        </View>

        <View style={styles.privacyCard}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.grass} />
          <Text style={styles.privacyText}>{t('hc_rationale_privacy')}</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleConnect}>
          <Text style={styles.buttonText}>{t('hc_rationale_button')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>{t('hc_rationale_cancel')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors, shadows: Shadows) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.mist,
    },
    content: {
      padding: spacing.lg,
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.xl,
      marginTop: spacing.md,
    },
    logo: {
      width: 60,
      height: 60,
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    intro: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 24,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    section: {
      flexDirection: 'row',
      marginBottom: spacing.lg,
      backgroundColor: colors.card,
      padding: spacing.md,
      borderRadius: radius.lg,
      ...shadows.soft,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.grassPale,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    sectionContent: {
      flex: 1,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    sectionBody: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    privacyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.grassPale,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.xl,
      gap: spacing.sm,
    },
    privacyText: {
      flex: 1,
      fontSize: 13,
      color: colors.grassDark,
      fontWeight: '500',
    },
    button: {
      backgroundColor: colors.grass,
      paddingVertical: spacing.md,
      borderRadius: radius.full,
      alignItems: 'center',
      marginBottom: spacing.sm,
      ...shadows.soft,
    },
    buttonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryButton: {
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '500',
    },
  });
}
