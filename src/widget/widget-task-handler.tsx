import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { ProgressWidget } from './ProgressWidget';
import {
  getTodayMinutes,
  getCurrentDailyGoal,
  getSetting,
  setSetting,
  initDatabase,
} from '../storage/database';
import { logManualSession } from '../detection/manualCheckin';
import { WIDGET_TIMER_KEY } from '../utils/widgetHelper';

/** Read current progress data from SQLite. */
function getWidgetData(): { current: number; target: number; timerRunning: boolean } {
  initDatabase();
  const current = getTodayMinutes();
  const target = getCurrentDailyGoal()?.targetMinutes ?? 30;
  const marker = getSetting(WIDGET_TIMER_KEY, '');
  const timerRunning = marker !== '' && !isNaN(parseInt(marker, 10)) && parseInt(marker, 10) > 0;
  return { current, target, timerRunning };
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetAction, clickAction, renderWidget } = props;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = getWidgetData();
      renderWidget(
        <ProgressWidget
          current={data.current}
          target={data.target}
          timerRunning={data.timerRunning}
        />
      );
      break;
    }

    case 'WIDGET_CLICK': {
      if (clickAction === 'TOGGLE_TIMER') {
        initDatabase();
        const marker = getSetting(WIDGET_TIMER_KEY, '');
        const ts = marker ? parseInt(marker, 10) : 0;

        if (ts > 0) {
          // Stop timer — save session and clear marker
          const startTime = ts;
          const endTime = Date.now();
          const durationMinutes = (endTime - startTime) / 60000;

          if (durationMinutes >= 0.05) {
            logManualSession(durationMinutes, startTime, endTime);
          }

          setSetting(WIDGET_TIMER_KEY, '');
        } else {
          // Start timer — write timestamp marker
          setSetting(WIDGET_TIMER_KEY, String(Date.now()));
        }

        // Re-render widget with updated state
        const data = getWidgetData();
        renderWidget(
          <ProgressWidget
            current={data.current}
            target={data.target}
            timerRunning={data.timerRunning}
          />
        );
      }
      break;
    }

    case 'WIDGET_DELETED':
      break;
  }
}
