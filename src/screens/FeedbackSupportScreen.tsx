import React, { useMemo } from 'react';
import { Text, TouchableOpacity, Linking, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import i18n, { t } from '../i18n';
import { PRIVACY_POLICY_URL } from '../utils/constants';
import { ResponsiveGridList } from '../components/ResponsiveGridList';
import { Card, Divider, SettingRow } from '../components/ui';

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
  const locale = useAppStore((state) => state.locale);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const navigation = useNavigation();

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav_feedback_support') });
  }, [navigation, locale]);

  const SECTIONS = [{ id: 'feedback_support' }, { id: 'disclosure' }];

  const renderSection = ({ item }: { item: (typeof SECTIONS)[0] }) => {
    switch (item.id) {
      case 'feedback_support':
        return (
          <Card style={styles.card}>
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
          </Card>
        );
      case 'disclosure':
        return (
          <TouchableOpacity onPress={() => openUrl(PRIVACY_POLICY_URL)}>
            <Text style={styles.disclosure}>{t('feedback_google_disclosure')}</Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  return (
    <ResponsiveGridList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={SECTIONS}
      keyExtractor={(item) => item.id}
      renderItem={renderSection}
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
      overflow: 'hidden',
      padding: 0,
    },
    disclosure: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: spacing.md,
      textDecorationLine: 'underline',
      marginTop: spacing.md,
    },
  });
}
