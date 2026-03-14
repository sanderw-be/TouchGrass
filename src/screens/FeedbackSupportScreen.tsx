import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { spacing, radius, shadows } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { t } from '../i18n';
import i18n from '../i18n';

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <TouchableOpacity onPress={() => openUrl(getFeedbackUrl())}>
          <SettingRow
            icon="📋"
            label={t('feedback_send_feedback')}
            sublabel={t('feedback_send_feedback_sublabel')}
            right={<Text style={styles.chevron}>›</Text>}
          />
        </TouchableOpacity>
        <Divider />
        <TouchableOpacity onPress={() => openUrl(KOFI_URL)}>
          <SettingRow
            icon="☕"
            label={t('feedback_support_kofi')}
            sublabel={t('feedback_support_kofi_sublabel')}
            right={<Text style={styles.chevron}>›</Text>}
          />
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.divider} />;
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
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
    rowIcon: {
      fontSize: 20,
      marginRight: spacing.md,
      width: 28,
      textAlign: 'center' as const,
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
    chevron: {
      fontSize: 20,
      color: colors.textMuted,
    },
  };
}
