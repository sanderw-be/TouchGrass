import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSettingAsync, setSettingAsync } from '../storage';
import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import { t, TxKey } from '../i18n';
import {
  fetchWeatherForecast,
  isWeatherDataAvailable,
  getWeatherForHour,
} from '../weather/weatherService';
import { getWeatherDescription, getWeatherEmoji } from '../weather/weatherAlgorithm';
import { formatTemperature } from '../utils/temperature';
import { ResponsiveGridList } from '../components/ResponsiveGridList';
import { Card } from '../components/ui';

const TEMP_PREF_LABELS: Record<'cold' | 'moderate' | 'hot', TxKey> = {
  cold: 'settings_temp_cold',
  moderate: 'settings_temp_moderate',
  hot: 'settings_temp_hot',
};

export default function WeatherSettingsScreen() {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const locale = useAppStore((state) => state.locale);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Update navigation header title reactively
  React.useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav_weather_settings') });
  }, [navigation, locale]);

  const [tempPreference, setTempPreference] = useState<'cold' | 'moderate' | 'hot'>('moderate');
  const [avoidRain, setAvoidRain] = useState(true);
  const [avoidHeat, setAvoidHeat] = useState(true);
  const [considerUV, setConsiderUV] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherSuccess, setWeatherSuccess] = useState(false);
  const [currentWeather, setCurrentWeather] = useState<string | null>(null);
  const isMountedRef = React.useRef(true);
  const successTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (successTimerRef.current !== null) clearTimeout(successTimerRef.current);
    };
  }, []);

  const loadSettings = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const [tempPref, rainPref, heatPref, uvPref] = await Promise.all([
        getSettingAsync('temp_preference', 'moderate'),
        getSettingAsync('weather_avoid_rain', '1'),
        getSettingAsync('weather_avoid_heat', '1'),
        getSettingAsync('weather_consider_uv', '1'),
      ]);
      setTempPreference(tempPref as 'cold' | 'moderate' | 'hot');
      setAvoidRain(rainPref === '1');
      setAvoidHeat(heatPref === '1');
      setConsiderUV(uvPref === '1');

      // Auto-refresh weather data if unavailable or stale
      if (!(await isWeatherDataAvailable())) {
        // Fetch weather in background without showing loading state
        fetchWeatherForecast()
          .then(async (result) => {
            if (!isMountedRef.current) return;
            if (result.success) {
              const hour = new Date().getHours();
              const weather = await getWeatherForHour(hour);
              if (weather) {
                const description = getWeatherDescription(weather);
                const emoji = getWeatherEmoji(weather);
                setCurrentWeather(
                  `${emoji} ${description}, ${formatTemperature(weather.temperature)}`
                );
              }
            }
          })
          .catch((error) => {
            console.error('Auto-refresh weather error:', error);
          });
      } else {
        // Load current weather if available
        const hour = new Date().getHours();
        const weather = await getWeatherForHour(hour);
        if (weather) {
          const description = getWeatherDescription(weather);
          const emoji = getWeatherEmoji(weather);
          setCurrentWeather(`${emoji} ${description}, ${formatTemperature(weather.temperature)}`);
        } else {
          setCurrentWeather(null);
        }
      }
    } catch (error) {
      console.error('[WeatherSettingsScreen.loadSettings] Error:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const changeTempPreference = async (pref: 'cold' | 'moderate' | 'hot') => {
    try {
      await setSettingAsync('temp_preference', pref);
      setTempPreference(pref);
    } catch (error) {
      console.error('[WeatherSettingsScreen.changeTempPreference] Error:', error);
    }
  };

  const toggleAvoidRain = async (value: boolean) => {
    try {
      await setSettingAsync('weather_avoid_rain', value ? '1' : '0');
      setAvoidRain(value);
    } catch (error) {
      console.error('[WeatherSettingsScreen.toggleAvoidRain] Error:', error);
    }
  };

  const toggleAvoidHeat = async (value: boolean) => {
    try {
      await setSettingAsync('weather_avoid_heat', value ? '1' : '0');
      setAvoidHeat(value);
    } catch (error) {
      console.error('[WeatherSettingsScreen.toggleAvoidHeat] Error:', error);
    }
  };

  const toggleConsiderUV = async (value: boolean) => {
    try {
      await setSettingAsync('weather_consider_uv', value ? '1' : '0');
      setConsiderUV(value);
    } catch (error) {
      console.error('[WeatherSettingsScreen.toggleConsiderUV] Error:', error);
    }
  };

  const handleRefreshWeather = async () => {
    setWeatherLoading(true);
    try {
      const result = await fetchWeatherForecast();
      if (result.success) {
        const hour = new Date().getHours();
        const weather = await getWeatherForHour(hour);
        if (weather) {
          const description = getWeatherDescription(weather);
          const emoji = getWeatherEmoji(weather);
          setCurrentWeather(`${emoji} ${description}, ${formatTemperature(weather.temperature)}`);
        }
        setWeatherSuccess(true);
        successTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) setWeatherSuccess(false);
        }, 2000);
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

  const SECTIONS = [
    { id: 'temp_preference' },
    { id: 'weather_conditions' },
    { id: 'current_weather' },
  ];

  const renderSection = ({ item }: { item: (typeof SECTIONS)[0] }) => {
    switch (item.id) {
      case 'temp_preference':
        return (
          <Card style={styles.card}>
            <View style={styles.tempRow}>
              <View style={styles.tempRowIconContainer}>
                <Ionicons name="thermometer-outline" size={20} color={colors.textSecondary} />
              </View>
              <Text style={styles.tempRowLabel}>{t('settings_temp_preference')}</Text>
            </View>
            <View style={styles.tempOptionsContainer}>
              {(['cold', 'moderate', 'hot'] as const).map((pref) => (
                <TouchableOpacity
                  key={pref}
                  style={[styles.tempOption, tempPreference === pref && styles.tempOptionActive]}
                  onPress={() => changeTempPreference(pref)}
                >
                  <Text
                    style={[
                      styles.tempOptionText,
                      tempPreference === pref && styles.tempOptionTextActive,
                    ]}
                  >
                    {t(TEMP_PREF_LABELS[pref])}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        );
      case 'weather_conditions':
        return (
          <Card style={styles.card}>
            <SettingRow
              icon={<Ionicons name="rainy-outline" size={20} color={colors.textSecondary} />}
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
              icon={<Ionicons name="thermometer-outline" size={20} color={colors.textSecondary} />}
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
              icon={<Ionicons name="sunny-outline" size={20} color={colors.textSecondary} />}
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
          </Card>
        );
      case 'current_weather':
        return (
          <Card style={styles.card}>
            <SettingRow
              icon={<Ionicons name="location-outline" size={20} color={colors.textSecondary} />}
              label={t('settings_weather_current')}
              sublabel={currentWeather || t('settings_weather_unavailable')}
              right={
                weatherLoading ? (
                  <ActivityIndicator size="small" color={colors.grass} />
                ) : weatherSuccess ? (
                  <View style={styles.successIndicator} testID="weather-refresh-success">
                    <Ionicons name="checkmark" size={16} color={colors.grass} />
                  </View>
                ) : (
                  <TouchableOpacity style={styles.editBtn} onPress={handleRefreshWeather}>
                    <Text style={styles.editBtnText}>{t('settings_weather_refresh')}</Text>
                  </TouchableOpacity>
                )
              }
            />
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <ResponsiveGridList
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      data={SECTIONS}
      keyExtractor={(item) => item.id}
      renderItem={renderSection}
    />
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
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.mist },
    content: { padding: spacing.md, paddingBottom: spacing.xxl },

    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      overflow: 'hidden',
      ...shadows.soft,
      padding: 0,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
    },
    rowIconContainer: {
      width: 28,
      marginRight: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
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

    successIndicator: {
      backgroundColor: colors.grassPale,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },

    tempRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xs,
    },
    tempRowIconContainer: {
      width: 28,
      marginRight: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tempRowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },

    tempOptionsContainer: {
      flexDirection: 'row',
      gap: spacing.xs,
      flexWrap: 'wrap',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
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
      backgroundColor: colors.grass,
      borderColor: colors.grassDark,
    },
    tempOptionText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
      textAlign: 'center',
    },
    tempOptionTextActive: {
      color: colors.textInverse,
      fontWeight: '700',
    },
  });
}
