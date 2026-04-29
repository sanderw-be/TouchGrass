import { LocationTracker } from '../detection/LocationTracker';
import { ActivityStateManager } from '../detection/ActivityStateManager';

const IN_VEHICLE = 0;
const ENTER = 0;
const EXIT = 1;

export const activityTransitionTask = async (taskData: any) => {
  const { activityType, transitionType } = taskData;
  const stateManager = ActivityStateManager.getInstance();
  await stateManager.loadState();
  const tracker = LocationTracker.getInstance();
  await tracker.loadState();

  if (transitionType === ENTER) {
    await stateManager.setCurrentActivity(activityType);
    
    if (activityType === IN_VEHICLE) {
      // Pause aggressive tracking or flag invalid
      await tracker.stopTracking();
    } else {
      // e.g., WALKING or STILL
      // Wake up tracker if it was stopped
      await tracker.startTracking('high', 100); 
    }
  } else if (transitionType === EXIT) {
    if (activityType === IN_VEHICLE) {
      await tracker.startTracking('high', 100);
    }
  }
};
