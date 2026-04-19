/**
 * Weather-based scoring for reminder algorithm
 * Analyzes weather conditions to determine optimal outdoor times
 */

import { WeatherCondition, WEATHER_CODES, WeatherPreferences } from './types';
import { getSettingAsync } from '../storage';
import { t } from '../i18n';

/**
 * Score a weather condition for outdoor activity suitability
 * Returns a score between -0.5 and +0.5
 */
export function scoreWeatherCondition(
  condition: WeatherCondition,
  preferences: WeatherPreferences
): number {
  const prefs = preferences;

  if (!prefs.enabled) {
    return 0; // Weather scoring disabled
  }

  let score = 0;
  const reasons: string[] = [];

  // ── Precipitation avoidance ──────────────────────────────
  if (prefs.avoidRain) {
    if (condition.precipitationProbability <= 10) {
      score += 0.25;
      reasons.push('dry');
    } else if (condition.precipitationProbability <= 30) {
      score += 0.1;
      reasons.push('mostly dry');
    } else if (condition.precipitationProbability <= 50) {
      score -= 0.1;
      reasons.push('might rain');
    } else {
      score -= 0.3;
      reasons.push('likely rain');
    }
  }

  // ── Active bad weather penalty ───────────────────────────
  const code = condition.weatherCode;
  if (
    code >= WEATHER_CODES.RAIN_MODERATE ||
    code === WEATHER_CODES.THUNDERSTORM ||
    code >= WEATHER_CODES.SNOW_MODERATE
  ) {
    score -= 0.5; // Heavy penalty for active bad weather
    reasons.push('bad weather');
  } else if (
    code === WEATHER_CODES.RAIN_LIGHT ||
    code === WEATHER_CODES.DRIZZLE_MODERATE ||
    code === WEATHER_CODES.SNOW_LIGHT
  ) {
    score -= 0.2; // Moderate penalty for light rain/snow
    reasons.push('light precip');
  }

  // ── Temperature comfort zones ────────────────────────────
  const temp = condition.temperature;

  if (prefs.temperaturePreference === 'cold') {
    // Prefer cooler temperatures (0-20°C optimal)
    if (temp >= 0 && temp <= 10) {
      score += 0.15;
      reasons.push('cool');
    } else if (temp > 10 && temp <= 20) {
      score += 0.1;
      reasons.push('mild');
    } else if (temp > 20 && temp <= 25) {
      // Neutral zone - no penalty or bonus
      reasons.push('mild temp');
    } else if (temp > 25) {
      score -= 0.15;
      reasons.push('too warm');
    }
  } else if (prefs.temperaturePreference === 'hot') {
    // Prefer warmer temperatures (15-30°C optimal)
    if (temp >= 20 && temp <= 30) {
      score += 0.15;
      reasons.push('warm');
    } else if (temp > 10 && temp < 20) {
      score += 0.1;
      reasons.push('mild');
    } else if (temp > 5 && temp <= 10) {
      // Neutral-cool zone - slight preference still
      score += 0.05;
      reasons.push('cool');
    } else if (temp <= 5) {
      score -= 0.15;
      reasons.push('too cold');
    }
  } else {
    // Moderate preference (10-25°C optimal)
    if (temp >= 15 && temp <= 25) {
      score += 0.15;
      reasons.push('pleasant');
    } else if (temp >= 10 && temp < 15) {
      score += 0.08;
      reasons.push('cool');
    } else if (temp > 25 && temp <= 30) {
      score += 0.05;
      reasons.push('warm');
    } else if (temp < 5 || temp > 35) {
      score -= 0.2;
      reasons.push('extreme temp');
    }
  }

  // ── Heat mitigation with cloud cover ─────────────────────
  if (prefs.avoidHeat && temp > 28 && condition.cloudCover > 50) {
    score += 0.12; // Cloudy days are better when it's hot
    reasons.push('clouds cool heat');
  } else if (prefs.avoidHeat && temp > 32 && condition.cloudCover < 20) {
    score -= 0.15; // Very hot and sunny is uncomfortable
    reasons.push('hot & sunny');
  }

  // ── UV protection ────────────────────────────────────────
  if (prefs.considerUV && condition.uvIndex > 8) {
    score -= 0.12; // High UV, prefer other times
    reasons.push('high UV');
  } else if (prefs.considerUV && condition.uvIndex >= 6 && condition.uvIndex <= 8) {
    score -= 0.05; // Moderate UV warning
    reasons.push('moderate UV');
  }

  // ── Wind conditions ──────────────────────────────────────
  if (condition.windSpeed > 40) {
    score -= 0.15; // Very windy
    reasons.push('very windy');
  } else if (condition.windSpeed > 25) {
    score -= 0.08; // Moderately windy
    reasons.push('windy');
  }

  // ── Pleasant conditions bonus ────────────────────────────
  if (
    condition.precipitationProbability <= 10 &&
    temp >= 18 &&
    temp <= 26 &&
    condition.uvIndex < 7 &&
    condition.windSpeed < 20 &&
    (code === WEATHER_CODES.CLEAR_SKY || code === WEATHER_CODES.MAINLY_CLEAR)
  ) {
    score += 0.1; // Perfect weather bonus
    reasons.push('perfect weather');
  }

  return Math.max(-0.5, Math.min(0.5, score));
}

