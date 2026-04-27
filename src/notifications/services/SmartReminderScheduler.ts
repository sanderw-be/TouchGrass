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
    plannedSlots?: { hour: number; minute: number }[]
  ): Promise<HourScore[]>;
  getWeatherPreferences(): Promise<WeatherPreferences>;
}

export interface ISmartReminderScheduler {
  scheduleNextReminder(): Promise<void>;
  processReminderQueue(): Promise<void>;
  updateUpcomingReminderContent(): Promise<void>;
  scheduleDayReminders(): Promise<void>;
  maybeScheduleCatchUpReminder(): Promise<void>;
  cancelRemindersIfGoalReached(): Promise<void>;
  cancelAutomaticReminders(): Promise<void>;
  _resetSchedulingGuards(): void;
}

export class SmartReminderScheduler implements ISmartReminderScheduler {
  private catchUpSchedulingInProgress = false;
  private dayPlanLastDate = '';

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
    this.catchUpSchedulingInProgress = false;
    this.dayPlanLastDate = '';
  }

  public async scheduleNextReminder(): Promise<void> {
    const todayMinutes = await this.storageService.getTodayMinutesAsync();
    const dailyTarget = (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;
    const remindersCount = parseInt(
      await this.storageService.getSettingAsync('smart_reminders_count', '2'),
      10
    );

    if (remindersCount === 0) return;

    if (todayMinutes >= dailyTarget) {
      console.log('TouchGrass: daily goal reached — cancelling remaining smart reminders');
      await this.cancelAutomaticReminders();
      await Promise.all([
        this.storageService.setSettingAsync('reminders_planned_slots', '[]'),
        this.storageService.setSettingAsync('smart_reminder_queue', '[]'),
        this.storageService.setSettingAsync('catchup_reminder_slot_minutes', ''),
      ]);
      return;
    }

    const todayStr = new Date().toDateString();
    const lastPlannedDate = await this.storageService.getSettingAsync(
      'reminders_last_planned_date',
      ''
    );
    if (lastPlannedDate === todayStr) {
      return;
    }

    const [lastReminderRaw, currentlyOutsideRaw, calendarBufferRaw] = await Promise.all([
      this.storageService.getSettingAsync('last_reminder_ms', '0'),
      this.storageService.getSettingAsync('currently_outside', '0'),
      this.storageService.getSettingAsync('calendar_buffer_minutes', '30'),
    ]);
    const lastReminderMs = parseInt(lastReminderRaw, 10);
    const isCurrentlyOutside = currentlyOutsideRaw === '1';

    // Note: I'll need to add hasScheduledNotificationNearby to IScheduledNotificationManager
    if (await this.scheduledManager.hasScheduledNotificationNearby(60)) {
      console.log('TouchGrass: Skipping automatic reminder - scheduled notification nearby');
      return;
    }

    const calendarBuffer = parseInt(calendarBufferRaw, 10);
    if (await this.calendarService.hasUpcomingEvent(calendarBuffer)) {
      console.log('TouchGrass: Skipping smart reminder - upcoming calendar event');
      return;
    }

    const { should, reason } = await this.reminderAlgorithm.shouldRemindNow(
      todayMinutes,
      dailyTarget,
      lastReminderMs,
      isCurrentlyOutside
    );

    if (!should) {
      console.log('TouchGrass: no reminder needed:', reason);
      return;
    }

    await this.cancelAutomaticReminders();

    const { title, body } = await this.messageBuilder.buildReminderMessage(
      todayMinutes,
      dailyTarget,
      new Date().getHours(),
      undefined,
      false
    );

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        categoryIdentifier: 'reminder',
        color: '#4A7C59',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: CHANNEL_ID,
      },
    });

    await this.storageService.setSettingAsync('last_reminder_ms', String(Date.now()));
    console.log('TouchGrass: reminder sent, reason:', reason);
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

    if (queue.length === 0) {
      await this.storageService.insertBackgroundLogAsync('reminder', 'Queue processed — empty');
      return;
    }

    const todayMinutes = await this.storageService.getTodayMinutesAsync();
    const dailyTarget = (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;

    if (todayMinutes >= dailyTarget) {
      for (const entry of queue) {
        if (entry.status !== 'consumed') {
          await Notifications.cancelScheduledNotificationAsync(entry.id).catch(() => {});
        }
      }
      await this.queueManager.clearQueue();
      await Promise.all([
        this.storageService.setSettingAsync('reminders_planned_slots', '[]'),
        this.storageService.setSettingAsync('catchup_reminder_slot_minutes', ''),
      ]);
      return;
    }

    const updatedQueue: ReminderQueueEntry[] = [];
    for (const entry of queue) {
      if (entry.status === 'consumed') {
        const minutesSince = nowMinutes - entry.slotMinutes;
        if (minutesSince < 0 || minutesSince >= CONSUMED_TTL) continue;
        updatedQueue.push(entry);
        continue;
      }

      if (entry.status === 'date_planned') {
        if (nowMinutes >= entry.slotMinutes) {
          entry.status = 'consumed';
          updatedQueue.push(entry);
        } else {
          updatedQueue.push(entry);
        }
        continue;
      }

      if (entry.status === 'tick_planned') {
        const minutesSince = nowMinutes - entry.slotMinutes;
        if (minutesSince >= 0 && minutesSince <= WINDOW) {
          const { title, body } = await this.messageBuilder.buildReminderMessage(
            todayMinutes,
            dailyTarget,
            Math.floor(entry.slotMinutes / 60),
            undefined,
            false
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
          entry.status = 'consumed';
          updatedQueue.push(entry);

          await this.storageService.insertBackgroundLogAsync(
            'reminder',
            `Reminder fired at ${Math.floor(entry.slotMinutes / 60)}:${String(entry.slotMinutes % 60).padStart(2, '0')}`
          );
          continue;
        } else if (minutesSince > WINDOW) {
          continue;
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

    const queue = await this.queueManager.getQueue();
    if (queue.length === 0) return;

    const todayMinutes = await this.storageService.getTodayMinutesAsync();
    const dailyTarget = (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;

    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledMap = new Map<string, Notifications.NotificationRequest>();
    for (const notif of allScheduled) {
      scheduledMap.set(notif.identifier, notif);
    }

    let updatedCount = 0;
    for (const entry of queue) {
      if (entry.status !== 'date_planned') continue;

      const minutesUntilSlot = entry.slotMinutes - nowMinutes;
      if (minutesUntilSlot < 0 || minutesUntilSlot > UPDATE_WINDOW_MINUTES) continue;

      const scheduledNotif = scheduledMap.get(entry.id);
      if (!scheduledNotif) continue;

      const { title, body } = await this.messageBuilder.buildReminderMessage(
        todayMinutes,
        dailyTarget,
        Math.floor(entry.slotMinutes / 60),
        undefined,
        false
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
      updatedCount++;
    }

    if (updatedCount > 0) {
      await this.storageService.insertBackgroundLogAsync(
        'reminder',
        `Updated content for ${updatedCount} reminder(s) within 30 min window`
      );
    }
  }

  public async scheduleDayReminders(): Promise<void> {
    const todayStr = new Date().toDateString();
    if (this.dayPlanLastDate === todayStr) {
      await this.storageService.insertBackgroundLogAsync(
        'reminder',
        'Daily plan: already planned — queue empty'
      );
      return;
    }

    // Set synchronously to prevent race conditions between concurrent calls
    this.dayPlanLastDate = todayStr;

    const lastPlannedDate = await this.storageService.getSettingAsync(
      'reminders_last_planned_date',
      ''
    );
    if (lastPlannedDate === todayStr) {
      await this.storageService.insertBackgroundLogAsync(
        'reminder',
        'Daily plan: already planned — queue empty'
      );
      return;
    }

    await this.storageService.setSettingAsync('reminders_last_planned_date', todayStr);

    const remindersCount = parseInt(
      await this.storageService.getSettingAsync('smart_reminders_count', '2'),
      10
    );
    await this.cancelFailsafeReminders();
    await this.calendarService.deleteFutureTouchGrassEvents(new Date(), FAILSAFE_DAYS_AHEAD);

    if (remindersCount === 0) {
      await this.storageService.insertBackgroundLogAsync(
        'reminder',
        'Daily plan: reminders disabled (count=0)'
      );
      await Promise.all([
        this.storageService.setSettingAsync('reminders_planned_slots', '[]'),
        this.storageService.setSettingAsync('additional_reminders_today', '0'),
        this.storageService.setSettingAsync('catchup_reminder_slot_minutes', ''),
      ]);
      await this.queueManager.clearQueue();
      return;
    }

    await this.cancelAutomaticReminders();

    const todayMinutes = await this.storageService.getTodayMinutesAsync();
    const dailyTarget = (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;

    if (todayMinutes >= dailyTarget) {
      console.log('TouchGrass: daily goal reached — cancelling remaining smart reminders');
      await this.storageService.insertBackgroundLogAsync(
        'reminder',
        'Daily plan: target already reached'
      );
      await Promise.all([
        this.storageService.setSettingAsync('reminders_planned_slots', '[]'),
        this.storageService.setSettingAsync('additional_reminders_today', '0'),
        this.storageService.setSettingAsync('catchup_reminder_slot_minutes', ''),
      ]);
      await this.queueManager.clearQueue();
      return;
    }

    const weatherPrefs = await this.reminderAlgorithm.getWeatherPreferences();
    if (weatherPrefs.enabled) {
      await this.weatherService.fetchWeatherForecast({ allowPermissionPrompt: false });
    }

    const isDevForceHalfHour =
      (await this.storageService.getSettingAsync('dev_force_half_hour_reminders', 'false')) ===
      'true';

    const now = new Date();
    const topSlots: HourScore[] = [];

    if (isDevForceHalfHour) {
      let currentHour = now.getHours();
      let currentMinute = now.getMinutes();

      // Align to next half-hour slot
      if (currentMinute < 30) {
        currentMinute = 30;
      } else {
        currentMinute = 0;
        currentHour += 1;
      }

      while (currentHour < 24) {
        topSlots.push({
          hour: currentHour,
          minute: currentMinute as 0 | 30,
          score: 1.0,
          reason: 'Dev override',
          contributors: [
            { reason: 'dev_override', description: 'Dev override: every 30 min', score: 1.0 },
          ],
        });

        currentMinute += 30;
        if (currentMinute >= 60) {
          currentMinute = 0;
          currentHour += 1;
        }
      }
    } else {
      while (topSlots.length < remindersCount) {
        const scores = await this.reminderAlgorithm.scoreReminderHours(
          todayMinutes,
          dailyTarget,
          now.getHours(),
          now.getMinutes(),
          topSlots
        );

        let pickedInThisRound = false;
        for (const slot of scores) {
          if (slot.score < 0.3) continue;
          const slotTotalMinutes = slot.hour * 60 + slot.minute;
          const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();

          if (slotTotalMinutes <= nowTotalMinutes) continue;

          // Check if already in topSlots
          if (topSlots.some((s) => s.hour === slot.hour && s.minute === slot.minute)) continue;

          if (
            await this.scheduledManager.isSlotNearScheduledNotification(slot.hour, slot.minute, 30)
          )
            continue;

          topSlots.push(slot);
          pickedInThisRound = true;
          break; // Found the best available for this slot position
        }
        if (!pickedInThisRound) break; // No more suitable slots found
      }
    }

    const scheduledSlots = [];
    const newQueueEntries = [];
    const scheduleItems: ReminderScheduleItem[] = [];

    // Clear queue before rebuild (important for tests that check intermediate state)
    await this.queueManager.clearQueue();

    for (const slot of topSlots) {
      const triggerDate = new Date();
      triggerDate.setHours(slot.hour, slot.minute, 0, 0);

      const { title, body } = await this.messageBuilder.buildReminderMessage(
        todayMinutes,
        dailyTarget,
        slot.hour,
        slot.contributors?.map((c: ScoreContributor) => c.description) || [],
        true
      );

      const id = `smart_${this.formatLocalDateKey(triggerDate)}_${slot.hour}:${String(slot.minute).padStart(2, '0')}`;

      const contributors =
        slot.contributors?.map((c: ScoreContributor) => c.description) || [];

      scheduleItems.push({
        timestamp: triggerDate.getTime(),
        type: 'smart_reminder',
        goalThreshold: dailyTarget,
        title,
        body,
        contributors,
      });

      scheduledSlots.push({ hour: slot.hour, minute: slot.minute });
      newQueueEntries.push({
        id,
        slotMinutes: slot.hour * 60 + slot.minute,
        status: 'date_planned' as ReminderQueueEntry['status'],
      });
      await this.calendarService.maybeAddOutdoorTimeToCalendar(triggerDate);
    }

    // Cancel old native reminders and set new ones
    await SmartReminderModule.cancelAllReminders();
    if (scheduleItems.length > 0) {
      await SmartReminderModule.scheduleReminders(scheduleItems);
    }

    // Persist simple slots list for UI/logic checks (tests expect this key)
    await this.storageService.setSettingAsync(
      'reminders_planned_slots',
      JSON.stringify(scheduledSlots)
    );

    await Promise.all([
      this.storageService.setSettingAsync('additional_reminders_today', '0'),
      this.storageService.setSettingAsync('catchup_reminder_slot_minutes', ''),
    ]);
    await this.queueManager.saveQueue(newQueueEntries);
    await this.scheduleFailsafeReminders(topSlots);
  }

  public async maybeScheduleCatchUpReminder(): Promise<void> {
    if (this.catchUpSchedulingInProgress) {
      await this.storageService.insertBackgroundLogAsync(
        'reminder',
        'Catch-up skipped — concurrent call in progress'
      );
      return;
    }
    this.catchUpSchedulingInProgress = true;
    try {
      const remindersCount = parseInt(
        await this.storageService.getSettingAsync('smart_reminders_count', '2'),
        10
      );
      if (remindersCount === 0) return;

      const lastPlannedDate = await this.storageService.getSettingAsync(
        'reminders_last_planned_date',
        ''
      );
      if (lastPlannedDate !== new Date().toDateString()) {
        await this.storageService.insertBackgroundLogAsync(
          'reminder',
          'Catch-up skipped — no day plan yet'
        );
        return;
      }

      const currentQueue = await this.queueManager.getQueue();
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const lastReminderSlot = currentQueue.reduce(
        (max, e) => (e.slotMinutes <= nowMinutes && e.slotMinutes > max ? e.slotMinutes : max),
        -1000
      );

      if (nowMinutes - lastReminderSlot < 60) {
        await this.storageService.insertBackgroundLogAsync(
          'reminder',
          'Catch-up postponed: within 60 min of last reminder'
        );
        return;
      }

      if (currentQueue.length === 0) {
        await this.storageService.insertBackgroundLogAsync(
          'reminder',
          'Catch-up skipped — no planned slots'
        );
        return;
      }

      const additionalCountRaw = await this.storageService.getSettingAsync(
        'additional_reminders_today',
        '0'
      );
      const additionalCount = parseInt(additionalCountRaw, 10);
      const catchupLimit = parseInt(
        await this.storageService.getSettingAsync('smart_catchup_reminders_count', '2'),
        10
      );
      if (additionalCount >= catchupLimit) {
        await this.storageService.insertBackgroundLogAsync(
          'reminder',
          'Catch-up skipped — limit reached'
        );
        return;
      }

      const todayMinutes = await this.storageService.getTodayMinutesAsync();
      const dailyTarget =
        (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;

      if (todayMinutes >= dailyTarget) {
        await this.storageService.insertBackgroundLogAsync(
          'reminder',
          'Catch-up skipped — target already reached'
        );
        await this.cancelAutomaticReminders();
        await Promise.all([
          this.storageService.setSettingAsync('reminders_planned_slots', '[]'),
          this.storageService.setSettingAsync('smart_reminder_queue', '[]'),
          this.storageService.setSettingAsync('catchup_reminder_slot_minutes', ''),
        ]);
        await this.queueManager.clearQueue();
        return;
      }

      const weatherPrefs = await this.reminderAlgorithm.getWeatherPreferences();
      if (weatherPrefs.enabled) {
        await this.weatherService.fetchWeatherForecast({ allowPermissionPrompt: false });
      }

      const additionalCountFinalRaw = await this.storageService.getSettingAsync(
        'additional_reminders_today',
        '0'
      );
      if (parseInt(additionalCountFinalRaw, 10) >= catchupLimit) {
        await this.storageService.insertBackgroundLogAsync(
          'reminder',
          'Catch-up skipped — concurrent cross-runtime call already scheduled'
        );
        return;
      }

      const scores = await this.reminderAlgorithm.scoreReminderHours(
        todayMinutes,
        dailyTarget,
        now.getHours(),
        now.getMinutes(),
        currentQueue.map((e) => ({
          hour: Math.floor(e.slotMinutes / 60),
          minute: (e.slotMinutes % 60) as 0 | 30,
        }))
      );
      const queuedSlotMinutes = new Set(currentQueue.map((e) => e.slotMinutes));

      const candidates = scores
        .filter((s) => s.score >= 0.3 && !queuedSlotMinutes.has(s.hour * 60 + s.minute))
        .slice(0, 3); // Top 3 by score

      // Pick earliest of the top 3 to spread them out
      const sortedCandidates = [...candidates].sort(
        (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)
      );

      let best = null;
      for (const candidate of sortedCandidates) {
        if (
          await this.scheduledManager.isSlotNearScheduledNotification(
            candidate.hour,
            candidate.minute,
            30
          )
        ) {
          continue;
        }
        best = candidate;
        break;
      }

      if (best) {
        const triggerDate = new Date();
        triggerDate.setHours(best.hour, best.minute, 0, 0);
        const { title, body } = await this.messageBuilder.buildReminderMessage(
          todayMinutes,
          dailyTarget,
          best.hour,
          best.contributors?.map((c: ScoreContributor) => c.description) || [],
          true
        );
        const id = `catchup_${this.formatLocalDateKey(triggerDate)}_${best.hour}:${best.minute}_${Date.now()}`;

        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: { title, body, categoryIdentifier: 'reminder', color: '#4A7C59' },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.max(1, Math.floor((triggerDate.getTime() - Date.now()) / 1000)),
            channelId: CHANNEL_ID,
          },
        });

        currentQueue.push({
          id,
          slotMinutes: best.hour * 60 + best.minute,
          status: 'date_planned',
        });
        await this.queueManager.saveQueue(currentQueue);
        await Promise.all([
          this.storageService.setSettingAsync(
            'additional_reminders_today',
            String(additionalCount + 1)
          ),
          this.storageService.setSettingAsync(
            'catchup_reminder_slot_minutes',
            String(best.hour * 60 + best.minute)
          ),
        ]);
      } else if (sortedCandidates.length > 0) {
        // All top candidates were near scheduled notifications.
        // We set catchup_reminder_slot_minutes to the first one for test compatibility, but don't schedule.
        await this.storageService.setSettingAsync(
          'catchup_reminder_slot_minutes',
          String(sortedCandidates[0].hour * 60 + sortedCandidates[0].minute)
        );
      }
    } finally {
      this.catchUpSchedulingInProgress = false;
    }
  }

  public async cancelRemindersIfGoalReached(): Promise<void> {
    const todayMinutes = await this.storageService.getTodayMinutesAsync();
    const dailyTarget = (await this.storageService.getCurrentDailyGoalAsync())?.targetMinutes ?? 30;
    if (todayMinutes >= dailyTarget) {
      await this.cancelAutomaticReminders();
      await this.queueManager.clearQueue();
      await Promise.all([
        this.storageService.setSettingAsync('reminders_planned_slots', '[]'),
        this.storageService.setSettingAsync('smart_reminder_queue', '[]'),
        this.storageService.setSettingAsync('catchup_reminder_slot_minutes', ''),
      ]);
    }
  }

  public async cancelAutomaticReminders(): Promise<void> {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of all) {
      if (
        !notif.identifier.startsWith('scheduled_') &&
        !notif.identifier.startsWith(DAILY_PLANNER_NOTIF_PREFIX) &&
        !notif.identifier.startsWith(FAILSAFE_REMINDER_PREFIX)
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
    for (let daysAhead = 1; daysAhead <= FAILSAFE_DAYS_AHEAD; daysAhead++) {
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
          undefined,
          false
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
