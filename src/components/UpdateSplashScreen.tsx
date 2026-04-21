import React from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { t } from '../i18n';
import { spacing } from '../utils/theme';

export type UpdateSplashStatus = 'checking' | 'downloading';

interface Props {
  status: UpdateSplashStatus;
}

export default function UpdateSplashScreen({ status }: Props) {
  const colors = useAppStore((state) => state.colors);

  const statusText =
    status === 'downloading' ? t('update_splash_downloading') : t('update_splash_checking');

  return (
    <View
      style={[styles.container, { backgroundColor: colors.mist }]}
      testID="update-splash-screen"
    >
      <Image
        source={require('../../assets/seedling.png')}
        style={styles.logo}
        resizeMode="contain"
        testID="update-splash-logo"
      />
      <Text style={[styles.appName, { color: colors.textPrimary }]}>TouchGrass</Text>
      <ActivityIndicator
        size="small"
        color={colors.grass}
        style={styles.spinner}
        testID="update-splash-spinner"
      />
      <Text style={[styles.statusText, { color: colors.textMuted }]} testID="update-splash-status">
        {statusText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing.xl,
  },
  spinner: {
    marginBottom: spacing.xs,
  },
  statusText: {
    fontSize: 14,
  },
});