/**
 * Get weather preferences from app settings
 */
export async function getWeatherPreferences(): Promise<WeatherPreferences> {
  const [enabled, tempPref, avoidRain, avoidHeat, considerUV] = await Promise.all([
    getSettingAsync('weather_enabled', '1'),
    getSettingAsync('temp_preference', 'moderate'),
    getSettingAsync('weather_avoid_rain', '1'),
    getSettingAsync('weather_avoid_heat', '1'),
    getSettingAsync('weather_consider_uv', '1'),
  ]);
  return {
    enabled: enabled === '1',
    temperaturePreference: tempPref as 'cold' | 'moderate' | 'hot',
    avoidRain: avoidRain === '1',
    avoidHeat: avoidHeat === '1',
    considerUV: considerUV === '1',
  };
}

/**
 * Get a human-readable description of weather conditions
 */
export function getWeatherDescription(condition: WeatherCondition): string {
  const code = condition.weatherCode;

  if (code === WEATHER_CODES.CLEAR_SKY) return t('weather_clear_sky');
  if (code === WEATHER_CODES.MAINLY_CLEAR) return t('weather_mainly_clear');
  if (code === WEATHER_CODES.PARTLY_CLOUDY) return t('weather_partly_cloudy');
  if (code === WEATHER_CODES.OVERCAST) return t('weather_overcast');
  if (code === WEATHER_CODES.FOG) return t('weather_foggy');
  if (code >= WEATHER_CODES.DRIZZLE_LIGHT && code <= WEATHER_CODES.DRIZZLE_DENSE)
    return t('weather_drizzle');
  if (code >= WEATHER_CODES.RAIN_LIGHT && code <= WEATHER_CODES.RAIN_HEAVY)
    return t('weather_rain');
  if (code >= WEATHER_CODES.SNOW_LIGHT && code <= WEATHER_CODES.SNOW_HEAVY)
    return t('weather_snow');
  if (code >= WEATHER_CODES.RAIN_SHOWERS_LIGHT && code <= WEATHER_CODES.RAIN_SHOWERS_HEAVY)
    return t('weather_rain_showers');
  if (code === WEATHER_CODES.SNOW_SHOWERS) return t('weather_snow_showers');
  if (code === WEATHER_CODES.THUNDERSTORM) return t('weather_thunderstorm');

  return t('weather_unknown');
}

/**
 * Get a weather emoji for the condition
 */
export function getWeatherEmoji(condition: WeatherCondition): string {
  const code = condition.weatherCode;

  if (code === WEATHER_CODES.CLEAR_SKY) return condition.isDay ? '☀️' : '🌙';
  if (code === WEATHER_CODES.MAINLY_CLEAR) return condition.isDay ? '🌤️' : '🌙';
  if (code === WEATHER_CODES.PARTLY_CLOUDY) return '⛅';
  if (code === WEATHER_CODES.OVERCAST) return '☁️';
  if (code === WEATHER_CODES.FOG) return '🌫️';
  if (code >= WEATHER_CODES.DRIZZLE_LIGHT && code <= WEATHER_CODES.DRIZZLE_DENSE) return '🌦️';
  if (code >= WEATHER_CODES.RAIN_LIGHT && code <= WEATHER_CODES.RAIN_HEAVY) return '🌧️';
  if (code >= WEATHER_CODES.SNOW_LIGHT && code <= WEATHER_CODES.SNOW_HEAVY) return '❄️';
  if (code >= WEATHER_CODES.RAIN_SHOWERS_LIGHT && code <= WEATHER_CODES.RAIN_SHOWERS_HEAVY)
    return '🌦️';
  if (code === WEATHER_CODES.SNOW_SHOWERS) return '🌨️';
  if (code === WEATHER_CODES.THUNDERSTORM) return '⛈️';

  return '🌡️';
}
