import { NativeModules } from 'react-native';

const { BackgroundFeaturesNative } = NativeModules;

export interface ReminderScheduleItem {
  timestamp: number;
  type: string;
  goalThreshold: number;
  title: string;
  body: string;
}

export const SmartReminderModule = {
  scheduleReminders: async (schedule: ReminderScheduleItem[]): Promise<void> => {
    if (BackgroundFeaturesNative) {
      await BackgroundFeaturesNative.scheduleReminders(schedule);
    }
  },
  cancelAllReminders: async (): Promise<void> => {
    if (BackgroundFeaturesNative) {
      await BackgroundFeaturesNative.cancelAllReminders();
    }
  },
};
