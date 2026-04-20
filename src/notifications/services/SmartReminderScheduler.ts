import * as Notifications from 'expo-notifications';
import {
  getTodayMinutesAsync,
  getCurrentDailyGoalAsync,
  getSettingAsync,
  setSettingAsync,
  insertBackgroundLogAsync,
} from '../../storage';
import { shouldRemindNow, scoreReminderHours, ScoreContributor } from '../reminderAlgorithm';
import { fetchWeatherForecast } from '../../weather/weatherService';
import { getWeatherPreferences } from '../../weather/weatherAlgorithm';
import {
  hasUpcomingEvent,
  maybeAddOutdoorTimeToCalendar,
  deleteFutureTouchGrassEvents,
} from '../../calendar/calendarService';
import { reminderMessageBuilder } from './ReminderMessageBuilder';
import { reminderQueueManager, ReminderQueueEntry } from './ReminderQueueManager';
import { scheduledNotificationManager } from './ScheduledNotificationManager';
import { CHANNEL_ID, DAILY_PLANNER_NOTIF_PREFIX } from './NotificationInfrastructureService';

export const FAILSAFE_REMINDER_PREFIX = 'failsafe_reminder_';
const FAILSAFE_DAYS_AHEAD = 3;

export class SmartReminderScheduler {
  private catchUpSchedulingInProgress = false;
  private dayPlanLastDate = '';

  /** Reset in-memory guards — only for testing. */
  public _resetSchedulingGuards(): void {
    this.catchUpSchedulingInProgress = false;
    this.dayPlanLastDate = '';
  }

