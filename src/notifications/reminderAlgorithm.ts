import { getReminderFeedback, getSessionsForRange, startOfDay, startOfWeek } from '../storage/database';
import { getWeatherForHour } from '../weather/weatherService';
import { scoreWeatherCondition, getWeatherPreferences, getWeatherDescription, getWeatherEmoji } from '../weather/weatherAlgorithm';
import { t } from '../i18n';

// Active hours: 7:00 – 22:30 (slots at :00 and :30)
const SLOT_START_MINUTES = 7 * 60;  // 7:00
const SLOT_END_MINUTES = 23 * 60;   // exclusive end, last slot is 22:30
const SLOT_STEP = 30;

// Proximity: slots ≥ 3 hours from a planned reminder are unaffected (multiplier 1.0);
// closer slots are penalised linearly down to 0.0 at the same slot.
const PROXIMITY_FULL_MINUTES = 180; // 3 hours → multiplier = 1.0

// Maximum random jitter applied to each slot score to help escape local optima.
const MAX_JITTER = 0.05;

export interface ScoreContributor {
  reason: string;
  score: number;
  description: string;
}

export interface HourScore {
  hour: number;
  minute: 0 | 30;
  score: number;
  reason: string;
  contributors: ScoreContributor[];
}

/**
 * Score each half-hour slot of the day for how good a time it is to send a reminder.
 * Higher score = better time to remind.
 * Returns scores for all 48 half-hour slots (7:00–22:30), sorted best first.
 *
 * @param currentHour - Current hour of day (used to skip past slots)
 * @param currentMinute - Current minute of day (default 0); combined with currentHour to skip past slots
 * @param plannedSlots - Already-selected reminder slots for today; nearby slots are penalised
 */
