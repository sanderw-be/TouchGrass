import { SQLiteDatabase } from 'expo-sqlite';
import { IStorageService, StorageService } from '../storage/StorageService';
import {
  INotificationInfrastructureService,
  NotificationInfrastructureService,
} from '../notifications/services/NotificationInfrastructureService';
import {
  IReminderMessageBuilder,
  ReminderMessageBuilder,
} from '../notifications/services/ReminderMessageBuilder';
import {
  IReminderQueueManager,
  ReminderQueueManager,
} from '../notifications/services/ReminderQueueManager';
import {
  IScheduledNotificationManager,
  ScheduledNotificationManager,
} from '../notifications/services/ScheduledNotificationManager';
import {
  INotificationResponseHandler,
  NotificationResponseHandler,
} from '../notifications/services/NotificationResponseHandler';
import {
  ISmartReminderScheduler,
  SmartReminderScheduler,
} from '../notifications/services/SmartReminderScheduler';

import type { FeedbackModalData } from '../store/useAppStore';
import {
  hasUpcomingEvent,
  maybeAddOutdoorTimeToCalendar,
  deleteFutureTouchGrassEvents,
} from '../calendar/calendarService';
import * as WeatherService from '../weather/weatherService';
import { shouldRemindNow, scoreReminderHours } from '../notifications/reminderAlgorithm';
import * as WeatherAlgorithm from '../weather/weatherAlgorithm';

export interface IAppContainer {
  storageService: IStorageService;
  notificationInfrastructureService: INotificationInfrastructureService;
  reminderMessageBuilder: IReminderMessageBuilder;
  reminderQueueManager: IReminderQueueManager;
  scheduledNotificationManager: IScheduledNotificationManager;
  notificationResponseHandler: INotificationResponseHandler;
  smartReminderScheduler: ISmartReminderScheduler;
}

let container: IAppContainer;

/**
 * Initializes the dependency injection container.
 * Must be called after the database is ready.
 */
export function createContainer(
  db: SQLiteDatabase
): IAppContainer {
  const storageService = new StorageService(db);
  const notificationInfrastructureService = new NotificationInfrastructureService();
  const reminderMessageBuilder = new ReminderMessageBuilder(storageService);
  const reminderQueueManager = new ReminderQueueManager(storageService);
  const scheduledNotificationManager = new ScheduledNotificationManager(storageService);

  const notificationResponseHandler = new NotificationResponseHandler(
    storageService,
    reminderMessageBuilder
  );

  const smartReminderScheduler = new SmartReminderScheduler(
    storageService,
    reminderMessageBuilder,
    reminderQueueManager,
    scheduledNotificationManager,
    {
      hasUpcomingEvent,
      maybeAddOutdoorTimeToCalendar,
      deleteFutureTouchGrassEvents,
    },
    {
      fetchWeatherForecast: async (opts) => {
        await WeatherService.fetchWeatherForecast(opts);
      },
    },
    {
      shouldRemindNow,
      scoreReminderHours,
      getWeatherPreferences: WeatherAlgorithm.getWeatherPreferences,
    }
  );

  container = {
    storageService,
    notificationInfrastructureService,
    reminderMessageBuilder,
    reminderQueueManager,
    scheduledNotificationManager,
    notificationResponseHandler,
    smartReminderScheduler,
  };

  return container;
}

/**
 * Provides access to the system-wide service container.
 * Throws an error if the container has not been initialized.
 */
export function getContainer(): IAppContainer {
  if (!container) {
    throw new Error(
      'TouchGrass: AppContainer has not been initialized. Call createContainer() first.'
    );
  }
  return container;
}
