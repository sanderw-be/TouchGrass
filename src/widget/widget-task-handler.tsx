import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { ProgressWidget } from './ProgressWidget';
import {
  getTodayMinutesAsync,
  getCurrentDailyGoalAsync,
  getSettingAsync,
  setSettingAsync,
  initDatabase,
} from '../storage/database';
import { logManualSessionAsync } from '../detection/manualCheckin';
import { WIDGET_TIMER_KEY, isWidgetTimerRunning } from '../utils/widgetHelper';

/** Read current progress data from SQLite (async). */
async function getWidgetDataAsync(): Promise<{
  current: number;
  target: number;
  timerRunning: boolean;
  timerStartMs?: number;
}> {
  try {
    const current = await getTodayMinutesAsync();
    const target = (await getCurrentDailyGoalAsync())?.targetMinutes ?? 30;
    const marker = await getSettingAsync(WIDGET_TIMER_KEY, '');
    const timerRunning = isWidgetTimerRunning(marker);
    const timerStartMs = timerRunning ? parseInt(marker, 10) : undefined;
    return { current, target, timerRunning, timerStartMs };
  } catch (error) {
    console.error('[getWidgetDataAsync] Database error:', error);
    // Return safe defaults on error
    return { current: 0, target: 30, timerRunning: false };
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetAction, clickAction, renderWidget, widgetInfo } = props;

  try {
    initDatabase();
  } catch (error) {
    console.error('[widgetTaskHandler] initDatabase failed:', error);
  }

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await getWidgetDataAsync();
      renderWidget(
        <ProgressWidget
          current={data.current}
          target={data.target}
          timerRunning={data.timerRunning}
          timerStartMs={data.timerStartMs}
          widgetWidth={widgetInfo.width}
          widgetHeight={widgetInfo.height}
        />
      );
      break;
    }

    case 'WIDGET_CLICK': {
      if (clickAction === 'TOGGLE_TIMER') {
        try {
          const marker = await getSettingAsync(WIDGET_TIMER_KEY, '');

          if (isWidgetTimerRunning(marker)) {
            // Stop timer — save session and clear marker
            const startTime = parseInt(marker, 10);
            const endTime = Date.now();
            const durationMinutes = (endTime - startTime) / 60000;

            if (durationMinutes >= 0.05) {
              await logManualSessionAsync(durationMinutes, startTime, endTime);
            }

            await setSettingAsync(WIDGET_TIMER_KEY, '');
          } else {
            // Start timer — write timestamp marker
            await setSettingAsync(WIDGET_TIMER_KEY, String(Date.now()));
          }

          // Re-render widget with updated state
          const data = await getWidgetDataAsync();
          renderWidget(
            <ProgressWidget
              current={data.current}
              target={data.target}
              timerRunning={data.timerRunning}
              timerStartMs={data.timerStartMs}
              widgetWidth={widgetInfo.width}
              widgetHeight={widgetInfo.height}
            />
          );
        } catch (error) {
          console.error('[WIDGET_CLICK] Database error:', error);
          // Re-render with safe defaults on error
          const data = await getWidgetDataAsync();
          renderWidget(
            <ProgressWidget
              current={data.current}
              target={data.target}
              timerRunning={data.timerRunning}
              timerStartMs={data.timerStartMs}
              widgetWidth={widgetInfo.width}
              widgetHeight={widgetInfo.height}
            />
          );
        }
      }
      break;
    }

    case 'WIDGET_DELETED':
      break;
  }
}
