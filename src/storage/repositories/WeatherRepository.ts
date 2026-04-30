import { db, initDatabaseAsync } from '../db';
import { WeatherCondition, WeatherCache } from '../../weather/types';

interface WeatherConditionRow {
  id: number;
  timestamp: number;
  forecastHour: number;
  forecastDate: number;
  temperature: number;
  precipitationProbability: number;
  cloudCover: number;
  uvIndex: number;
  windSpeed: number;
  weatherCode: number;
  isDay: number;
}

export async function saveWeatherConditionsAsync(conditions: WeatherCondition[]): Promise<void> {
  await initDatabaseAsync();
  await db.withExclusiveTransactionAsync(async () => {
    for (const condition of conditions) {
      await db.runAsync(
        `INSERT INTO weather_conditions 
         (timestamp, forecastHour, forecastDate, temperature, precipitationProbability, 
          cloudCover, uvIndex, windSpeed, weatherCode, isDay)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          condition.timestamp,
          condition.forecastHour,
          condition.forecastDate,
          condition.temperature,
          condition.precipitationProbability,
          condition.cloudCover,
          condition.uvIndex,
          condition.windSpeed,
          condition.weatherCode,
          condition.isDay ? 1 : 0,
        ]
      );
    }
  });
}

export async function getWeatherConditionsForHourAsync(
  forecastDate: number,
  startHour: number,
  endHour: number
): Promise<WeatherCondition[]> {
  await initDatabaseAsync();
  const rows = await db.getAllAsync<WeatherConditionRow>(
    `SELECT * FROM weather_conditions 
     WHERE forecastDate = ? AND forecastHour >= ? AND forecastHour < ?
     ORDER BY forecastHour ASC`,
    [forecastDate, startHour, endHour]
  );

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    forecastHour: row.forecastHour,
    forecastDate: row.forecastDate,
    temperature: row.temperature,
    precipitationProbability: row.precipitationProbability,
    cloudCover: row.cloudCover,
    uvIndex: row.uvIndex,
    windSpeed: row.windSpeed,
    weatherCode: row.weatherCode,
    isDay: row.isDay === 1,
  }));
}

export async function saveWeatherCacheAsync(cache: WeatherCache): Promise<void> {
  await initDatabaseAsync();
  await db.runAsync(
    `INSERT OR REPLACE INTO weather_cache (id, fetchedAt, latitude, longitude, expiresAt)
     VALUES (1, ?, ?, ?, ?)`,
    [cache.fetchedAt, cache.latitude, cache.longitude, cache.expiresAt]
  );
}

export async function getWeatherCacheAsync(): Promise<WeatherCache | null> {
  await initDatabaseAsync();
  return await db.getFirstAsync<WeatherCache>('SELECT * FROM weather_cache WHERE id = 1');
}

export async function clearExpiredWeatherDataAsync(now: number): Promise<void> {
  await initDatabaseAsync();
  const cutoff = now - 24 * 60 * 60 * 1000;
  await db.runAsync('DELETE FROM weather_conditions WHERE timestamp < ?', [cutoff]);
}
