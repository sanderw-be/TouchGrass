import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { PULSE_TASK_NAME } from 'alarm-bridge-native';
import { widgetTaskHandler } from './src/widget/widget-task-handler';
import { smartReminderHeadlessTask } from './src/background/smartReminderHeadlessTask';

// Register the Android widget task handler as the very first executable
// statement — before registerRootComponent so the headless JS boot path is
// as short as possible.  This prevents the widget from going blank after an
// app update when Android fires APPWIDGET_UPDATE with a tight background
// execution time-limit.
registerWidgetTaskHandler(widgetTaskHandler);

AppRegistry.registerHeadlessTask('SmartReminderHeadlessTask', () => smartReminderHeadlessTask);

// ---------------------------------------------------------------------------
// Pulsar headless task (Legacy)
//
// No longer performs work; just logs that a legacy alarm fired.
// ---------------------------------------------------------------------------
AppRegistry.registerHeadlessTask(PULSE_TASK_NAME, () => async () => {
  console.log('TouchGrass: [PulseTask] Legacy tick (ignored)');
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
