import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { PULSE_TASK_NAME } from 'alarm-bridge-native';
import { BackgroundService } from './src/background/unifiedBackgroundTask';
import { widgetTaskHandler } from './src/widget/widget-task-handler';

// Register the Android widget task handler as the very first executable
// statement — before registerRootComponent so the headless JS boot path is
// as short as possible.  This prevents the widget from going blank after an
// app update when Android fires APPWIDGET_UPDATE with a tight background
// execution time-limit.
registerWidgetTaskHandler(widgetTaskHandler);

// ---------------------------------------------------------------------------
// Pulsar headless task
//
// Runs when PulseAlarmReceiver → AlarmPulseService wakes the device via a
// setExactAndAllowWhileIdle alarm. This is the primary background execution
// path — it bypasses WorkManager's quota so it cannot go stale after ~12 h.
// ---------------------------------------------------------------------------
AppRegistry.registerHeadlessTask(PULSE_TASK_NAME, () => async () => {
  console.log('TouchGrass: [PulseTask] Tick');
  try {
    await BackgroundService.performBackgroundTick();
  } catch (e) {
    console.error('TouchGrass: [PulseTask] Fatal error', e);
  } finally {
    // Always re-arm the chain — even if the tick threw an error.
    await BackgroundService.scheduleNextAlarmPulse().catch((e) =>
      console.error('TouchGrass: [PulseTask] Failed to re-arm alarm', e)
    );
  }
  console.log('TouchGrass: [PulseTask] Done');
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
