import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import { t, TxKey } from '../i18n';
import { ResponsiveGridList } from '../components/ResponsiveGridList';

type Section = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: TxKey;
  bodyKey: TxKey;
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
  { icon: 'grid-outline', titleKey: 'about_widget_title', bodyKey: 'about_widget_body' },
  { icon: 'lock-closed-outline', titleKey: 'about_privacy_title', bodyKey: 'about_privacy_body' },
];

export default function AboutAppScreen() {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const locale = useAppStore((state) => state.locale);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const navigation = useNavigation();

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav_about_app') });
  }, [navigation, locale]);

  return (
    <ResponsiveGridList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={SECTIONS}
      keyExtractor={(item) => item.titleKey}
      renderItem={({ item: section }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name={section.icon} size={20} color={colors.grass} style={styles.cardIcon} />
            <Text style={styles.cardTitle}>{t(section.titleKey)}</Text>
          </View>
          <Text style={styles.cardBody}>{t(section.bodyKey)}</Text>
        </View>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors, shadows: Shadows) {
  return StyleSheet.create({
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
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    cardIcon: {
      marginRight: spacing.sm,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      flex: 1,
    },
    cardBody: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
}
