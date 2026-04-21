import { getContainer } from '../core/container';

// Re-export constants for easy access
export {
  ACTION_WENT_OUTSIDE,
  ACTION_SNOOZE,
  ACTION_LESS_OFTEN,
  CHANNEL_ID,
  DAILY_PLANNER_NOTIF_PREFIX,
} from './services/NotificationInfrastructureService';

export { FAILSAFE_REMINDER_PREFIX } from './services/SmartReminderScheduler';

// Export types
export interface ReminderQueueEntry {
  id: string;
  slotMinutes: number;
  status: 'date_planned' | 'tick_planned' | 'consumed';
}

/**
 * Accessors for notification services from the IoC container.
 */
export const getNotificationInfrastructureService = () =>
  getContainer().notificationInfrastructureService;
export const getSmartReminderScheduler = () => getContainer().smartReminderScheduler;
export const getScheduledNotificationManager = () => getContainer().scheduledNotificationManager;
export const getNotificationResponseHandler = () => getContainer().notificationResponseHandler;
export const getReminderQueueManager = () => getContainer().reminderQueueManager;
export const getReminderMessageBuilder = () => getContainer().reminderMessageBuilder;
