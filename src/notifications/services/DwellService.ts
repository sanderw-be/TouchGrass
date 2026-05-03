import * as Notifications from 'expo-notifications';
import { DWELL_NOTIFICATION_ID, DWELL_NOTIFICATION_DELAY_SECONDS } from '../../detection/constants';
import { CHANNEL_ID } from './NotificationInfrastructureService';
import { t } from '../../i18n';
import { colors } from '../../utils/theme';

export interface IDwellService {
  scheduleDwellPrompt(): Promise<void>;
  cancelDwellPrompt(): Promise<void>;
}

export class DwellService implements IDwellService {
  public async scheduleDwellPrompt(): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      identifier: DWELL_NOTIFICATION_ID,
      content: {
        title: t('dwell_prompt_title'),
        body: t('dwell_prompt_body'),
        data: { type: 'dwell_prompt' },
        color: colors.grass,
      },
      trigger: {
        seconds: DWELL_NOTIFICATION_DELAY_SECONDS,
        channelId: CHANNEL_ID,
      } as Notifications.NotificationTriggerInput,
    });
  }

  public async cancelDwellPrompt(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(DWELL_NOTIFICATION_ID);
  }
}
