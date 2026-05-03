import * as Notifications from 'expo-notifications';
import { DwellService } from '../notifications/services/DwellService';
import { DWELL_NOTIFICATION_ID, DWELL_NOTIFICATION_DELAY_SECONDS } from '../detection/constants';
import { CHANNEL_ID } from '../notifications/services/NotificationInfrastructureService';
import { t } from '../i18n';
import { colors } from '../utils/theme';

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

jest.mock('../i18n', () => ({
  t: (key: string) => key,
}));

describe('DwellService', () => {
  let dwellService: DwellService;

  beforeEach(() => {
    jest.clearAllMocks();
    dwellService = new DwellService();
  });

  describe('scheduleDwellPrompt', () => {
    it('should schedule a notification with correct parameters', async () => {
      await dwellService.scheduleDwellPrompt();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
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
        },
      });
    });
  });

  describe('cancelDwellPrompt', () => {
    it('should cancel the correct notification', async () => {
      await dwellService.cancelDwellPrompt();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        DWELL_NOTIFICATION_ID
      );
    });
  });
});
