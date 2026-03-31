# Release Notes

## 1.1.0

- **Smart reminder overhaul**: Rewrote the reminder scheduling engine with a stateful queue, 60-minute grace period after going outside, slot spreading to avoid bunching, and automatic cleanup when the daily goal is reached.
- **Adaptive sleep intervals**: The background job now dynamically adjusts its wake-up interval based on time-of-day and reminder density, reducing unnecessary wake-ups.
- **"Why This Time?" explanations**: Smart reminders include a structured breakdown of why a particular time slot was chosen, visible in the notification detail.
- **Granular reminder feedback**: The "Less Often" notification action has been replaced by a detailed in-app feedback modal for more precise scheduling preferences.
- **Unified background architecture**: Replaced the legacy `react-native-background-actions` foreground service and redundant WorkManager task with a single `expo-background-task` implementation. Long-running app-start processing is now handled in the background.
- **Temperature units**: Weather temperatures are displayed in °C or °F based on the device's region setting.
- **12/24-hour time display**: All time displays (reminders, history, stats) now respect the device's system 12h/24h preference.
- **Improved event descriptions**: Outdoor session events include context about how the session was detected (GPS or Health Connect).
- **Health Connect decoupled**: Health Connect permission checks no longer block event sync when permissions are unavailable.
- **Notification reliability fixes**: Fixed missing `channelId` on location suggestion notifications, suppressed badge dot on silent/internal Android channels, and resolved `NotSerializableException` crashes in notification extras.

## 1.0.2

- **Weekly average fix**: Weekly outdoor time average now divides by the number of days elapsed in the current week instead of always dividing by 7, giving a more accurate picture early in the week.
- **Localized time format**: Time pickers now respect the device's 12h/24h system setting on Android.
- **Improved outdoor timer UI**: The running outdoor timer has been moved inside the daily progress ring, with a prominent play/stop icon and an OUTSIDE badge for better visibility.
