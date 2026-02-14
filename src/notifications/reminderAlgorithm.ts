import { getReminderFeedback, getSessionsForRange, startOfDay, startOfWeek } from '../storage/database';

const HOURS_IN_DAY = 24;

export interface HourScore {
  hour: number;
  score: number;
  reason: string;
}

/**
 * Score each hour of the day for how good a time it is to send a reminder.
 * Higher score = better time to remind.
 * Returns scores for all 24 hours, sorted best first.
 */
export function scoreReminderHours(
  todayMinutes: number,
  dailyTargetMinutes: number,
  currentHour: number,
): HourScore[] {
  const feedback = getReminderFeedback();
  const scores: HourScore[] = [];

  // How urgent is the reminder? Grows as day progresses without hitting goal
  const progressRatio = Math.min(todayMinutes / dailyTargetMinutes, 1);
  const dayProgressRatio = currentHour / 21; // normalize to end of reasonable day (9pm)
  const urgency = Math.max(0, dayProgressRatio - progressRatio); // 0 = no urgency, 1 = very urgent

  for (let hour = 0; hour < HOURS_IN_DAY; hour++) {
    // Skip sleeping hours (11pm–7am)
    if (hour < 7 || hour >= 23) {
      scores.push({ hour, score: 0, reason: 'sleeping hours' });
      continue;
    }

    // Skip past hours
    if (hour <= currentHour) {
      scores.push({ hour, score: 0, reason: 'already passed' });
      continue;
    }

    let score = 0.5; // baseline
    const reasons: string[] = [];

    // ── Historical pattern boost ──────────────────────────
    // Did you go outside around this hour in the past?
    const outsideAtHour = countOutsideSessionsAtHour(hour);
    if (outsideAtHour > 0) {
      const patternBoost = Math.min(outsideAtHour * 0.1, 0.3);
      score += patternBoost;
      reasons.push(`pattern +${patternBoost.toFixed(2)}`);
    }

    // ── Feedback penalties and bonuses ───────────────────
    const hourFeedback = feedback.filter((f) => f.scheduledHour === hour);

    const snoozeCount = hourFeedback.filter((f) => f.action === 'snoozed').length;
    const dismissCount = hourFeedback.filter((f) => f.action === 'dismissed').length;
    const actedCount = hourFeedback.filter((f) => f.action === 'went_outside').length;
    const lessCount = hourFeedback.filter((f) => f.action === 'less_often').length;
    const moreCount = hourFeedback.filter((f) => f.action === 'more_often').length;

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
    }

    // ── Urgency boost ─────────────────────────────────────
    // Closer to end of day with goal unmet = higher urgency
    const hoursLeft = 21 - hour; // hours until 9pm
    if (urgency > 0.3 && hoursLeft <= 4) {
      const urgencyBoost = urgency * 0.3;
      score += urgencyBoost;
      reasons.push(`urgent +${urgencyBoost.toFixed(2)}`);
    }

    // ── Prime outdoor hours bonus ─────────────────────────
    // Lunch (12-13) and after work (17-19) are naturally good times
    if (hour === 12 || hour === 13) {
      score += 0.1;
      reasons.push('lunch +0.10');
    }
    if (hour >= 17 && hour <= 19) {
      score += 0.15;
      reasons.push('after-work +0.15');
    }

    scores.push({
      hour,
      score: Math.max(0, Math.min(1, score)),
      reason: reasons.join(', ') || 'baseline',
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
): { should: boolean; reason: string } {
  const now = Date.now();
  const hour = new Date().getHours();

  // Hard stops
  if (isCurrentlyOutside) {
    return { should: false, reason: 'currently outside' };
  }

  if (todayMinutes >= dailyTargetMinutes) {
    return { should: false, reason: 'daily goal reached' };
  }

  if (hour < 7 || hour >= 23) {
    return { should: false, reason: 'outside quiet hours' };
  }

  const msSinceLastReminder = now - lastReminderMs;
  if (msSinceLastReminder < 60 * 60 * 1000) {
    return { should: false, reason: 'reminded recently' };
  }

  // Score the current hour
  const scores = scoreReminderHours(todayMinutes, dailyTargetMinutes, hour - 1);
  const currentHourScore = scores.find((s) => s.hour === hour);

  if (!currentHourScore || currentHourScore.score < 0.35) {
    return { should: false, reason: `score too low (${currentHourScore?.score.toFixed(2) ?? '0'})` };
  }

  return { should: true, reason: `score ${currentHourScore.score.toFixed(2)}: ${currentHourScore.reason}` };
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