  public async scheduleNextReminder(): Promise<void> {
    const todayMinutes = await getTodayMinutesAsync();
    const dailyTarget = (await getCurrentDailyGoalAsync())?.targetMinutes ?? 30;
    const remindersCount = parseInt(await getSettingAsync('smart_reminders_count', '2'), 10);

    if (remindersCount === 0) return;

    if (todayMinutes >= dailyTarget) {
      console.log('TouchGrass: daily goal reached — cancelling remaining smart reminders');
      await this.cancelAutomaticReminders();
      await Promise.all([
        setSettingAsync('reminders_planned_slots', '[]'),
        setSettingAsync('catchup_reminder_slot_minutes', ''),
      ]);
      return;
    }

    const todayStr = new Date().toDateString();
    const lastPlannedDate = await getSettingAsync('reminders_last_planned_date', '');
    if (lastPlannedDate === todayStr) {
      return;
    }

    const [lastReminderRaw, currentlyOutsideRaw, calendarBufferRaw] = await Promise.all([
      getSettingAsync('last_reminder_ms', '0'),
      getSettingAsync('currently_outside', '0'),
      getSettingAsync('calendar_buffer_minutes', '30'),
    ]);
    const lastReminderMs = parseInt(lastReminderRaw, 10);
    const isCurrentlyOutside = currentlyOutsideRaw === '1';

    if (await scheduledNotificationManager.hasScheduledNotificationNearby(60)) {
      console.log('TouchGrass: Skipping automatic reminder - scheduled notification nearby');
      return;
    }

    const calendarBuffer = parseInt(calendarBufferRaw, 10);
    if (await hasUpcomingEvent(calendarBuffer)) {
      console.log('TouchGrass: Skipping smart reminder - upcoming calendar event');
      return;
    }

    const { should, reason, contributors } = await shouldRemindNow(
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

    const { title, body } = await reminderMessageBuilder.buildReminderMessage(
      todayMinutes,
      dailyTarget,
      undefined,
      contributors,
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

    await setSettingAsync('last_reminder_ms', String(Date.now()));
    console.log('TouchGrass: reminder sent, reason:', reason);
  }

  public async processReminderQueue(): Promise<void> {
    const remindersCount = parseInt(await getSettingAsync('smart_reminders_count', '0'), 10);
    if (remindersCount === 0) return;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const WINDOW = 15;
    const CONSUMED_TTL = 60;

    let queue = await reminderQueueManager.getQueue();
    let consumedMarkedCount = 0;
    let consumedExpiredCount = 0;
    let tickFiredCount = 0;
    let tickDroppedCount = 0;

    {
      const snapshot =
        queue.length === 0
          ? 'empty'
          : queue.map((e) => reminderQueueManager.formatQueueEntry(e)).join(', ');
      console.log(`TouchGrass: [Queue] Tick snapshot (${queue.length}): ${snapshot}`);
    }

    if (queue.length === 0) {
      await insertBackgroundLogAsync('reminder', 'Queue processed — empty');
      return;
    }

    const todayMinutes = await getTodayMinutesAsync();
    const dailyTarget = (await getCurrentDailyGoalAsync())?.targetMinutes ?? 30;

    if (todayMinutes >= dailyTarget) {
      console.log(
        `TouchGrass: [Queue] Daily goal reached (${todayMinutes}/${dailyTarget} min) — cancelling ${queue.length} queued reminder(s)`
      );
      await insertBackgroundLogAsync(
        'reminder',
        `Goal reached (${todayMinutes}/${dailyTarget} min) — cancelled ${queue.length} reminder(s)`
      );
      for (const entry of queue) {
        if (entry.status !== 'consumed') {
          await Notifications.cancelScheduledNotificationAsync(entry.id).catch(() => {});
        }
        console.log(
          `TouchGrass: [Queue] Deleted: ${entry.id} at ${reminderQueueManager.formatSlotMinutes(entry.slotMinutes)} [${entry.status}] (goal reached)`
        );
      }
      await reminderQueueManager.saveQueue([]);
      await Promise.all([
        setSettingAsync('reminders_planned_slots', '[]'),
        setSettingAsync('catchup_reminder_slot_minutes', ''),
      ]);
      return;
    }

    const updatedQueue: ReminderQueueEntry[] = [];
    for (const entry of queue) {
      if (entry.status === 'consumed') {
        const minutesSince = nowMinutes - entry.slotMinutes;
        if (minutesSince < 0 || minutesSince >= CONSUMED_TTL) {
          console.log(
            `TouchGrass: [Queue] Deleted: ${entry.id} at ${reminderQueueManager.formatSlotMinutes(entry.slotMinutes)} — consumed TTL expired`
          );
          consumedExpiredCount++;
          continue;
        }
        updatedQueue.push(entry);
        continue;
      }

      if (entry.status === 'date_planned') {
        if (nowMinutes >= entry.slotMinutes) {
          entry.status = 'consumed';
          console.log(
            `TouchGrass: [Queue] Consumed: ${entry.id} at ${reminderQueueManager.formatSlotMinutes(entry.slotMinutes)} — slot passed, marked consumed`
          );
          await insertBackgroundLogAsync(
            'reminder',
            `Reminder fired at ${reminderQueueManager.formatSlotMinutes(entry.slotMinutes)}`
          );
          consumedMarkedCount++;
          updatedQueue.push(entry);
        } else {
          updatedQueue.push(entry);
        }
        continue;
      }

      if (entry.status === 'tick_planned') {
        const minutesSince = nowMinutes - entry.slotMinutes;
        if (minutesSince >= 0 && minutesSince <= WINDOW) {
          const { title, body } = await reminderMessageBuilder.buildReminderMessage(
            todayMinutes,
            dailyTarget,
            Math.floor(entry.slotMinutes / 60),
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
          await setSettingAsync('last_reminder_ms', String(Date.now()));
          console.log(
            `TouchGrass: [Queue] Consumed: ${entry.id} at ${reminderQueueManager.formatSlotMinutes(entry.slotMinutes)} — fired via JS (${minutesSince} min since slot)`
          );
          await insertBackgroundLogAsync(
            'reminder',
            `Reminder fired at ${reminderQueueManager.formatSlotMinutes(entry.slotMinutes)}`
          );
          tickFiredCount++;
          entry.status = 'consumed';
          updatedQueue.push(entry);
          continue;
        } else if (minutesSince > WINDOW) {
          console.log(
            `TouchGrass: [Queue] Deleted: ${entry.id} at ${reminderQueueManager.formatSlotMinutes(entry.slotMinutes)} — stale tick_planned (${minutesSince} min since slot)`
          );
          tickDroppedCount++;
          continue;
        }
        updatedQueue.push(entry);
        continue;
      }

      updatedQueue.push(entry);
    }

    await reminderQueueManager.saveQueue(updatedQueue);

    {
      const remaining =
        updatedQueue.length === 0
          ? 'empty'
          : updatedQueue
              .map((e) => `${reminderQueueManager.formatSlotMinutes(e.slotMinutes)}[${e.status}]`)
              .join(', ');
      console.log(`TouchGrass: [Queue] After processing (${updatedQueue.length}): ${remaining}`);
    }

    await insertBackgroundLogAsync(
      'reminder',
      `Queue processed — remaining ${updatedQueue.length} (consumed:${consumedMarkedCount}, fired:${tickFiredCount}, dropped:${consumedExpiredCount + tickDroppedCount})`
    );
  }

  public async updateUpcomingReminderContent(): Promise<void> {
    const remindersCount = parseInt(await getSettingAsync('smart_reminders_count', '0'), 10);
    if (remindersCount === 0) return;

    const UPDATE_WINDOW_MINUTES = 30;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const queue = await reminderQueueManager.getQueue();
    if (queue.length === 0) return;

    const todayMinutes = await getTodayMinutesAsync();
    const dailyTarget = (await getCurrentDailyGoalAsync())?.targetMinutes ?? 30;

    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();

    const scheduledMap = new Map<
      string,
      { trigger: Notifications.NotificationTrigger; content: Notifications.NotificationContent }
    >();
    for (const notif of allScheduled) {
      scheduledMap.set(notif.identifier, {
        trigger: notif.trigger,
        content: notif.content,
      });
    }

    let updatedCount = 0;

    for (const entry of queue) {
      if (entry.status !== 'date_planned') continue;

      const minutesUntilSlot = entry.slotMinutes - nowMinutes;
      if (minutesUntilSlot < 0 || minutesUntilSlot > UPDATE_WINDOW_MINUTES) {
        continue;
      }

      const scheduledNotif = scheduledMap.get(entry.id);
      if (!scheduledNotif) {
        console.log(
          `TouchGrass: [UpdateContent] Skipping ${entry.id} at ${reminderQueueManager.formatSlotMinutes(entry.slotMinutes)} — not found in scheduled notifications`
        );
        continue;
      }

      const slotHour = Math.floor(entry.slotMinutes / 60);

      const { title, body } = await reminderMessageBuilder.buildReminderMessage(
        todayMinutes,
        dailyTarget,
        slotHour,
        undefined,
        false
      );

      const currentBody = scheduledNotif.content.body;
      if (currentBody === body) {
        continue;
      }

      await Notifications.cancelScheduledNotificationAsync(entry.id);

      const triggerDate = new Date();
      triggerDate.setHours(slotHour, entry.slotMinutes % 60, 0, 0);
      const secondsUntilTrigger = Math.max(
        1,
        Math.floor((triggerDate.getTime() - Date.now()) / 1000)
      );

      await Notifications.scheduleNotificationAsync({
        identifier: entry.id,
        content: {
          title,
          body,
          categoryIdentifier: 'reminder',
          color: '#4A7C59',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntilTrigger,
          channelId: CHANNEL_ID,
        },
      });

      updatedCount++;
      console.log(
        `TouchGrass: [UpdateContent] Updated ${entry.id} at ${reminderQueueManager.formatSlotMinutes(entry.slotMinutes)} (${minutesUntilSlot} min away) — new content: "${title}" / "${body}"`
      );
    }

    if (updatedCount > 0) {
      console.log(
        `TouchGrass: [UpdateContent] Updated ${updatedCount} notification(s) with fresh data`
      );
      await insertBackgroundLogAsync(
        'reminder',
        `Updated content for ${updatedCount} reminder(s) within 30 min window`
      );
    }
  }

  public async scheduleDayReminders(): Promise<void> {
    const todayStr = new Date().toDateString();

    if (this.dayPlanLastDate === todayStr) {
      const queue = await reminderQueueManager.getQueue();
      if (queue.length > 0) {
        const summary = queue
          .map((e) => `${reminderQueueManager.formatSlotMinutes(e.slotMinutes)}[${e.status}]`)
          .join(', ');
        console.log(
          `TouchGrass: [DayPlan] Already planned today — queue (${queue.length}): ${summary}`
        );
        await insertBackgroundLogAsync(
          'reminder',
          `Daily plan: already planned (${queue.length}) — ${summary}`
        );
      } else {
        console.log('TouchGrass: [DayPlan] Already planned today — queue: empty');
        await insertBackgroundLogAsync('reminder', 'Daily plan: already planned — queue empty');
      }
      return;
    }
    this.dayPlanLastDate = todayStr;

    const lastPlannedDate = await getSettingAsync('reminders_last_planned_date', '');
    if (lastPlannedDate === todayStr) {
      const queue = await reminderQueueManager.getQueue();
      if (queue.length > 0) {
        const summary = queue
          .map((e) => `${reminderQueueManager.formatSlotMinutes(e.slotMinutes)}[${e.status}]`)
          .join(', ');
        console.log(
          `TouchGrass: [DayPlan] Already planned today — queue (${queue.length}): ${summary}`
        );
        await insertBackgroundLogAsync(
          'reminder',
          `Daily plan: already planned (${queue.length}) — ${summary}`
        );
      } else {
        console.log('TouchGrass: [DayPlan] Already planned today — queue: empty');
        await insertBackgroundLogAsync('reminder', 'Daily plan: already planned — queue empty');
      }
      return;
    }

    await setSettingAsync('reminders_last_planned_date', todayStr);

    const remindersCount = parseInt(await getSettingAsync('smart_reminders_count', '2'), 10);

    await this.cancelFailsafeReminders();

    deleteFutureTouchGrassEvents(new Date(), FAILSAFE_DAYS_AHEAD).catch((e) =>
      console.warn('TouchGrass: Failed to delete stale failsafe calendar events:', e)
    );

    if (remindersCount === 0) {
      console.log('TouchGrass: [DayPlan] Reminders disabled (count=0) — skipping day planning');
      await Promise.all([
        setSettingAsync('reminders_planned_slots', '[]'),
        setSettingAsync('additional_reminders_today', '0'),
        setSettingAsync('catchup_reminder_slot_minutes', ''),
      ]);
      await insertBackgroundLogAsync('reminder', 'Daily plan: reminders disabled (count=0)');
      return;
    }

    await this.cancelAutomaticReminders();

    const todayMinutes = await getTodayMinutesAsync();
    const dailyTarget = (await getCurrentDailyGoalAsync())?.targetMinutes ?? 30;

    if (todayMinutes >= dailyTarget) {
      console.log(
        `TouchGrass: [DayPlan] Daily goal already reached (${todayMinutes}/${dailyTarget} min) — skipping reminder planning`
      );
      await Promise.all([
        setSettingAsync('reminders_planned_slots', '[]'),
        setSettingAsync('additional_reminders_today', '0'),
        setSettingAsync('catchup_reminder_slot_minutes', ''),
      ]);
      await insertBackgroundLogAsync(
        'reminder',
        `Daily plan: goal reached (${todayMinutes}/${dailyTarget} min) — skipping`
      );
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const weatherPrefs = await getWeatherPreferences();
    if (weatherPrefs.enabled) {
      await fetchWeatherForecast({ allowPermissionPrompt: false });
    }

    const seenSlots = new Set<string>();
    const topSlots: { hour: number; minute: 0 | 30; contributors: ScoreContributor[] }[] = [];
    const currentSlotMinutes = currentHour * 60 + currentMinute;

    while (topSlots.length < remindersCount) {
      const scores = await scoreReminderHours(
        todayMinutes,
        dailyTarget,
        currentHour,
        currentMinute,
        topSlots as { hour: number; minute: 0 | 30 }[]
      );

      let picked = false;
      for (const slot of scores) {
        if (slot.score < 0.4) continue;
        const slotMinutes = slot.hour * 60 + slot.minute;
        if (slotMinutes <= currentSlotMinutes) continue;

        const slotKey = `${slot.hour}:${slot.minute}`;
        if (seenSlots.has(slotKey)) continue;

        if (
          await scheduledNotificationManager.isSlotNearScheduledNotification(
            slot.hour,
            slot.minute,
            30
          )
        ) {
          console.log(
            `TouchGrass: Skipping reminder at ${slot.hour}:${slot.minute.toString().padStart(2, '0')} - scheduled notification nearby`
          );
          continue;
        }

        seenSlots.add(slotKey);
        topSlots.push({
          hour: slot.hour,
          minute: slot.minute as 0 | 30,
          contributors: slot.contributors ?? [],
        });
        picked = true;
        break;
      }

      if (!picked) break;
    }

    const scheduledSlots: { hour: number; minute: number }[] = [];
    await reminderQueueManager.saveQueue([]);
    const newQueueEntries: ReminderQueueEntry[] = [];

    for (const slot of topSlots) {
      const triggerDate = new Date();
      triggerDate.setHours(slot.hour, slot.minute, 0, 0);

      const { title, body } = await reminderMessageBuilder.buildReminderMessage(
        todayMinutes,
        dailyTarget,
        slot.hour,
        slot.contributors,
        false
      );

      const dateKey = this.formatLocalDateKey(triggerDate);
      const id = `smart_${dateKey}_${slot.hour}:${String(slot.minute).padStart(2, '0')}`;

      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title,
          body,
          categoryIdentifier: 'reminder',
          color: '#4A7C59',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.floor((triggerDate.getTime() - Date.now()) / 1000)),
          channelId: CHANNEL_ID,
        },
      });

      scheduledSlots.push({ hour: slot.hour, minute: slot.minute });
      newQueueEntries.push({
        id,
        slotMinutes: slot.hour * 60 + slot.minute,
        status: 'date_planned',
      });

      console.log(
        `TouchGrass: [DayPlan] Scheduled: ${id} at ${reminderQueueManager.formatSlotMinutes(slot.hour * 60 + slot.minute)} (date_planned)`
      );

      maybeAddOutdoorTimeToCalendar(triggerDate).catch((e) =>
        console.warn('TouchGrass: Failed to add reminder slot to calendar:', e)
      );
    }

    await Promise.all([
      setSettingAsync('reminders_planned_slots', JSON.stringify(scheduledSlots)),
      setSettingAsync('additional_reminders_today', '0'),
      setSettingAsync('catchup_reminder_slot_minutes', ''),
    ]);
    await reminderQueueManager.saveQueue(newQueueEntries);

    if (newQueueEntries.length > 0) {
      const summary = newQueueEntries
        .map((e) => reminderQueueManager.formatSlotMinutes(e.slotMinutes))
        .join(', ');
      console.log(
        `TouchGrass: [DayPlan] Planned ${newQueueEntries.length} reminder(s) for today: ${summary}`
      );
      await insertBackgroundLogAsync('reminder', `Daily plan: ${summary}`);
    } else {
      console.log('TouchGrass: [DayPlan] No suitable reminder slots found for today');
      await insertBackgroundLogAsync('reminder', 'Daily plan: no suitable slots found');
    }

    await this.scheduleFailsafeReminders(topSlots);
  }

