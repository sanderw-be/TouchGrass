import { getDailyStreakAsync, getWeeklyStreakAsync, getSettingAsync } from '../../storage';
import { ScoreContributor } from '../reminderAlgorithm';
import { getWeatherForHour, isWeatherDataAvailable } from '../../weather/weatherService';
import {
  getWeatherDescription,
  getWeatherEmoji,
  getWeatherPreferences,
} from '../../weather/weatherAlgorithm';
import { t } from '../../i18n';
import { formatTemperature } from '../../utils/temperature';

const NOTIF_TITLES = [
  'notif_title_1',
  'notif_title_2',
  'notif_title_3',
  'notif_title_4',
  'notif_title_5',
];

export class ReminderMessageBuilder {
  public async buildReminderMessage(
    todayMinutes: number,
    dailyTarget: number,
    hour?: number,
    contributors?: ScoreContributor[],
    isCatchupReminder?: boolean
  ): Promise<{ title: string; body: string }> {
    const remaining = Math.max(0, Math.round(dailyTarget - todayMinutes));
    const percent = todayMinutes / dailyTarget;

    const titleKey = NOTIF_TITLES[Math.floor(Math.random() * NOTIF_TITLES.length)];
    const title = t(titleKey);

    let body: string;
    if (todayMinutes === 0) {
      body = t('notif_body_none');
    } else if (percent < 0.5) {
      body = t('notif_body_halfway', { remaining });
    } else if (percent < 1) {
      body = t('notif_body_almost', { remaining });
    } else {
      body = t('notif_body_done');
    }

    const catchupEnabled =
      parseInt(await getSettingAsync('smart_catchup_reminders_count', '2'), 10) > 0;
    const shouldShowStreak = catchupEnabled
      ? isCatchupReminder === true
      : isCatchupReminder !== true;

    if (shouldShowStreak) {
      const dailyStreak = await getDailyStreakAsync();
      const weeklyStreak = await getWeeklyStreakAsync();

      if (dailyStreak > 0 || weeklyStreak > 0) {
        const atRisk = percent < 1;

        if (dailyStreak > 0) {
          const key = atRisk ? 'notif_streak_daily_at_risk' : 'notif_streak_daily';
          body += ` ${t(key, { count: dailyStreak })}`;
        } else if (weeklyStreak > 0) {
          const key = atRisk ? 'notif_streak_weekly_at_risk' : 'notif_streak_weekly';
          body += ` ${t(key, { count: weeklyStreak })}`;
        }
      }
    }

    if (contributors && contributors.length > 0) {
      const top2 = contributors.slice(0, 2);
      const descriptions = top2.map((c) => c.description);
      const first = `${descriptions[0].charAt(0).toUpperCase()}${descriptions[0].slice(1)}`;
      if (descriptions.length === 1) {
        body += ` ${first}.`;
      } else {
        body += ` ${first}, ${t('notif_contributor_and')} ${descriptions[1]}.`;
      }
    } else {
      if (await isWeatherDataAvailable()) {
        const weatherPrefs = await getWeatherPreferences();
        if (weatherPrefs.enabled) {
          const currentHour = hour ?? new Date().getHours();
          const weather = await getWeatherForHour(currentHour);

          if (weather) {
            const emoji = getWeatherEmoji(weather);
            const desc = getWeatherDescription(weather);

            body += ` ${emoji} ${t('notif_weather_context', {
              desc,
              temp: formatTemperature(weather.temperature),
            })}`;
          }
        }
      }
    }

    return { title, body };
  }
}

export const reminderMessageBuilder = new ReminderMessageBuilder();
