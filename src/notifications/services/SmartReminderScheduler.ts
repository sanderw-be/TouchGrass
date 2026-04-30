import * as Notifications from 'expo-notifications';
import { IStorageService } from '../../storage/StorageService';
import { IReminderMessageBuilder } from './ReminderMessageBuilder';
import { IReminderQueueManager } from './ReminderQueueManager';
import { IScheduledNotificationManager } from './ScheduledNotificationManager';
import { CHANNEL_ID, DAILY_PLANNER_NOTIF_PREFIX } from './NotificationInfrastructureService';
import { ReminderQueueEntry } from '../notificationManager';
import { ScoreContributor, HourScore } from '../reminderAlgorithm';
import { WeatherPreferences } from '../../weather/types';
import { SmartReminderModule, ReminderScheduleItem } from '../../modules/SmartReminderModule';

export const FAILSAFE_REMINDER_PREFIX = 'failsafe_reminder_';
const FAILSAFE_DAYS_AHEAD = 3;

/** Grace window (ms) added to "now" when scoring today's slots so that the
 *  just-fired slot can never be re-picked during a headless re-plan. */
const REPLAN_GRACE_MS = 2 * 60 * 1000;

export interface ReplanOptions {
  /** True when called from the headless task after an alarm fires. */
  isHeadlessReplan?: boolean;
}

interface IReminderAlgorithm {
  shouldRemindNow(
    todayMinutes: number,
    dailyTarget: number,
    lastMs: number,
    isCurrentlyOutside: boolean
  ): Promise<{ should: boolean; reason: string; contributors: ScoreContributor[] }>;
  scoreReminderHours(
    todayMinutes: number,
    dailyTarget: number,
    currentHour: number,
    currentMinute: number,
    plannedSlots?: { hour: number; minute: number }[],
    baseDateMs?: number
  ): Promise<HourScore[]>;
  getWeatherPreferences(): Promise<WeatherPreferences>;
}

export interface ISmartReminderScheduler {
  scheduleNextReminder(): Promise<void>;
  processReminderQueue(): Promise<void>;
  updateUpcomingReminderContent(): Promise<void>;
  scheduleUpcomingReminders(options?: ReplanOptions): Promise<void>;
  cancelRemindersIfGoalReached(): Promise<void>;
  cancelAutomaticReminders(): Promise<void>;
  _resetSchedulingGuards(): void;
}

export class SmartReminderScheduler implements ISmartReminderScheduler {
  private schedulingInProgress = false;

  constructor(
    private storageService: IStorageService,
    private messageBuilder: IReminderMessageBuilder,
    private queueManager: IReminderQueueManager,
    private scheduledManager: IScheduledNotificationManager,
    private calendarService: {
      hasUpcomingEvent(buffer: number): Promise<boolean>;
      maybeAddOutdoorTimeToCalendar(date: Date): Promise<void>;
      deleteFutureTouchGrassEvents(date: Date, days: number): Promise<void>;
    },
    private weatherService: {
      fetchWeatherForecast(options: { allowPermissionPrompt: boolean }): Promise<void>;
    },
    private reminderAlgorithm: IReminderAlgorithm
  ) {}

  public _resetSchedulingGuards(): void {
    this.schedulingInProgress = false;
  }

