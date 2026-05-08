import { DWELL_NOTIFICATION_DELAY_SECONDS } from '../../detection/constants';
import { getSmartReminderScheduler } from '../notificationManager';
import { setSettingAsync } from '../../storage';

export interface IDwellService {
  scheduleDwellPrompt(): Promise<void>;
  cancelDwellPrompt(): Promise<void>;
}

export class DwellService implements IDwellService {
  public async scheduleDwellPrompt(): Promise<void> {
    const timestamp = Date.now() + DWELL_NOTIFICATION_DELAY_SECONDS * 1000;
    await setSettingAsync('dwell_suggestion_timestamp', timestamp.toString());
    const scheduler = getSmartReminderScheduler();
    if (scheduler) {
      await scheduler.scheduleUpcomingReminders();
    }
  }

  public async cancelDwellPrompt(): Promise<void> {
    await setSettingAsync('dwell_suggestion_timestamp', '0');
    const scheduler = getSmartReminderScheduler();
    if (scheduler) {
      await scheduler.scheduleUpcomingReminders();
    }
  }
}
