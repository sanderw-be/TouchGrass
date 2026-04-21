/**
 * Weather service for TouchGrass
 * Fetches weather data from Open-Meteo API (free, no API key required)
 * Uses device location to get local weather forecast
 */

import * as Location from 'expo-location';
import { WeatherCondition } from './types';
import {
  saveWeatherConditionsAsync,
  getWeatherConditionsForHourAsync,
  getWeatherCacheAsync,
  saveWeatherCacheAsync,
  clearExpiredWeatherDataAsync,
} from '../storage';

const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_TEMPERATURE_CELSIUS = 15; // Fallback when API doesn't provide data

interface OpenMeteoHourly {
  time: string[];
  temperature_2m?: number[];
  precipitation_probability?: number[];
  cloud_cover?: number[];
  uv_index?: number[];
  wind_speed_10m?: number[];
  weather_code?: number[];
  is_day?: number[];
}

interface OpenMeteoResponse {
  hourly?: OpenMeteoHourly;
}

export interface WeatherFetchResult {
  success: boolean;
  conditions?: WeatherCondition[];
  error?: string;
}

export interface FetchWeatherForecastOptions {
  allowPermissionPrompt?: boolean;
}

/**
 * Fetch weather forecast for the current location
 * Returns hourly forecast for the next 24 hours
 */
export async function fetchWeatherForecast(
  options: FetchWeatherForecastOptions = {}
): Promise<WeatherFetchResult> {
  try {
    const { allowPermissionPrompt = true } = options;

    // Check cache first
    const cache = await getWeatherCacheAsync();
    const now = Date.now();

    if (cache && cache.expiresAt > now) {
      // Cache is still valid, return cached data
      const todayStart = getStartOfDay(now);
      const conditions = await getWeatherConditionsForHourAsync(todayStart, 0, 24);

      if (conditions.length > 0) {
        console.log('Weather forecast source: cache-fresh');
        return { success: true, conditions };
      }
    }

    // Resolve coordinates with resilient fallback order:
    // 1) current fix, 2) last known fix, 3) cached coordinates.
    let latitude: number | null = null;
    let longitude: number | null = null;
    let locationSource: 'current' | 'lastKnown' | 'cache' | null = null;

    const foregroundPermissions = await Location.getForegroundPermissionsAsync();
    let permissionGranted = foregroundPermissions.status === 'granted';

    if (!permissionGranted && allowPermissionPrompt) {
      const requestedPermissions = await Location.requestForegroundPermissionsAsync();
      permissionGranted = requestedPermissions.status === 'granted';
    }

    if (permissionGranted) {
      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (servicesEnabled) {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
          locationSource = 'current';
        } catch {
          const lastKnownLocation = await Location.getLastKnownPositionAsync({
            maxAge: 6 * 60 * 60 * 1000,
            requiredAccuracy: 5000,
          });

          if (lastKnownLocation) {
            latitude = lastKnownLocation.coords.latitude;
            longitude = lastKnownLocation.coords.longitude;
            locationSource = 'lastKnown';
          }
        }
      }
    }

    if (latitude === null || longitude === null) {
      if (cache) {
        latitude = cache.latitude;
        longitude = cache.longitude;
        locationSource = 'cache';
      } else if (!permissionGranted) {
        return { success: false, error: 'Location permission denied' };
      } else {
        return {
          success: false,
          error: 'Current location is unavailable. Make sure that location services are enabled.',
        };
      }
    }

    if (locationSource) {
      console.log(`Weather location source: ${locationSource}`);
    }

    // Fetch weather data from Open-Meteo
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      hourly: [
        'temperature_2m',
        'precipitation_probability',
        'cloud_cover',
        'uv_index',
        'wind_speed_10m',
        'weather_code',
        'is_day',
      ].join(','),
      forecast_days: '1',
      timezone: 'auto',
    });

    const response = await fetch(`${OPEN_METEO_API}?${params.toString()}`);

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();

    // Parse and save weather conditions
    const conditions = parseWeatherData(data, now);

    if (conditions.length > 0) {
      // Clear old weather data first
      await clearExpiredWeatherDataAsync(now);

      // Save new conditions
      await saveWeatherConditionsAsync(conditions);

      // Update cache metadata
      await saveWeatherCacheAsync({
        fetchedAt: now,
        latitude,
        longitude,
        expiresAt: now + CACHE_DURATION_MS,
      });

      console.log('Weather forecast source: network');

      return { success: true, conditions };
    }

    return { success: false, error: 'No weather data available' };
  } catch (error) {
    console.warn('Weather fetch error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get weather condition for a specific hour
 * Returns cached data if available, otherwise returns null
 */
export async function getWeatherForHour(hour: number): Promise<WeatherCondition | null> {
  const now = Date.now();
  const todayStart = getStartOfDay(now);
  const conditions = await getWeatherConditionsForHourAsync(todayStart, hour, hour + 1);

  return conditions.length > 0 ? conditions[0] : null;
}

/**
 * Check if weather data is available and fresh
 */
export async function isWeatherDataAvailable(): Promise<boolean> {
  const cache = await getWeatherCacheAsync();
  const now = Date.now();

  if (!cache || cache.expiresAt <= now) {
    return false;
  }

  // Check if we have any conditions for today
  const todayStart = getStartOfDay(now);
  const conditions = await getWeatherConditionsForHourAsync(todayStart, 0, 24);

  return conditions.length > 0;
}

// ── Helpers ───────────────────────────────────────────────

function parseWeatherData(data: OpenMeteoResponse, fetchTime: number): WeatherCondition[] {
  const conditions: WeatherCondition[] = [];

  if (!data.hourly || !data.hourly.time) {
    return conditions;
  }

  const { hourly } = data;
  const length = hourly.time.length;

  for (let i = 0; i < length; i++) {
    const forecastTime = new Date(hourly.time[i]);
    const forecastDate = getStartOfDay(forecastTime.getTime());
    const forecastHour = forecastTime.getHours();

    conditions.push({
      timestamp: fetchTime,
      forecastHour,
      forecastDate,
      temperature: hourly.temperature_2m?.[i] ?? DEFAULT_TEMPERATURE_CELSIUS,
      precipitationProbability: hourly.precipitation_probability?.[i] ?? 0,
      cloudCover: hourly.cloud_cover?.[i] ?? 0,
      uvIndex: hourly.uv_index?.[i] ?? 0,
      windSpeed: hourly.wind_speed_10m?.[i] ?? 0,
      weatherCode: hourly.weather_code?.[i] ?? 0,
      isDay: hourly.is_day?.[i] === 1,
    });
  }

  return conditions;
}

function getStartOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