export function scoreReminderHours(
  todayMinutes: number,
  dailyTargetMinutes: number,
  currentHour: number,
  currentMinute: number = 0,
  plannedSlots: Array<{ hour: number; minute: 0 | 30 }> = [],
): HourScore[] {
  const feedback = getReminderFeedback();
  const scores: HourScore[] = [];
  const currentSlotMinutes = currentHour * 60 + currentMinute;

  // How urgent is the reminder? Grows as day progresses without hitting goal
  const progressRatio = Math.min(todayMinutes / dailyTargetMinutes, 1);
  const dayProgressRatio = currentHour / 21; // normalize to end of reasonable day (9pm)
  const urgency = Math.max(0, dayProgressRatio - progressRatio); // 0 = no urgency, 1 = very urgent

  for (let slotMinutes = SLOT_START_MINUTES; slotMinutes < SLOT_END_MINUTES; slotMinutes += SLOT_STEP) {
    const hour = Math.floor(slotMinutes / 60);
    const minute = (slotMinutes % 60) as 0 | 30;

    // Skip past slots (strictly less than: current slot itself is included)
    if (slotMinutes < currentSlotMinutes) {
      scores.push({ hour, minute, score: 0, reason: 'already passed', contributors: [] });
      continue;
    }

    let score = 0.5; // baseline
    const reasons: string[] = [];
    const contributors: ScoreContributor[] = [];

    // ── Historical pattern boost ──────────────────────────
    // Did you go outside around this hour in the past?
    const outsideAtHour = countOutsideSessionsAtHour(hour);
    if (outsideAtHour > 0) {
      const patternBoost = Math.min(outsideAtHour * 0.1, 0.3);
      score += patternBoost;
      reasons.push(`pattern +${patternBoost.toFixed(2)}`);
      contributors.push({ reason: 'pattern', score: patternBoost, description: t('notif_reason_pattern') });
    }

    // ── Feedback penalties and bonuses ───────────────────
    // Feedback is keyed by half-hour slot (hour + minute) for precise per-slot scoring
    const slotFeedback = feedback.filter((f) => f.scheduledHour === hour && (f.scheduledMinute ?? 0) === minute);

    const snoozeCount = slotFeedback.filter((f) => f.action === 'snoozed').length;
    const dismissCount = slotFeedback.filter((f) => f.action === 'dismissed').length;
    const actedCount = slotFeedback.filter((f) => f.action === 'went_outside').length;
    const lessCount = slotFeedback.filter((f) => f.action === 'less_often').length;
    const moreCount = slotFeedback.filter((f) => f.action === 'more_often').length;
    const badTimeCount = slotFeedback.filter((f) => f.action === 'bad_time').length;

    if (snoozeCount > 0) {
      const penalty = Math.min(snoozeCount * 0.08, 0.25);
      score -= penalty;
      reasons.push(`snoozed -${penalty.toFixed(2)}`);
    }

    if (dismissCount > 0) {
      const penalty = Math.min(dismissCount * 0.12, 0.30);
      score -= penalty;
      reasons.push(`dismissed -${penalty.toFixed(2)}`);
    }

    if (actedCount > 0) {
      const bonus = Math.min(actedCount * 0.15, 0.35);
      score += bonus;
      reasons.push(`acted +${bonus.toFixed(2)}`);
      contributors.push({ reason: 'acted', score: bonus, description: t('notif_reason_acted') });
    }

    if (lessCount > 0) {
      const penalty = Math.min(lessCount * 0.15, 0.40);
      score -= penalty;
      reasons.push(`less_often -${penalty.toFixed(2)}`);
    }

    if (moreCount > 0) {
      const bonus = Math.min(moreCount * 0.15, 0.35);
      score += bonus;
      reasons.push(`more_often +${bonus.toFixed(2)}`);
      contributors.push({ reason: 'more_often', score: bonus, description: t('notif_reason_more_often') });
    }

    if (badTimeCount > 0) {
      // "Bad time" is an explicit, deliberate signal — apply a larger and
      // long-lasting penalty so the algorithm avoids this slot in the future.
      const penalty = Math.min(badTimeCount * 0.30, 0.70);
      score -= penalty;
      reasons.push(`bad_time -${penalty.toFixed(2)}`);
    }

    // ── Urgency boost ─────────────────────────────────────
    // Closer to end of day with goal unmet = higher urgency
    const hoursLeft = 21 - hour; // hours until 9pm
    if (urgency > 0.3 && hoursLeft <= 4) {
      const urgencyBoost = urgency * 0.3;
      score += urgencyBoost;
      reasons.push(`urgent +${urgencyBoost.toFixed(2)}`);
      contributors.push({ reason: 'urgent', score: urgencyBoost, description: t('notif_reason_urgent') });
    }

    // ── Prime outdoor hours bonus ─────────────────────────
    // Lunch (12-13) and after work (17-19) are naturally good times
    if (hour === 12 || hour === 13) {
      score += 0.1;
      reasons.push('lunch +0.10');
      contributors.push({ reason: 'lunch', score: 0.1, description: t('notif_reason_lunch') });
    }
    if (hour >= 17 && hour <= 19) {
      score += 0.15;
      reasons.push('after-work +0.15');
      contributors.push({ reason: 'after_work', score: 0.15, description: t('notif_reason_after_work') });
    }

    // ── Weather score ─────────────────────────────────────
    // Add weather-based scoring if weather data is available
    const weatherPrefs = getWeatherPreferences();
    if (weatherPrefs.enabled) {
      const weather = getWeatherForHour(hour);
      if (weather) {
        const weatherScore = scoreWeatherCondition(weather, weatherPrefs);
        if (weatherScore !== 0) {
          score += weatherScore;
          reasons.push(`weather ${weatherScore > 0 ? '+' : ''}${weatherScore.toFixed(2)}`);
        }
        if (weatherScore > 0) {
          const emoji = getWeatherEmoji(weather);
          const temp = Math.round(weather.temperature);
          const desc = getWeatherDescription(weather);
          contributors.push({ reason: 'weather', score: weatherScore, description: `${emoji} ${desc}, ${temp}°C` });
        }
      }
    }

    // ── Proximity penalty ─────────────────────────────────
    // Penalise slots that are close to an already-planned reminder so that
    // reminders are spread out across the day. A slot within 3 hours of a
    // planned slot gets a multiplier that scales linearly from 0.0 (same slot)
    // to 1.0 (≥ 3 hours away). When there are multiple planned slots the most
    // restrictive (smallest) multiplier is used.
    if (plannedSlots.length > 0) {
      let minMultiplier = 1.0;
      for (const planned of plannedSlots) {
        const plannedMinutes = planned.hour * 60 + planned.minute;
        const distanceMinutes = Math.abs(slotMinutes - plannedMinutes);
        const multiplier = Math.min(distanceMinutes / PROXIMITY_FULL_MINUTES, 1.0);
        if (multiplier < minMultiplier) {
          minMultiplier = multiplier;
        }
      }
      if (minMultiplier < 1.0) {
        score *= minMultiplier;
        reasons.push(`proximity ×${minMultiplier.toFixed(2)}`);
      }
    }

    // ── Random jitter ─────────────────────────────────────
    // Small random perturbation so the algorithm can escape local optima and
    // surface time slots that are occasionally good but not historically dominant.
    const jitter = (Math.random() - 0.5) * 2 * MAX_JITTER;
    score += jitter;
    if (Math.abs(jitter) >= 0.001) {
      reasons.push(`jitter ${jitter >= 0 ? '+' : ''}${jitter.toFixed(2)}`);
    }

    // Sort contributors by descending score so the highest-value reasons come first
    contributors.sort((a, b) => b.score - a.score);

    scores.push({
      hour,
      minute,
      score: Math.max(0, Math.min(1, score)),
      reason: reasons.join(', ') || 'baseline',
      contributors,
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Decide whether to send a reminder right now.
 * Returns true if a reminder should be sent.
 */
export function shouldRemindNow(
  todayMinutes: number,
  dailyTargetMinutes: number,
  lastReminderMs: number,
  isCurrentlyOutside: boolean,
): { should: boolean; reason: string; contributors: ScoreContributor[] } {
  const now = Date.now();
  const d = new Date(now);
  const hour = d.getHours();
  const minute = d.getMinutes();

  // Hard stops
  if (isCurrentlyOutside) {
    return { should: false, reason: 'currently outside', contributors: [] };
  }

  if (todayMinutes >= dailyTargetMinutes) {
    return { should: false, reason: 'daily goal reached', contributors: [] };
  }

  if (hour < 7 || hour >= 23) {
    return { should: false, reason: 'outside quiet hours', contributors: [] };
  }

  const msSinceLastReminder = now - lastReminderMs;
  if (msSinceLastReminder < 60 * 60 * 1000) {
    return { should: false, reason: 'reminded recently', contributors: [] };
  }

  // Score slots starting from the current slot
  const scores = scoreReminderHours(todayMinutes, dailyTargetMinutes, hour, minute);
  // The current half-hour slot (either :00 or :30)
  const currentSlotMinute = (minute >= 30 ? 30 : 0) as 0 | 30;
  const currentHourScore = scores.find((s) => s.hour === hour && s.minute === currentSlotMinute);

  if (!currentHourScore || currentHourScore.score < 0.35) {
    return { should: false, reason: `score too low (${currentHourScore?.score.toFixed(2) ?? '0'})`, contributors: [] };
  }

  return {
    should: true,
    reason: `score ${currentHourScore.score.toFixed(2)}: ${currentHourScore.reason}`,
    contributors: currentHourScore.contributors,
  };
}

// ── Helpers ───────────────────────────────────────────────

function countOutsideSessionsAtHour(hour: number): number {
  // Look back 4 weeks
  const from = startOfWeek(Date.now()) - 4 * 7 * 24 * 60 * 60 * 1000;
  const sessions = getSessionsForRange(from, Date.now());

  return sessions.filter((s) => {
    const sessionHour = new Date(s.startTime).getHours();
    return Math.abs(sessionHour - hour) <= 1; // within 1 hour
  }).length;
}
