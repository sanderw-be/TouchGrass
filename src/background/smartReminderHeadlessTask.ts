import { SmartReminderModule } from '../modules/SmartReminderModule';
import { scoreReminderHours } from '../notifications/reminderAlgorithm';
import { getTodayMinutesAsync, getCurrentDailyGoalAsync } from '../storage';
import { StorageService } from '../storage/StorageService';
import { db } from '../storage/db';

export const smartReminderHeadlessTask = async () => {
  console.log('[SR_SCHEDULER] Headless task started to compute next schedule');
  try {
    const storageService = new StorageService(db);
    const now = new Date();
    const todayMinutes = await getTodayMinutesAsync();
    const dailyGoal = await getCurrentDailyGoalAsync();
    const targetMinutes = dailyGoal?.targetMinutes ?? 30;

    const smartCount =
      parseInt(await storageService.getSettingAsync('smart_reminders_count', '2'), 10) || 2;
    const catchupCount =
      parseInt(await storageService.getSettingAsync('smart_catchup_reminders_count', '2'), 10) || 2;

    // 1. Calculate Smart Reminders
    const smartScores = await scoreReminderHours(
      todayMinutes,
      targetMinutes,
      now.getHours(),
      now.getMinutes(),
      []
    );

    const plannedSmartSlots = smartScores
      .filter((s) => s.score > 0.4)
      .slice(0, smartCount)
      .map((s) => ({ hour: s.hour, minute: s.minute }));

    const smartUpcoming = plannedSmartSlots.map((s) => {
      const alarmTime = new Date();
      alarmTime.setHours(s.hour, s.minute, 0, 0);
      if (alarmTime.getTime() < Date.now()) {
        alarmTime.setDate(alarmTime.getDate() + 1);
      }
      return {
        timestamp: alarmTime.getTime(),
        type: 'smart_reminder',
        goalThreshold: targetMinutes,
      };
    });

    // 2. Calculate Catch-up Reminders
    let catchupUpcoming: { timestamp: number; type: string; goalThreshold: number }[] = [];
    if (catchupCount > 0) {
      const catchupScores = await scoreReminderHours(
        todayMinutes,
        targetMinutes,
        now.getHours(),
        now.getMinutes(),
        plannedSmartSlots
      );

      catchupUpcoming = catchupScores
        .filter((s) => s.score > 0.4)
        .slice(0, catchupCount)
        .map((s) => {
          const alarmTime = new Date();
          alarmTime.setHours(s.hour, s.minute, 0, 0);
          if (alarmTime.getTime() < Date.now()) {
            alarmTime.setDate(alarmTime.getDate() + 1);
          }
          return {
            timestamp: alarmTime.getTime(),
            type: 'catchup_reminder',
            goalThreshold: targetMinutes,
          };
        });
    }

    const allUpcoming = [...smartUpcoming, ...catchupUpcoming];

    await SmartReminderModule.cancelAllReminders();
    if (allUpcoming.length > 0) {
      await SmartReminderModule.scheduleReminders(allUpcoming);
    }
    console.log('[SR_ALARM_SET] Alarms scheduled:', allUpcoming);
  } catch (e) {
    console.error('[SR_SCHEDULER] Error computing schedule', e);
  }
};
