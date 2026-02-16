/**
 * Weather data structures for TouchGrass
 */

export interface WeatherCondition {
  id?: number;
  timestamp: number;           // unix timestamp ms when forecast was fetched
  forecastHour: number;         // hour of the day this forecast is for (0-23)
  forecastDate: number;         // unix timestamp ms (start of day) this forecast is for
  temperature: number;          // degrees Celsius
  precipitationProbability: number; // 0-100
  cloudCover: number;           // 0-100 percentage
  uvIndex: number;              // 0-11+ UV index
  windSpeed: number;            // km/h
  weatherCode: number;          // WMO weather code
  isDay: boolean;               // true if daytime, false if nighttime
}

export interface WeatherCache {
  id?: number;
  fetchedAt: number;           // unix timestamp ms when data was fetched
  latitude: number;
  longitude: number;
  expiresAt: number;           // unix timestamp ms when cache expires
}

export interface WeatherPreferences {
  enabled: boolean;
  temperaturePreference: 'cold' | 'moderate' | 'hot'; // Climate preference
  avoidRain: boolean;
  avoidHeat: boolean;
  considerUV: boolean;
}

// WMO Weather interpretation codes
// 0: Clear sky
// 1,2,3: Mainly clear, partly cloudy, overcast
// 45,48: Fog
// 51,53,55: Drizzle
// 61,63,65: Rain
// 71,73,75,77: Snow
// 80,81,82: Rain showers
// 85,86: Snow showers
// 95,96,99: Thunderstorm
export const WEATHER_CODES = {
  CLEAR_SKY: 0,
  MAINLY_CLEAR: 1,
  PARTLY_CLOUDY: 2,
  OVERCAST: 3,
  FOG: 45,
  DRIZZLE_LIGHT: 51,
  DRIZZLE_MODERATE: 53,
  DRIZZLE_DENSE: 55,
  RAIN_LIGHT: 61,
  RAIN_MODERATE: 63,
  RAIN_HEAVY: 65,
  SNOW_LIGHT: 71,
  SNOW_MODERATE: 73,
  SNOW_HEAVY: 75,
  RAIN_SHOWERS_LIGHT: 80,
  RAIN_SHOWERS_MODERATE: 81,
  RAIN_SHOWERS_HEAVY: 82,
  SNOW_SHOWERS: 85,
  THUNDERSTORM: 95,
} as const;
