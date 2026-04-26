import { SmartReminderModule } from '../modules/SmartReminderModule';
import { scoreReminderHours } from '../notifications/reminderAlgorithm';

export const smartReminderHeadlessTask = async () => {
  console.log('[SR_SCHEDULER] Headless task started to compute next schedule');
  try {
    // Use existing scoring logic to find best times
    const now = new Date();
    const scores = await scoreReminderHours(0, 30, now.getHours(), now.getMinutes(), []);

    const upcoming = scores
      .filter((s) => s.score > 0.4) // threshold for a "good" time
      .slice(0, 3) // limit to 3 reminders per recalculation cycle
      .map((s) => {
        const alarmTime = new Date();
        alarmTime.setHours(s.hour, s.minute, 0, 0);
        if (alarmTime.getTime() < Date.now()) {
          alarmTime.setDate(alarmTime.getDate() + 1);
        }
        return {
          timestamp: alarmTime.getTime(),
          type: 'smart_reminder',
          goalThreshold: 30,
          title: 'Time to get outside!',
          body: 'Your scheduled reminder is here.',
        };
      });

    await SmartReminderModule.cancelAllReminders();
    await SmartReminderModule.scheduleReminders(upcoming);
    console.log('[SR_ALARM_SET] Alarms scheduled:', upcoming);
  } catch (e) {
    console.error('[SR_SCHEDULER] Error computing schedule', e);
  }
};
