import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { spacing, radius } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';

type Section = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
};

const SECTIONS: Section[] = [
  { icon: 'leaf-outline', titleKey: 'about_intro_title', bodyKey: 'about_intro_body' },
  {
    icon: 'locate-outline',
    titleKey: 'about_detection_title',
    bodyKey: 'about_detection_body',
  },
  { icon: 'trophy-outline', titleKey: 'about_goals_title', bodyKey: 'about_goals_body' },
  {
    icon: 'notifications-outline',
    titleKey: 'about_reminders_title',
    bodyKey: 'about_reminders_body',
  },
  { icon: 'pencil-outline', titleKey: 'about_manual_title', bodyKey: 'about_manual_body' },
  { icon: 'lock-closed-outline', titleKey: 'about_privacy_title', bodyKey: 'about_privacy_body' },
];

export default function AboutAppScreen() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {SECTIONS.map((section, index) => (
        <View key={section.titleKey} style={[styles.card, index > 0 && styles.cardSpacing]}>
          <View style={styles.cardHeader}>
            <Ionicons name={section.icon} size={20} color={colors.grass} style={styles.cardIcon} />
            <Text style={styles.cardTitle}>{t(section.titleKey)}</Text>
          </View>
          <Text style={styles.cardBody}>{t(section.bodyKey)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  shadows: ReturnType<typeof useTheme>['shadows']
) {
  return {
    container: {
      flex: 1,
      backgroundColor: colors.mist,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      ...shadows.soft,
      padding: spacing.md,
      overflow: 'hidden' as const,
    },
    cardSpacing: {
      marginTop: spacing.md,
    },
    cardHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      marginBottom: spacing.sm,
    },
    cardIcon: {
      marginRight: spacing.sm,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.textPrimary,
      flex: 1,
    },
    cardBody: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  };
}
