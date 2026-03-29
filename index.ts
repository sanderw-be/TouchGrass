import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// Register the HeadlessJS task that runs when the exact AlarmManager pulse
// fires and the app process is not in the foreground.
// AlarmPulseService (native) starts React Native and calls this task by name.
//
// IMPORTANT: Do NOT import from native module barrel files at module scope —
// use lazy imports inside the task to avoid "[runtime not ready]" crashes in
// the HeadlessJS context (the bridge may not be fully ready at import time).
const PULSE_TASK_NAME = 'PulseTask';
AppRegistry.registerHeadlessTask(PULSE_TASK_NAME, () => async () => {
  const { performBackgroundTick } = await import('./src/background/backgroundTick');
  await performBackgroundTick();
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
registerRootComponent(App);