  public async maybeScheduleCatchUpReminder(): Promise<void> {
    if (this.catchUpSchedulingInProgress) {
      await insertBackgroundLogAsync('reminder', 'Catch-up skipped — concurrent call in progress');
      return;
    }
    this.catchUpSchedulingInProgress = true;
    try {
      const [remindersCountRaw, lastPlannedDate, additionalCountRaw, catchupLimitRaw] =
        await Promise.all([
          getSettingAsync('smart_reminders_count', '2'),
          getSettingAsync('reminders_last_planned_date', ''),
          getSettingAsync('additional_reminders_today', '0'),
          getSettingAsync('smart_catchup_reminders_count', '2'),
        ]);

      const remindersCount = parseInt(remindersCountRaw, 10);
      if (remindersCount === 0) return;

      const todayStr = new Date().toDateString();
      if (lastPlannedDate !== todayStr) {
        await insertBackgroundLogAsync('reminder', 'Catch-up skipped — no day plan yet');
        return;
      }

      const additionalCount = parseInt(additionalCountRaw, 10);
      const catchupLimit = parseInt(catchupLimitRaw, 10);
      if (additionalCount >= catchupLimit) {
        console.log(
          `TouchGrass: [CatchUp] Limit reached (${additionalCount}/${catchupLimit}) — skipping`
        );
        await insertBackgroundLogAsync(
          'reminder',
          `Catch-up skipped — limit reached (${additionalCount}/${catchupLimit})`
        );
        return;
      }

      let plannedSlots: { hour: number; minute: number }[] = [];
      try {
        plannedSlots = JSON.parse(await getSettingAsync('reminders_planned_slots', '[]'));
      } catch {
        return;
      }
      if (plannedSlots.length === 0) {
        console.log('TouchGrass: [CatchUp] No planned slots for today — skipping');
        await insertBackgroundLogAsync('reminder', 'Catch-up skipped — no planned slots');
        return;
      }

      const now = new Date();
      const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

      const passedCount = plannedSlots.filter(
        (s) => s.hour * 60 + s.minute <= currentMinutesOfDay
      ).length;
      if (passedCount === 0) {
        await insertBackgroundLogAsync(
          'reminder',
          'Catch-up skipped — no reminders have fired yet'
        );
        return;
      }

      const queue = await reminderQueueManager.getQueue();

      const lastConsumedMin = queue
        .filter((e) => e.status === 'consumed')
        .map((e) => e.slotMinutes)
        .filter((m) => m <= currentMinutesOfDay)
        .reduce((max, m) => Math.max(max, m), -1);

      const mostRecentPassedSlotMin = plannedSlots
        .map((s) => s.hour * 60 + s.minute)
        .filter((m) => m <= currentMinutesOfDay)
        .reduce((max, m) => Math.max(max, m), -1);

      const lastReminderMin = Math.max(lastConsumedMin, mostRecentPassedSlotMin);

      if (lastReminderMin >= 0 && currentMinutesOfDay - lastReminderMin < 60) {
        console.log('TouchGrass: [CatchUp] Postponed — waiting 60 min after last planned reminder');
        await insertBackgroundLogAsync(
          'reminder',
          `Catch-up postponed — last reminder ${currentMinutesOfDay - lastReminderMin} min ago`
        );
        return;
      }

      const passedPercent = passedCount / remindersCount;

      const todayMinutes = await getTodayMinutesAsync();
      const dailyTarget = (await getCurrentDailyGoalAsync())?.targetMinutes ?? 30;
      const targetPercent = Math.min(todayMinutes / dailyTarget, 1);

      if (targetPercent >= 1) {
        console.log(
          `TouchGrass: [CatchUp] Daily goal reached (${todayMinutes}/${dailyTarget} min) — cancelling remaining smart reminders`
        );
        await this.cancelAutomaticReminders();
        await Promise.all([
          setSettingAsync('reminders_planned_slots', '[]'),
          setSettingAsync('catchup_reminder_slot_minutes', ''),
        ]);
        await insertBackgroundLogAsync(
          'reminder',
          `Catch-up skipped — goal reached (${todayMinutes}/${dailyTarget} min)`
        );
        return;
      }

      if (passedPercent <= targetPercent) {
        console.log(
          `TouchGrass: [CatchUp] On track — ${Math.round(targetPercent * 100)}% of goal reached vs ${Math.round(passedPercent * 100)}% of reminders passed — skipping`
        );
        await insertBackgroundLogAsync(
          'reminder',
          `Catch-up skipped — on track (${Math.round(targetPercent * 100)}% goal vs ${Math.round(
            passedPercent * 100
          )}% reminders passed)`
        );
        return;
      }

      const weatherPrefs = await getWeatherPreferences();
      if (weatherPrefs.enabled) {
        await fetchWeatherForecast({ allowPermissionPrompt: false });
      }
      const scores = await scoreReminderHours(
        todayMinutes,
        dailyTarget,
        now.getHours(),
        now.getMinutes()
      );

      const queuedSlotMinutes = new Set(queue.map((e) => e.slotMinutes));

      const candidateSlots: typeof scores = [];
      for (const s of scores) {
        const slotMin = s.hour * 60 + s.minute;
        if (
          slotMin > currentMinutesOfDay &&
          s.score >= 0.3 &&
          !(await scheduledNotificationManager.isSlotNearScheduledNotification(
            s.hour,
            s.minute,
            30
          )) &&
          !queuedSlotMinutes.has(slotMin)
        ) {
          candidateSlots.push(s);
        }
      }

      if (candidateSlots.length === 0) {
        console.log('TouchGrass: [CatchUp] No suitable future slots found — skipping');
        await insertBackgroundLogAsync('reminder', 'Catch-up skipped — no suitable future slots');
        return;
      }

      const remainingCatchups = catchupLimit - additionalCount;
      const topCandidates = candidateSlots.slice(0, remainingCatchups);
      const best = topCandidates.reduce((earliest, s) =>
        s.hour * 60 + s.minute < earliest.hour * 60 + earliest.minute ? s : earliest
      );
      const triggerDate = new Date();
      triggerDate.setHours(best.hour, best.minute, 0, 0);

      const { title, body } = await reminderMessageBuilder.buildReminderMessage(
        todayMinutes,
        dailyTarget,
        best.hour,
        best.contributors ?? [],
        true
      );

      const dateKey = this.formatLocalDateKey(triggerDate);
      const id = `catchup_${dateKey}_${best.hour}:${String(best.minute).padStart(2, '0')}_${Date.now()}`;

      const freshAdditionalCount = parseInt(
        await getSettingAsync('additional_reminders_today', '0'),
        10
      );
      if (freshAdditionalCount >= catchupLimit) {
        await insertBackgroundLogAsync(
          'reminder',
          `Catch-up skipped — concurrent cross-runtime call already scheduled (${freshAdditionalCount}/${catchupLimit})`
        );
        return;
      }

      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title,
          body,
          categoryIdentifier: 'reminder',
          color: '#4A7C59',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.floor((triggerDate.getTime() - Date.now()) / 1000)),
          channelId: CHANNEL_ID,
        },
      });

      queue.push({
        id,
        slotMinutes: best.hour * 60 + best.minute,
        status: 'date_planned',
      });
      await reminderQueueManager.saveQueue(queue);

      await Promise.all([
        setSettingAsync('additional_reminders_today', String(additionalCount + 1)),
        setSettingAsync('catchup_reminder_slot_minutes', String(best.hour * 60 + best.minute)),
      ]);
      console.log(
        `TouchGrass: [CatchUp] Scheduled: ${id} at ${reminderQueueManager.formatSlotMinutes(best.hour * 60 + best.minute)} ` +
          `(${additionalCount + 1}/${catchupLimit}; progress: ${todayMinutes}/${dailyTarget} min)`
      );
      await insertBackgroundLogAsync(
        'reminder',
        `Catch-up planned at ${reminderQueueManager.formatSlotMinutes(best.hour * 60 + best.minute)} (${todayMinutes}/${dailyTarget} min reached)`
      );
    } finally {
      this.catchUpSchedulingInProgress = false;
    }
  }

  public async cancelRemindersIfGoalReached(): Promise<void> {
    const remindersCount = parseInt(await getSettingAsync('smart_reminders_count', '0'), 10);
    if (remindersCount === 0) return;

    const todayMinutes = await getTodayMinutesAsync();
    const dailyTarget = (await getCurrentDailyGoalAsync())?.targetMinutes ?? 30;
    if (todayMinutes < dailyTarget) return;

    console.log(
      `TouchGrass: Goal reached (${todayMinutes}/${dailyTarget} min) after user action — cancelling reminders`
    );

    await this.cancelAutomaticReminders();

    const queue = await reminderQueueManager.getQueue();
    for (const entry of queue) {
      if (entry.status !== 'consumed') {
        await Notifications.cancelScheduledNotificationAsync(entry.id).catch(() => {});
      }
    }
    await reminderQueueManager.saveQueue([]);
    await Promise.all([
      setSettingAsync('reminders_planned_slots', '[]'),
      setSettingAsync('catchup_reminder_slot_minutes', ''),
    ]);
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

  // ---------------------------------------------------------------------------
  // Failsafe Reminders
  // ---------------------------------------------------------------------------

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
    slots: { hour: number; minute: 0 | 30 }[]
  ): Promise<void> {
    if (slots.length === 0) return;

    const dailyTarget = (await getCurrentDailyGoalAsync())?.targetMinutes ?? 30;

    for (let daysAhead = 1; daysAhead <= FAILSAFE_DAYS_AHEAD; daysAhead++) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      const dateKey = this.formatLocalDateKey(futureDate);

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const triggerDate = new Date(futureDate);
        triggerDate.setHours(slot.hour, slot.minute, 0, 0);

        const { title, body } = await reminderMessageBuilder.buildReminderMessage(
          0,
          dailyTarget,
          slot.hour,
          undefined,
          false
        );

        await Notifications.scheduleNotificationAsync({
          identifier: `${FAILSAFE_REMINDER_PREFIX}${dateKey}_${i}`,
          content: {
            title,
            body,
            categoryIdentifier: 'reminder',
            color: '#4A7C59',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: CHANNEL_ID,
          },
        });

        maybeAddOutdoorTimeToCalendar(triggerDate).catch((e) =>
          console.warn('TouchGrass: Failed to add reminder slot to calendar:', e)
        );
      }
    }

    console.log(
      `TouchGrass: Failsafe reminders pre-scheduled for next ${FAILSAFE_DAYS_AHEAD} days`
    );
  }
}

export const smartReminderScheduler = new SmartReminderScheduler();
