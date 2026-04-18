import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { PermissionToggleRow, SettingRow, Divider, makeStyles } from './GoalsShared';

interface WeatherSectionProps {
  weatherEnabled: boolean;
  weatherLocationGranted: boolean;
  onToggleWeather: (value: boolean) => void;
  onShowWeatherPermissionSheet: () => void;
  onNavigateWeatherSettings: () => void;
}

export default function WeatherSection({
  weatherEnabled,
  weatherLocationGranted,
  onToggleWeather,
  onShowWeatherPermissionSheet,
  onNavigateWeatherSettings,
}: WeatherSectionProps) {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  return (
    <>
      <Text style={styles.sectionHeader}>{t('settings_weather_title')}</Text>
      <View style={styles.settingsCard}>
        <PermissionToggleRow
          icon={<Ionicons name="partly-sunny-outline" size={20} color={colors.textSecondary} />}
          label={t('settings_weather_enabled')}
          desc={t('settings_weather_enabled_desc')}
          permissionMissingLabel={t('settings_weather_permission_missing')}
          enabled={weatherEnabled}
          permissionGranted={weatherLocationGranted}
          onToggle={onToggleWeather}
          onPermissionFix={onShowWeatherPermissionSheet}
        />
        {weatherEnabled && weatherLocationGranted && (
          <>
            <Divider />
            <TouchableOpacity onPress={onNavigateWeatherSettings}>
              <SettingRow
                icon={<Ionicons name="settings-outline" size={20} color={colors.textSecondary} />}
                label={t('settings_weather_more')}
                sublabel={t('settings_weather_more_desc')}
                right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
              />
            </TouchableOpacity>
          </>
        )}
      </View>
    </>
  );
}
