import { getSettingAsync, setSettingAsync } from '../storage';

const CURRENT_ACTIVITY_KEY = 'current_activity_type';

export enum ActivityType {
  UNKNOWN = -1,
  IN_VEHICLE = 0,
  ON_BICYCLE = 1,
  ON_FOOT = 2,
  STILL = 3,
  UNKNOWN_GMS = 4,
  TILTING = 5,
  WALKING = 7,
  RUNNING = 8,
}

export class ActivityStateManager {
  private static instance: ActivityStateManager;
  private currentActivity: ActivityType = ActivityType.UNKNOWN;

  private constructor() {}

  public static getInstance(): ActivityStateManager {
    if (!ActivityStateManager.instance) {
      ActivityStateManager.instance = new ActivityStateManager();
    }
    return ActivityStateManager.instance;
  }

  public async loadState(): Promise<void> {
    try {
      const actRaw = await getSettingAsync(CURRENT_ACTIVITY_KEY, String(ActivityType.UNKNOWN));
      const parsed = parseInt(actRaw, 10);

      if (!isNaN(parsed) && Object.values(ActivityType).includes(parsed)) {
        this.currentActivity = parsed as ActivityType;
      } else {
        this.currentActivity = ActivityType.UNKNOWN;
      }
    } catch {
      this.currentActivity = ActivityType.UNKNOWN;
    }
  }

  public getCurrentActivity(): ActivityType {
    return this.currentActivity;
  }

  public async setCurrentActivity(activityType: ActivityType): Promise<void> {
    this.currentActivity = activityType;
    await setSettingAsync(CURRENT_ACTIVITY_KEY, String(activityType));
  }
}
