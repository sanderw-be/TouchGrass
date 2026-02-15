/**
 * Weather service for TouchGrass
 * Fetches weather data from Open-Meteo API (free, no API key required)
 * Uses device location to get local weather forecast
 */

import * as Location from 'expo-location';
import { WeatherCondition } from './types';
import {
  saveWeatherConditions,
  getWeatherConditionsForHour,
  getWeatherCache,
  saveWeatherCache,
  clearExpiredWeatherData,
} from '../storage/database';

const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export interface WeatherFetchResult {
  success: boolean;
  conditions?: WeatherCondition[];
  error?: string;
}

/**
 * Fetch weather forecast for the current location
 * Returns hourly forecast for the next 24 hours
 */
export async function fetchWeatherForecast(): Promise<WeatherFetchResult> {
  try {
    // Check cache first
    const cache = getWeatherCache();
    const now = Date.now();
    
    if (cache && cache.expiresAt > now) {
      // Cache is still valid, return cached data
      const todayStart = getStartOfDay(now);
      const conditions = getWeatherConditionsForHour(todayStart, 0, 24);
      
      if (conditions.length > 0) {
        return { success: true, conditions };
      }
    }

    // Get current location
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { success: false, error: 'Location permission denied' };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;

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
      clearExpiredWeatherData(now);
      
      // Save new conditions
      saveWeatherConditions(conditions);
      
      // Update cache metadata
      saveWeatherCache({
        fetchedAt: now,
        latitude,
        longitude,
        expiresAt: now + CACHE_DURATION_MS,
      });
      
      return { success: true, conditions };
    }

    return { success: false, error: 'No weather data available' };
  } catch (error) {
    console.error('Weather fetch error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get weather condition for a specific hour
 * Returns cached data if available, otherwise returns null
 */
export function getWeatherForHour(hour: number): WeatherCondition | null {
  const now = Date.now();
  const todayStart = getStartOfDay(now);
  const conditions = getWeatherConditionsForHour(todayStart, hour, hour + 1);
  
  return conditions.length > 0 ? conditions[0] : null;
}

/**
 * Check if weather data is available and fresh
 */
export function isWeatherDataAvailable(): boolean {
  const cache = getWeatherCache();
  const now = Date.now();
  
  if (!cache || cache.expiresAt <= now) {
    return false;
  }
  
  // Check if we have any conditions for today
  const todayStart = getStartOfDay(now);
  const conditions = getWeatherConditionsForHour(todayStart, 0, 24);
  
  return conditions.length > 0;
}

// ── Helpers ───────────────────────────────────────────────

function parseWeatherData(data: any, fetchTime: number): WeatherCondition[] {
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
      temperature: hourly.temperature_2m?.[i] ?? 15,
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
