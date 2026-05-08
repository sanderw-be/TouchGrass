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

jest.mock('../storage', () => ({
  setSettingAsync: jest.fn(),
}));

const mockScheduler = {
  scheduleUpcomingReminders: jest.fn(),
};

jest.mock('../notifications/notificationManager', () => ({
  getSmartReminderScheduler: jest.fn(() => mockScheduler),
}));

import { setSettingAsync } from '../storage';
import { getSmartReminderScheduler } from '../notifications/notificationManager';

describe('DwellService', () => {
  let dwellService: DwellService;

  beforeEach(() => {
    jest.clearAllMocks();
    dwellService = new DwellService();
  });

  describe('scheduleDwellPrompt', () => {
    it('should set timestamp and trigger replan', async () => {
      await dwellService.scheduleDwellPrompt();

      expect(setSettingAsync).toHaveBeenCalledWith(
        'dwell_suggestion_timestamp',
        expect.any(String)
      );
      expect(mockScheduler.scheduleUpcomingReminders).toHaveBeenCalled();
    });
  });

  describe('cancelDwellPrompt', () => {
    it('should clear timestamp and trigger replan', async () => {
      await dwellService.cancelDwellPrompt();

      expect(setSettingAsync).toHaveBeenCalledWith('dwell_suggestion_timestamp', '0');
      expect(mockScheduler.scheduleUpcomingReminders).toHaveBeenCalled();
    });
  });
});
