import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationInfrastructureService } from '../notifications/services/NotificationInfrastructureService';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  AndroidImportance: {
    DEFAULT: 3,
    MIN: 1,
  },
}));

describe('NotificationInfrastructureService', () => {
  let service: NotificationInfrastructureService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationInfrastructureService();
    Platform.OS = 'android';
  });

  describe('requestNotificationPermissions', () => {
    it('returns true immediately if permissions are already granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      });

      const result = await service.requestNotificationPermissions();

      expect(result.granted).toBe(true);
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('requests permissions if not granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: true,
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      });

      const result = await service.requestNotificationPermissions();

      expect(result.granted).toBe(true);
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('returns false if request fails', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: true,
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: true,
      });

      const result = await service.requestNotificationPermissions();

      expect(result.granted).toBe(false);
    });

    it('sets up channels and categories on successful grant (Android)', async () => {
      Platform.OS = 'android';
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: true,
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      });

      await service.requestNotificationPermissions();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalled();
      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
        'reminder',
        expect.any(Array)
      );
    });
  });
});
