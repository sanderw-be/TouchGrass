import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSetting, setSetting } from '../storage/database';
import { colors, spacing, radius, shadows } from '../utils/theme';
import { t } from '../i18n';
import { fetchWeatherForecast, isWeatherDataAvailable, getWeatherForHour } from '../weather/weatherService';
import { getWeatherDescription, getWeatherEmoji } from '../weather/weatherAlgorithm';

export default function WeatherSettingsScreen() {
  const [tempPreference, setTempPreference] = useState<'cold' | 'moderate' | 'hot'>('moderate');
  const [avoidRain, setAvoidRain] = useState(true);
  const [avoidHeat, setAvoidHeat] = useState(true);
  const [considerUV, setConsiderUV] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [currentWeather, setCurrentWeather] = useState<string | null>(null);

  const loadSettings = useCallback(() => {
    setTempPreference(getSetting('temp_preference', 'moderate') as 'cold' | 'moderate' | 'hot');
    setAvoidRain(getSetting('weather_avoid_rain', '1') === '1');
    setAvoidHeat(getSetting('weather_avoid_heat', '1') === '1');
    setConsiderUV(getSetting('weather_consider_uv', '1') === '1');
    
    // Load current weather if available
    if (isWeatherDataAvailable()) {
      const hour = new Date().getHours();
      const weather = getWeatherForHour(hour);
      if (weather) {
        const description = getWeatherDescription(weather);
        const emoji = getWeatherEmoji(weather);
        setCurrentWeather(`${emoji} ${description}, ${Math.round(weather.temperature)}°C`);
      }
    } else {
      setCurrentWeather(null);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadSettings();
  }, [loadSettings]));

  const changeTempPreference = (pref: 'cold' | 'moderate' | 'hot') => {
    setSetting('temp_preference', pref);
    setTempPreference(pref);
  };

  const toggleAvoidRain = (value: boolean) => {
    setSetting('weather_avoid_rain', value ? '1' : '0');
    setAvoidRain(value);
  };

  const toggleAvoidHeat = (value: boolean) => {
    setSetting('weather_avoid_heat', value ? '1' : '0');
    setAvoidHeat(value);
  };

  const toggleConsiderUV = (value: boolean) => {
    setSetting('weather_consider_uv', value ? '1' : '0');
    setConsiderUV(value);
  };

  const handleRefreshWeather = async () => {
    setWeatherLoading(true);
    try {
      const result = await fetchWeatherForecast();
      if (result.success) {
        const hour = new Date().getHours();
        const weather = getWeatherForHour(hour);
        if (weather) {
          const description = getWeatherDescription(weather);
          const emoji = getWeatherEmoji(weather);
          setCurrentWeather(`${emoji} ${description}, ${Math.round(weather.temperature)}°C`);
        }
      } else {
        Alert.alert(t('settings_weather_error'), result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Weather refresh error:', error);
      Alert.alert(t('settings_weather_error'), String(error));
    } finally {
      setWeatherLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <SettingRow
          icon="🌡️"
          label={t('settings_temp_preference')}
          right={
            <View style={styles.tempOptions}>
              {(['cold', 'moderate', 'hot'] as const).map((pref) => (
                <TouchableOpacity
                  key={pref}
                  style={[
                    styles.tempOption,
                    tempPreference === pref && styles.tempOptionActive,
                  ]}
                  onPress={() => changeTempPreference(pref)}
                >
                  <Text
                    style={[
                      styles.tempOptionText,
                      tempPreference === pref && styles.tempOptionTextActive,
                    ]}
                  >
                    {t(`settings_temp_${pref}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />
        <Divider />
        <SettingRow
          icon="☔"
          label={t('settings_weather_avoid_rain')}
          right={
            <Switch
              value={avoidRain}
              onValueChange={toggleAvoidRain}
              trackColor={{ false: colors.fog, true: colors.grassLight }}
              thumbColor={avoidRain ? colors.grass : colors.inactive}
            />
          }
        />
        <Divider />
        <SettingRow
          icon="🌡️"
          label={t('settings_weather_avoid_heat')}
          right={
            <Switch
              value={avoidHeat}
              onValueChange={toggleAvoidHeat}
              trackColor={{ false: colors.fog, true: colors.grassLight }}
              thumbColor={avoidHeat ? colors.grass : colors.inactive}
            />
          }
        />
        <Divider />
        <SettingRow
          icon="☀️"
          label={t('settings_weather_consider_uv')}
          right={
            <Switch
              value={considerUV}
              onValueChange={toggleConsiderUV}
              trackColor={{ false: colors.fog, true: colors.grassLight }}
              thumbColor={considerUV ? colors.grass : colors.inactive}
            />
          }
        />
        <Divider />
        <SettingRow
          icon="📍"
          label={t('settings_weather_current')}
          sublabel={currentWeather || t('settings_weather_unavailable')}
          right={
            weatherLoading ? (
              <ActivityIndicator size="small" color={colors.grass} />
            ) : (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={handleRefreshWeather}
              >
                <Text style={styles.editBtnText}>{t('settings_weather_refresh')}</Text>
              </TouchableOpacity>
            )
          }
        />
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
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.mist },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  card: {
    backgroundColor: colors.textInverse,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.soft,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  rowIcon: { fontSize: 20, marginRight: spacing.md, width: 28, textAlign: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  rowSublabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowRight: { marginLeft: spacing.sm },

  divider: { height: 1, backgroundColor: colors.fog, marginLeft: spacing.md + 28 + spacing.md },

  editBtn: {
    backgroundColor: colors.grassPale,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  editBtnText: { fontSize: 12, color: colors.grass, fontWeight: '600' },

  tempOptions: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  tempOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.fog,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 70,
  },
  tempOptionActive: {
    backgroundColor: colors.grassLight,
    borderColor: colors.grass,
  },
  tempOptionText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  tempOptionTextActive: {
    color: colors.grass,
    fontWeight: '600',
  },
});
