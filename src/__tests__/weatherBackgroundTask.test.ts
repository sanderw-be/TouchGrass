jest.mock('../weather/weatherService');
jest.mock('../storage/database');

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as WeatherService from '../weather/weatherService';
import * as Database from '../storage/database';
import {
  registerWeatherBackgroundFetch,
  unregisterWeatherBackgroundFetch,
} from '../weather/weatherBackgroundTask';

describe('weatherBackgroundTask', () => {
  // Capture the task callback registered at module load time, before any clearAllMocks
  let taskCallback: (...args: any[]) => Promise<any>;

  beforeAll(() => {
    const call = (TaskManager.defineTask as jest.Mock).mock.calls.find(
      (c: any[]) => c[0] === 'WEATHER_BACKGROUND_FETCH'
    );
    taskCallback = call?.[1];
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerWeatherBackgroundFetch', () => {
    it('registers the task when not already registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);

      await registerWeatherBackgroundFetch();

      expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
        'WEATHER_BACKGROUND_FETCH',
        { minimumInterval: 60 }
      );
    });

    it('does not register the task when already registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);

      await registerWeatherBackgroundFetch();

      expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
    });

    it('handles registration errors gracefully', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);
      (BackgroundTask.registerTaskAsync as jest.Mock).mockRejectedValue(
        new Error('Registration failed')
      );

      await expect(registerWeatherBackgroundFetch()).resolves.not.toThrow();
    });
  });

  describe('unregisterWeatherBackgroundFetch', () => {
    it('unregisters the task when registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);

      await unregisterWeatherBackgroundFetch();

      expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(
        'WEATHER_BACKGROUND_FETCH'
      );
    });

    it('does not unregister when task is not registered', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);

      await unregisterWeatherBackgroundFetch();

      expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
    });

    it('handles unregistration errors gracefully', async () => {
      (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);
      (BackgroundTask.unregisterTaskAsync as jest.Mock).mockRejectedValue(
        new Error('Unregistration failed')
      );

      await expect(unregisterWeatherBackgroundFetch()).resolves.not.toThrow();
    });
  });

  describe('task definition', () => {
    it('defines the task with TaskManager on module load', () => {
      expect(taskCallback).toBeDefined();
    });

    it('task returns Success when weather is disabled', async () => {
      (Database.getSetting as jest.Mock).mockReturnValue('0');

      const result = await taskCallback();

      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
      expect(WeatherService.fetchWeatherForecast).not.toHaveBeenCalled();
    });

    it('task returns Success when weather fetch succeeds', async () => {
      (Database.getSetting as jest.Mock).mockReturnValue('1');
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({ success: true });

      const result = await taskCallback();

      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    });

    it('task returns Failed when weather fetch fails', async () => {
      (Database.getSetting as jest.Mock).mockReturnValue('1');
      (WeatherService.fetchWeatherForecast as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      const result = await taskCallback();

      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Failed);
    });

    it('task returns Failed on unexpected error', async () => {
      (Database.getSetting as jest.Mock).mockReturnValue('1');
      (WeatherService.fetchWeatherForecast as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await taskCallback();

      expect(result).toBe(BackgroundTask.BackgroundTaskResult.Failed);
    });
  });
});
