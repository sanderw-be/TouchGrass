import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import i18n, { t } from '../i18n';
import { PRIVACY_POLICY_URL } from '../utils/constants';

const FEEDBACK_URLS: Record<string, string> = {
  nl: 'https://forms.gle/SSavqQgWFqYmiJaZA',
  en: 'https://forms.gle/P6Www1U1yiurgk2D6',
};

const KOFI_URL = 'https://ko-fi.com/jollyheron';

function getFeedbackUrl(): string {
  const locale = i18n.locale ?? 'en';
  const lang = locale.startsWith('nl') ? 'nl' : 'en';
  return FEEDBACK_URLS[lang];
}

async function openUrl(url: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(url);
    }
  } catch {
    Alert.alert(url);
  }
}

export default function FeedbackSupportScreen() {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <TouchableOpacity onPress={() => openUrl(getFeedbackUrl())}>
          <SettingRow
            icon={<Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />}
            label={t('feedback_send_feedback')}
            sublabel={t('feedback_send_feedback_sublabel')}
            right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
          />
        </TouchableOpacity>
        <Divider />
        <TouchableOpacity onPress={() => openUrl(KOFI_URL)}>
          <SettingRow
            icon={<Ionicons name="cafe-outline" size={20} color={colors.textSecondary} />}
            label={t('feedback_support_kofi')}
            sublabel={t('feedback_support_kofi_sublabel')}
            right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => openUrl(PRIVACY_POLICY_URL)}>
        <Text style={styles.disclosure}>{t('feedback_google_disclosure')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingRow({
  icon,
  label,
  sublabel,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
}) {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  return (
    <View style={styles.row}>
      <View style={styles.rowIconContainer}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      {right && <View style={styles.rowRight}>{right}</View>}
    </View>
  );
}

function Divider() {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  return <View style={styles.divider} />;
}

function makeStyles(colors: ThemeColors, shadows: Shadows) {
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
      marginBottom: spacing.md,
      overflow: 'hidden' as const,
    },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      minHeight: 56,
    },
    rowIconContainer: {
      width: 28,
      marginRight: spacing.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    rowContent: {
      flex: 1,
    },
    rowLabel: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '500' as const,
    },
    rowSublabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    rowRight: {
      marginLeft: spacing.sm,
    },
    divider: {
      height: 1,
      backgroundColor: colors.fog,
      marginLeft: spacing.md + 28 + spacing.md,
    },
    disclosure: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center' as const,
      paddingHorizontal: spacing.md,
      textDecorationLine: 'underline' as const,
    },
  };
}
