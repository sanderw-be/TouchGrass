import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';
import { getSetting } from '../storage/database';
import { scheduleDayReminders, processReminderQueue } from '../notifications/notificationManager';
import { cleanupTouchGrassCalendars } from '../calendar/calendarService';
import { scheduleNextAlarmPulse } from '../background/alarmTiming';
import { refreshBatteryOptimizationSetting } from '../utils/batteryOptimization';
import { requestWidgetRefresh } from '../utils/widgetHelper';

export function useForegroundSync() {
  const appState = useRef(AppState.currentState);

  // On app foreground: run day planning and goal-reached check as a catch-up
  // for missed background wakes, plus calendar cleanup.
  // Deferred via InteractionManager so the resumed UI frame renders first.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current !== 'active' && nextAppState === 'active') {
        const hasCompletedIntro = getSetting('hasCompletedIntro', '0') === '1';
        if (hasCompletedIntro) {
          refreshBatteryOptimizationSetting().catch((e) =>
            console.warn('Battery optimization status check error:', e)
          );
          InteractionManager.runAfterInteractions(() => {
            scheduleDayReminders().catch((e) =>
              console.warn('TouchGrass: foreground scheduleDayReminders error:', e)
            );
            processReminderQueue().catch((e) =>
              console.warn('TouchGrass: foreground processReminderQueue error:', e)
            );
            cleanupTouchGrassCalendars().catch((e) =>
              console.warn('TouchGrass: foreground calendar cleanup error:', e)
            );
            // Re-arm the Pulsar alarm chain on every foreground wake.
            // This keeps the chain alive and resets the timer from "now" so
            // the next tick fires ~15 min after the user last used the app.
            scheduleNextAlarmPulse().catch((e) =>
              console.warn('TouchGrass: foreground alarm re-arm error:', e)
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
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);
}
