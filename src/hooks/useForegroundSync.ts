import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';
import { getSettingAsync } from '../storage';
import { getSmartReminderScheduler } from '../notifications/notificationManager';
import { cleanupTouchGrassCalendars } from '../calendar/calendarService';
import { refreshBatteryOptimizationSetting } from '../utils/batteryOptimization';
import { requestWidgetRefresh } from '../utils/widgetHelper';

export function useForegroundSync() {
  const appState = useRef(AppState.currentState);

  // On app foreground: run day planning and goal-reached check as a catch-up
  // for missed background wakes, plus calendar cleanup.
  // Deferred via InteractionManager so the resumed UI frame renders first.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState: AppStateStatus) => {
        if (appState.current !== 'active' && nextAppState === 'active') {
          try {
            const hasCompletedIntro = (await getSettingAsync('hasCompletedIntro', '0')) === '1';
            if (hasCompletedIntro) {
              refreshBatteryOptimizationSetting().catch((e) =>
                console.warn('Battery optimization status check error:', e)
              );
              InteractionManager.runAfterInteractions(() => {
                getSmartReminderScheduler()
                  .scheduleDayReminders()
                  .catch((e) =>
                    console.warn('TouchGrass: foreground scheduleDayReminders error:', e)
                  );
                getSmartReminderScheduler()
                  .processReminderQueue()
                  .catch((e) =>
                    console.warn('TouchGrass: foreground processReminderQueue error:', e)
                  );
                cleanupTouchGrassCalendars().catch((e) =>
                  console.warn('TouchGrass: foreground calendar cleanup error:', e)
                );
                // Safety net: refresh the widget whenever the user opens the app so
                // it always shows up-to-date data (covers the post-update blank case).
                requestWidgetRefresh().catch((e) =>
                  console.warn('TouchGrass: foreground widget refresh error:', e)
                );
              });
              // Calendar events are only created by scheduleDayReminders() at planned
              // half-hour slots. Do NOT call maybeAddOutdoorTimeToCalendar(new Date())
              // here — it would create events at arbitrary foreground-wake times.
            }
          } catch (error) {
            console.error('[useForegroundSync] Failed to check intro status:', error);
          }
        }
        appState.current = nextAppState;
      }
    );
    return () => subscription.remove();
  }, []);
}