  /**
   * Legacy one-off reminder logic.
   * Mostly superseded by the proactive rolling schedule, but kept as a fallback.
   */
  public async scheduleNextReminder(): Promise<void> {
    const todayMinutes = await this.storageService.getTodayMinutesAsync();
    const dailyTarget = (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;
    const remindersCount = parseInt(
      await this.storageService.getSettingAsync('smart_reminders_count', '2'),
      10
    );

    if (remindersCount === 0) return;

    if (todayMinutes >= dailyTarget) {
      await this.cancelAutomaticReminders();
      return;
    }

    const [lastReminderRaw, currentlyOutsideRaw, calendarBufferRaw] = await Promise.all([
      this.storageService.getSettingAsync('last_reminder_ms', '0'),
      this.storageService.getSettingAsync('currently_outside', '0'),
      this.storageService.getSettingAsync('calendar_buffer_minutes', '30'),
    ]);
    const lastReminderMs = parseInt(lastReminderRaw, 10);
    const isCurrentlyOutside = currentlyOutsideRaw === '1';

    if (await this.scheduledManager.hasScheduledNotificationNearby(60)) return;

    const calendarBuffer = parseInt(calendarBufferRaw, 10);
    if (await this.calendarService.hasUpcomingEvent(calendarBuffer)) return;

    const { should } = await this.reminderAlgorithm.shouldRemindNow(
      todayMinutes,
      dailyTarget,
      lastReminderMs,
      isCurrentlyOutside
    );

    if (!should) return;

    const { title, body } = await this.messageBuilder.buildReminderMessage(
      todayMinutes,
      dailyTarget,
      new Date().getHours(),
      undefined
    );

    await Notifications.scheduleNotificationAsync({
      content: { title, body, categoryIdentifier: 'reminder', color: '#4A7C59' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: CHANNEL_ID,
      },
    });

    await this.storageService.setSettingAsync('last_reminder_ms', String(Date.now()));
  }

  public async processReminderQueue(): Promise<void> {
    const remindersCount = parseInt(
      await this.storageService.getSettingAsync('smart_reminders_count', '0'),
      10
    );
    if (remindersCount === 0) return;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const WINDOW = 15;
    const CONSUMED_TTL = 60;

    let queue = await this.queueManager.getQueue();
    if (queue.length === 0) return;

    const todayMinutes = await this.storageService.getTodayMinutesAsync();
    const dailyTarget = (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;

    const updatedQueue: ReminderQueueEntry[] = [];
    for (const entry of queue) {
      const isToday = entry.id.includes(this.formatLocalDateKey(now));

      if (isToday && todayMinutes >= dailyTarget && entry.status !== 'consumed') {
        await Notifications.cancelScheduledNotificationAsync(entry.id).catch(() => {});
        continue;
      }

      if (entry.status === 'consumed') {
        if (!isToday) continue; // Cleanup old days
        const minutesSince = nowMinutes - entry.slotMinutes;
        if (minutesSince < 0 || minutesSince >= CONSUMED_TTL) continue;
        updatedQueue.push(entry);
        continue;
      }

      if (entry.status === 'date_planned') {
        if (isToday && nowMinutes >= entry.slotMinutes) {
          entry.status = 'consumed';
        }
        updatedQueue.push(entry);
        continue;
      }

      // Legacy tick_planned handling (if any remain)
      if (entry.status === 'tick_planned') {
        if (
          isToday &&
          nowMinutes >= entry.slotMinutes &&
          nowMinutes <= entry.slotMinutes + WINDOW
        ) {
          const { title, body } = await this.messageBuilder.buildReminderMessage(
            todayMinutes,
            dailyTarget,
            Math.floor(entry.slotMinutes / 60),
            undefined
          );
          await Notifications.scheduleNotificationAsync({
            content: { title, body, categoryIdentifier: 'reminder', color: '#4A7C59' },
            trigger: null, // immediate fire since we missed the exact start
          });
          await this.storageService.setSettingAsync('last_reminder_ms', String(Date.now()));
          entry.status = 'consumed';
        } else if (isToday && nowMinutes > entry.slotMinutes + WINDOW) {
          continue; // expired
        }
        updatedQueue.push(entry);
        continue;
      }
      updatedQueue.push(entry);
    }

    await this.queueManager.saveQueue(updatedQueue);
  }

  public async updateUpcomingReminderContent(): Promise<void> {
    const remindersCount = parseInt(
      await this.storageService.getSettingAsync('smart_reminders_count', '0'),
      10
    );
    if (remindersCount === 0) return;

    const UPDATE_WINDOW_MINUTES = 30;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const todayStr = this.formatLocalDateKey(now);

    const queue = await this.queueManager.getQueue();
    if (queue.length === 0) return;

    const todayMinutes = await this.storageService.getTodayMinutesAsync();
    const dailyTarget = (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;

    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledMap = new Map<string, Notifications.NotificationRequest>();
    for (const notif of allScheduled) {
      scheduledMap.set(notif.identifier, notif);
    }

    for (const entry of queue) {
      if (entry.status !== 'date_planned' || !entry.id.includes(todayStr)) continue;

      const minutesUntilSlot = entry.slotMinutes - nowMinutes;
      if (minutesUntilSlot < 0 || minutesUntilSlot > UPDATE_WINDOW_MINUTES) continue;

      const scheduledNotif = scheduledMap.get(entry.id);
      if (!scheduledNotif) continue;

      const { title, body } = await this.messageBuilder.buildReminderMessage(
        todayMinutes,
        dailyTarget,
        Math.floor(entry.slotMinutes / 60),
        undefined
      );

      if (scheduledNotif.content.body === body) continue;

      await Notifications.cancelScheduledNotificationAsync(entry.id);
      const triggerDate = new Date();
      triggerDate.setHours(Math.floor(entry.slotMinutes / 60), entry.slotMinutes % 60, 0, 0);

      await Notifications.scheduleNotificationAsync({
        identifier: entry.id,
        content: { title, body, categoryIdentifier: 'reminder', color: '#4A7C59' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.floor((triggerDate.getTime() - Date.now()) / 1000)),
          channelId: CHANNEL_ID,
        },
      });
    }
  }

  /**
   * The core planning loop. Calculates and schedules reminders for Today and Tomorrow.
   * Ensures the "chain" is never broken by always looking 48 hours ahead.
   *
   * When `isHeadlessReplan` is true (called from the headless task after an alarm
   * fires), today's remaining slots are carried forward unchanged from the existing
   * queue — no re-scoring, no shuffling.  Tomorrow is always fully re-planned.
   * Expensive calendar / weather / failsafe operations are skipped.
   */
  public async scheduleUpcomingReminders(options?: ReplanOptions): Promise<void> {
    if (this.schedulingInProgress) return;
    this.schedulingInProgress = true;

    const isHeadless = options?.isHeadlessReplan === true;

    try {
      const now = new Date();
      const remindersCount = parseInt(
        await this.storageService.getSettingAsync('smart_reminders_count', '2'),
        10
      );

      // 1. Cleanup old failsafe reminders and future events (skip during headless)
      if (!isHeadless) {
        await this.cancelFailsafeReminders();
        await this.calendarService.deleteFutureTouchGrassEvents(now, FAILSAFE_DAYS_AHEAD);
      }

      if (remindersCount === 0) {
        await this.cancelAutomaticReminders();
        await this.queueManager.clearQueue();
        await Promise.all([
          this.storageService.setSettingAsync('reminders_planned_slots', '[]'),
          this.storageService.setSettingAsync('additional_reminders_today', '0'),
          this.storageService.setSettingAsync('catchup_reminder_slot_minutes', ''),
        ]);
        return;
      }

      // 2. Fetch fresh weather for the next 48 hours (skip during headless)
      if (!isHeadless) {
        const weatherPrefs = await this.reminderAlgorithm.getWeatherPreferences();
        if (weatherPrefs.enabled) {
          await this.weatherService.fetchWeatherForecast({ allowPermissionPrompt: false });
        }
      }

      const todayMinutes = await this.storageService.getTodayMinutesAsync();
      const dailyTarget =
        (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;

      const allPlannedItems: ReminderScheduleItem[] = [];
      const newQueueEntries: ReminderQueueEntry[] = [];
      const uiSlots: { hour: number; minute: number }[] = [];

      // 3. Plan for Today
      if (todayMinutes < dailyTarget) {
        if (isHeadless) {
          // ── Headless replan: lock today's plan ──────────────────────
          // Carry forward remaining future slots from the existing queue
          // instead of re-scoring. This keeps today's schedule stable.
          await this.carryForwardTodaySlots(
            now,
            todayMinutes,
            dailyTarget,
            allPlannedItems,
            newQueueEntries,
            uiSlots
          );
        } else {
          // ── Full plan: score and pick best slots for today ─────────
          const todaySlots = await this.planDaySlots(
            now,
            todayMinutes,
            dailyTarget,
            remindersCount,
            true // Include catchup for today
          );
          for (const slot of todaySlots) {
            const trigger = this.slotToDate(now, slot);
            const { title, body } = await this.messageBuilder.buildReminderMessage(
              todayMinutes,
              dailyTarget,
              slot.hour,
              slot.contributors?.map((c) => c.description) || []
            );
            const id = `smart_${this.formatLocalDateKey(now)}_${slot.hour}:${slot.minute}`;

            allPlannedItems.push({
              timestamp: trigger.getTime(),
              type: slot.isCatchup ? 'catchup_reminder' : 'smart_reminder',
              goalThreshold: dailyTarget,
              title,
              body,
              contributors: slot.contributors?.map((c) => c.description) || [],
            });
            newQueueEntries.push({
              id,
              slotMinutes: slot.hour * 60 + slot.minute,
              status: 'date_planned',
            });
            uiSlots.push({ hour: slot.hour, minute: slot.minute });
            await this.calendarService.maybeAddOutdoorTimeToCalendar(trigger);
          }
        }
      }

      // 4. Plan for Tomorrow (Full Day — always re-plan to find better slots)
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const tomorrowSlots = await this.planDaySlots(
        tomorrow,
        0, // Assume 0 minutes for tomorrow start
        dailyTarget,
        remindersCount,
        false // No catchup for tomorrow yet
      );
      for (const slot of tomorrowSlots) {
        const trigger = this.slotToDate(tomorrow, slot);
        const { title, body } = await this.messageBuilder.buildReminderMessage(
          0,
          dailyTarget,
          slot.hour,
          slot.contributors?.map((c) => c.description) || []
        );
        const id = `smart_${this.formatLocalDateKey(tomorrow)}_${slot.hour}:${slot.minute}`;

        allPlannedItems.push({
          timestamp: trigger.getTime(),
          type: 'smart_reminder',
          goalThreshold: dailyTarget,
          title,
          body,
          contributors: slot.contributors?.map((c) => c.description) || [],
        });
        newQueueEntries.push({
          id,
          slotMinutes: slot.hour * 60 + slot.minute,
          status: 'date_planned',
        });
        if (!isHeadless) {
          await this.calendarService.maybeAddOutdoorTimeToCalendar(trigger);
        }
      }

      // 5. Sync with Native Module
      await SmartReminderModule.cancelAllReminders();
      if (allPlannedItems.length > 0) {
        await SmartReminderModule.scheduleReminders(allPlannedItems);
      }

      // 6. Persist State
      await this.queueManager.saveQueue(newQueueEntries);
      await this.storageService.setSettingAsync('reminders_planned_slots', JSON.stringify(uiSlots));
      await this.storageService.setSettingAsync('reminders_last_planned_date', now.toDateString());

      // 7. Schedule Failsafe fallbacks for Day 2+ (skip during headless)
      if (!isHeadless) {
        await this.scheduleFailsafeReminders(tomorrowSlots);
      }

      await this.storageService.insertBackgroundLogAsync(
        'reminder',
        `${isHeadless ? 'Headless' : 'Rolling'} plan: ${allPlannedItems.length} reminders scheduled for next 48h`
      );
    } finally {
      this.schedulingInProgress = false;
    }
  }

  /**
   * Carry forward today's remaining future slots from the existing queue.
   * Used during headless re-plans so that today's schedule is stable.
   */
  private async carryForwardTodaySlots(
    now: Date,
    todayMinutes: number,
    dailyTarget: number,
    allPlannedItems: ReminderScheduleItem[],
    newQueueEntries: ReminderQueueEntry[],
    uiSlots: { hour: number; minute: number }[]
  ): Promise<void> {
    const existingQueue = await this.queueManager.getQueue();
    const todayKey = this.formatLocalDateKey(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const graceMinutes = Math.ceil(REPLAN_GRACE_MS / 60000);

    for (const entry of existingQueue) {
      if (!entry.id.includes(todayKey)) continue;
      if (entry.status !== 'date_planned') continue;
      if (entry.slotMinutes <= nowMinutes + graceMinutes) continue;

      // Carry this slot forward — rebuild message content for freshness
      const slotHour = Math.floor(entry.slotMinutes / 60);
      const slotMinute = entry.slotMinutes % 60;
      const trigger = this.slotToDate(now, { hour: slotHour, minute: slotMinute });
      const { title, body } = await this.messageBuilder.buildReminderMessage(
        todayMinutes,
        dailyTarget,
        slotHour,
        []
      );

      // Detect type from the existing queue entry ID
      const type = entry.id.startsWith('catchup_') ? 'catchup_reminder' : 'smart_reminder';

      allPlannedItems.push({
        timestamp: trigger.getTime(),
        type,
        goalThreshold: dailyTarget,
        title,
        body,
        contributors: [],
      });
      newQueueEntries.push({
        id: entry.id,
        slotMinutes: entry.slotMinutes,
        status: 'date_planned',
      });
      uiSlots.push({ hour: slotHour, minute: slotMinute });
    }
  }

  private async planDaySlots(
    date: Date,
    minutesSoFar: number,
    target: number,
    count: number,
    includeCatchup: boolean
  ): Promise<(HourScore & { isCatchup?: boolean })[]> {
    const isToday = date.toDateString() === new Date().toDateString();
    // Add a grace window so the just-fired slot cannot be re-picked.
    // Without this, a re-plan at 10:00:30 would still consider :00 as valid.
    const graceMs = isToday ? REPLAN_GRACE_MS : 0;
    const adjustedNow = new Date(date.getTime() + graceMs);
    const startHour = isToday ? adjustedNow.getHours() : 0;
    const startMin = isToday ? adjustedNow.getMinutes() : 0;

    const picked: (HourScore & { isCatchup?: boolean })[] = [];

    // Plan standard smart reminders
    while (picked.length < count) {
      const scores = await this.reminderAlgorithm.scoreReminderHours(
        minutesSoFar,
        target,
        startHour,
        startMin,
        picked,
        date.getTime()
      );

      let found = false;
      for (const slot of scores) {
        if (slot.score < 0.3) continue;
        if (await this.scheduledManager.isSlotNearScheduledNotification(slot.hour, slot.minute, 30))
          continue;

        picked.push(slot);
        found = true;
        break;
      }
      if (!found) break;
    }

    // Integrated Catch-up logic for TODAY
    if (includeCatchup && isToday && minutesSoFar < target) {
      const catchupLimit = parseInt(
        await this.storageService.getSettingAsync('smart_catchup_reminders_count', '2'),
        10
      );
      const currentProgress = (date.getHours() - 7) / 14; // Approximate day progress (7am to 9pm)
      const expectedMinutes = target * Math.max(0, currentProgress);

      if (minutesSoFar < expectedMinutes && catchupLimit > 0) {
        const scores = await this.reminderAlgorithm.scoreReminderHours(
          minutesSoFar,
          target,
          startHour,
          startMin,
          picked,
          date.getTime()
        );

        let catchupAdded = 0;
        for (const slot of scores) {
          if (catchupAdded >= catchupLimit) break;
          if (slot.score < 0.25) continue;
          if (
            await this.scheduledManager.isSlotNearScheduledNotification(slot.hour, slot.minute, 30)
          )
            continue;

          picked.push({ ...slot, isCatchup: true });
          catchupAdded++;
        }
      }
    }

    return picked.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  }

  private slotToDate(baseDate: Date, slot: { hour: number; minute: number }): Date {
    const d = new Date(baseDate);
    d.setHours(slot.hour, slot.minute, 0, 0);
    return d;
  }

  public async cancelRemindersIfGoalReached(): Promise<void> {
    const todayMinutes = await this.storageService.getTodayMinutesAsync();
    const dailyTarget = (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;
    if (todayMinutes >= dailyTarget) {
      // We don't clear the whole queue anymore, just process it to cancel today's pending ones.
      await this.processReminderQueue();
    }
  }

  public async cancelAutomaticReminders(): Promise<void> {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of all) {
      if (
        !notif.identifier.startsWith('scheduled_') &&
        !notif.identifier.startsWith(DAILY_PLANNER_NOTIF_PREFIX) &&
        !notif.identifier.startsWith(FAILSAFE_REMINDER_PREFIX) &&
        !notif.identifier.startsWith('smart_') &&
        !notif.identifier.startsWith('catchup_')
      ) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  }

  private formatLocalDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private async cancelFailsafeReminders(): Promise<void> {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of all) {
      if (notif.identifier.startsWith(FAILSAFE_REMINDER_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  }

  private async scheduleFailsafeReminders(
    slots: { hour: number; minute: number }[]
  ): Promise<void> {
    const dailyTarget = (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;
    // Failsafe starts from Day 2 (Day 1 is already planned rolling)
    for (let daysAhead = 2; daysAhead <= FAILSAFE_DAYS_AHEAD + 1; daysAhead++) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const triggerDate = new Date(futureDate);
        triggerDate.setHours(slot.hour, slot.minute, 0, 0);
        const { title, body } = await this.messageBuilder.buildReminderMessage(
          0,
          dailyTarget,
          slot.hour,
          undefined
        );
        await Notifications.scheduleNotificationAsync({
          identifier: `${FAILSAFE_REMINDER_PREFIX}${this.formatLocalDateKey(futureDate)}_${i}`,
          content: { title, body, categoryIdentifier: 'reminder', color: '#4A7C59' },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: CHANNEL_ID,
          },
        });
        await this.calendarService.maybeAddOutdoorTimeToCalendar(triggerDate);
      }
    }
  }
}
