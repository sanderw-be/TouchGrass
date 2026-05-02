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
import { colors } from '../../utils/theme';

export const FAILSAFE_REMINDER_PREFIX = 'failsafe_reminder_';
const FAILSAFE_DAYS_AHEAD = 3;

/** Grace window (ms) added to "now" when scoring today's slots so that the
 *  just-fired slot can never be re-picked during a headless re-plan. */
const REPLAN_GRACE_MS = 2 * 60 * 1000;

const MIN_SMART_SCORE_THRESHOLD = 0.3;
const MIN_CATCHUP_SCORE_THRESHOLD = 0.2;

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
      content: { title, body, categoryIdentifier: 'reminder', color: colors.grass },
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
            content: { title, body, categoryIdentifier: 'reminder', color: colors.grass },
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
    // This function used to schedule future Expo notifications to ensure fresh content.
    // However, with the Native Alarm Bridge, scheduling future OS notifications via Expo
    // causes duplicates (one from Native/Headless and one from Expo).
    // We now rely on the Headless task to build fresh content just-in-time.
    //
    // We keep this function only for legacy support or updating ALREADY scheduled
    // notifications (like failsafe) if they happen to be in the window.

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

      // DO NOT schedule new future notifications for smart/catchup types here.
      // The Native Alarm Bridge handles the triggering.
      if (entry.id.startsWith('smart_') || entry.id.startsWith('catchup_')) {
        continue;
      }

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
        content: { title, body, categoryIdentifier: 'reminder', color: colors.grass },
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
   * Today's reminders are ALWAYS carried forward from the existing queue if they
   * exist — this ensures the plan for the current day never changes.
   * Tomorrow is always fully re-planned to find the best slots based on the
   * latest scoring (weather, calendar, etc.).
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
        // ── Today's Plan: Stability First ────────────────────────────
        // We ALWAYS try to carry forward existing slots for today to ensure
        // the user's schedule doesn't shift under them.
        await this.carryForwardTodaySlots(
          now,
          todayMinutes,
          dailyTarget,
          allPlannedItems,
          newQueueEntries,
          uiSlots
        );

        const carriedSlots = newQueueEntries.map((e) => ({
          hour: Math.floor(e.slotMinutes / 60),
          minute: e.slotMinutes % 60,
          isCatchup: e.id.startsWith('catchup_'),
        }));

        const carriedSmartCount = carriedSlots.filter((s) => !s.isCatchup).length;
        const carriedCatchupCount = carriedSlots.filter((s) => s.isCatchup).length;

        const catchupLimit = parseInt(
          await this.storageService.getSettingAsync('smart_catchup_reminders_count', '2'),
          10
        );

        if (carriedSmartCount < remindersCount || carriedCatchupCount < catchupLimit) {
          const todaySlots = await this.planDaySlots(
            now,
            todayMinutes,
            dailyTarget,
            remindersCount,
            catchupLimit,
            carriedSlots
          );
          for (const slot of todaySlots) {
            const trigger = this.slotToDate(now, slot);
            const { title, body } = await this.messageBuilder.buildReminderMessage(
              todayMinutes,
              dailyTarget,
              slot.hour,
              slot.contributors?.map((c) => c.description) || []
            );
            const prefix = slot.isCatchup ? 'catchup' : 'smart';
            const id = `${prefix}_${this.formatLocalDateKey(now)}_${slot.hour}:${slot.minute}`;

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
            if (!isHeadless) {
              await this.calendarService.maybeAddOutdoorTimeToCalendar(trigger);
            }
          }
        }
      }

      // 4. Plan for Tomorrow (Full Day — always re-plan to find better slots)
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);

      const catchupLimit = parseInt(
        await this.storageService.getSettingAsync('smart_catchup_reminders_count', '2'),
        10
      );
      const tomorrowSlots = await this.planDaySlots(
        tomorrow,
        0, // Assume 0 minutes for tomorrow start
        dailyTarget,
        remindersCount,
        catchupLimit
      );
      for (const slot of tomorrowSlots) {
        const trigger = this.slotToDate(tomorrow, slot);
        const { title, body } = await this.messageBuilder.buildReminderMessage(
          0,
          dailyTarget,
          slot.hour,
          slot.contributors?.map((c) => c.description) || []
        );
        const prefix = slot.isCatchup ? 'catchup' : 'smart';
        const id = `${prefix}_${this.formatLocalDateKey(tomorrow)}_${slot.hour}:${slot.minute}`;

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
        if (!isHeadless) {
          await this.calendarService.maybeAddOutdoorTimeToCalendar(trigger);
        }
      }

      // 5. Sync with Native Module
      // We sort all planned items by timestamp before scheduling to ensure chronological order
      allPlannedItems.sort((a, b) => a.timestamp - b.timestamp);

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
        // Failsafe slots based on tomorrow's smart reminder slots (excluding catchup for failsafe simplicity)
        const tomorrowSmartSlots = tomorrowSlots.filter((s) => !s.isCatchup);
        await this.scheduleFailsafeReminders(tomorrowSmartSlots);
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
    catchupLimit: number,
    initialSlots: { hour: number; minute: number; isCatchup?: boolean }[] = []
  ): Promise<(HourScore & { isCatchup?: boolean })[]> {
    const isToday = date.toDateString() === new Date().toDateString();
    // Add a grace window so the just-fired slot cannot be re-picked.
    // Without this, a re-plan at 10:00:30 would still consider :00 as valid.
    const graceMs = isToday ? REPLAN_GRACE_MS : 0;
    const adjustedNow = new Date(date.getTime() + graceMs);
    const startHour = isToday ? adjustedNow.getHours() : 0;
    const startMin = isToday ? adjustedNow.getMinutes() : 0;

    // Map initialSlots (simple objects) to full HourScore-like objects
    // so they are assignable to picked and can be used by the algorithm.
    const picked: (HourScore & { isCatchup?: boolean })[] = initialSlots.map((s) => ({
      hour: s.hour,
      minute: s.minute as 0 | 30,
      score: 1.0, // placeholder
      reason: 'carried_forward',
      contributors: [],
      isCatchup: s.isCatchup,
    }));

    // Plan standard smart reminders
    while (picked.filter((p) => !p.isCatchup).length < count) {
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
        if (slot.score < MIN_SMART_SCORE_THRESHOLD) continue;
        // Local duplicate guard (extra safety in case algorithm doesn't zero out proximity)
        if (picked.some((p) => p.hour === slot.hour && p.minute === slot.minute)) continue;
        if (await this.scheduledManager.isSlotNearScheduledNotification(slot.hour, slot.minute, 30))
          continue;

        picked.push(slot);
        found = true;
        break;
      }
      if (!found) break;
    }

    const smartAdded =
      picked.filter((p) => !p.isCatchup).length - initialSlots.filter((s) => !s.isCatchup).length;
    if (smartAdded < count - initialSlots.filter((s) => !s.isCatchup).length && count > 0) {
      await this.storageService.insertBackgroundLogAsync(
        'reminder',
        `Limited slots: Only planned ${smartAdded} additional smart reminders for ${date.toDateString()} (scores too low or no time left)`
      );
    }

    // Integrated Catch-up planning
    if (catchupLimit > 0) {
      const scores = await this.reminderAlgorithm.scoreReminderHours(
        minutesSoFar,
        target,
        startHour,
        startMin,
        picked,
        date.getTime()
      );

      let catchupAddedCount = 0;
      const initialCatchup = initialSlots.filter((s) => s.isCatchup).length;
      for (const slot of scores) {
        if (picked.filter((p) => p.isCatchup).length >= catchupLimit) break;
        if (slot.score < MIN_CATCHUP_SCORE_THRESHOLD) continue;
        // Local duplicate guard
        if (picked.some((p) => p.hour === slot.hour && p.minute === slot.minute)) continue;
        if (await this.scheduledManager.isSlotNearScheduledNotification(slot.hour, slot.minute, 30))
          continue;

        picked.push({ ...slot, isCatchup: true });
        catchupAddedCount++;
      }

      if (catchupAddedCount < catchupLimit) {
        await this.storageService.insertBackgroundLogAsync(
          'reminder',
          `Limited slots: Only planned ${catchupAddedCount}/${catchupLimit} catchup reminders for ${date.toDateString()}`
        );
      }
    }

    // Return ONLY the newly planned slots (filter out initialSlots)
    const newlyPlanned = picked.filter(
      (p) => !initialSlots.some((init) => init.hour === p.hour && init.minute === p.minute)
    );

    return newlyPlanned.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
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
      // 1. Cancel Native Alarms (chain is broken/ended for today)
      await SmartReminderModule.cancelAllReminders();
      // 2. Clear JS Queue (this will also cancel Expo Notifications for today)
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
          content: { title, body, categoryIdentifier: 'reminder', color: colors.grass },
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
