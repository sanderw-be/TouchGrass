# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**32 library files** across 11 modules

## Utils (9 files)

- `src/utils/theme.ts` — makeShadows, progressColor, ThemeColors, Shadows, colors, darkColors, …
- `src/utils/helpers.ts` — uses24HourClock, formatMinutes, normalizeAmPm, formatTime, formatDate, formatTimer
- `src/utils/units.ts` — isImperialUnits, metersToYards, yardsToMeters, kmToMiles, kmhToMph
- `src/utils/batteryOptimization.ts` — isBatteryOptimizationDisabled, refreshBatteryOptimizationSetting, openBatteryOptimizationSettings, BATTERY_OPTIMIZATION_SETTING_KEY
- `src/utils/temperature.ts` — isFahrenheit, celsiusToFahrenheit, formatTemperature
- `src/utils/widgetHelper.ts` — isWidgetTimerRunning, requestWidgetRefresh, WIDGET_TIMER_KEY
- `src/utils/permissionIssuesChangedEmitter.ts` — emitPermissionIssuesChanged, onPermissionIssuesChanged
- `src/utils/sessionsChangedEmitter.ts` — emitSessionsChanged, onSessionsChanged
- `src/utils/permissionIssues.ts` — countPermissionIssues

## Detection (7 files)

- `src/detection/gpsDetection.ts` — clampRadiusMeters, loadGPSState, \_resetGPSStateForTesting, requestLocationPermissions, computeMinActiveRadius, computeLowDistanceInterval, …
- `src/detection/index.ts` — initDetection, requestHealthConnect, recheckHealthConnect, openHealthConnectSettings, getDetectionStatus, checkGPSPermissions, …
- `src/detection/sessionConfidence.ts` — getTimeSlotProbability, updateTimeSlotProbability, scoreDuration, computeSessionScore, computeSessionScoreFromProbs, DISCARD_CONFIDENCE_THRESHOLD, …
- `src/detection/healthConnect.ts` — isHealthConnectAvailable, requestHealthPermissions, openHealthConnectForManagement, syncHealthConnect
- `src/detection/manualCheckin.ts` — logManualSession, logManualSessionAsync, startManualSession
- `src/detection/healthConnectIntent.ts` — openHealthConnectPermissionsViaIntent, verifyHealthConnectPermissions
- `src/detection/sessionMerger.ts` — submitSession, buildSession

## Background (3 files)

- `src/background/alarmTiming.ts` — computeNextSleepMs, scheduleNextAlarmPulse, PULSE_INTERVAL_DAY_MS, PULSE_INTERVAL_NIGHT_MS
- `src/background/unifiedBackgroundTask.ts` — registerUnifiedBackgroundTask, unregisterUnifiedBackgroundTask, UNIFIED_BACKGROUND_TASK
- `src/background/backgroundTick.ts` — performBackgroundTick

## Hooks (3 files)

- `src/hooks/useOTAUpdates.ts` — useOTAUpdates, OTAUpdateStatus
- `src/hooks/useAppInitialization.ts` — useAppInitialization
- `src/hooks/useForegroundSync.ts` — useForegroundSync

## Notifications (3 files)

- `src/notifications/notificationManager.ts` — \_resetSchedulingGuards, logReminderQueueSnapshot, setupNotificationInfrastructure, requestNotificationPermissions, setupNotifications, scheduleNextReminder, …
- `src/notifications/reminderAlgorithm.ts` — scoreReminderHours, shouldRemindNow, ScoreContributor, HourScore
- `src/notifications/scheduledNotifications.ts` — scheduleAllScheduledNotifications, cancelAllScheduledNotifications, isSlotNearScheduledNotification, hasScheduledNotificationNearby

## Weather (2 files)

- `src/weather/weatherService.ts` — fetchWeatherForecast, getWeatherForHour, isWeatherDataAvailable, WeatherFetchResult, FetchWeatherForecastOptions
- `src/weather/weatherAlgorithm.ts` — scoreWeatherCondition, getWeatherPreferences, getWeatherDescription, getWeatherEmoji

## Alarm-bridge-native (1 files)

- `modules/alarm-bridge-native/src/index.ts` — scheduleNextPulse, cancelPulse, PULSE_TASK_NAME

## AppBootstrap.ts (1 files)

- `appBootstrap.ts` — performCriticalInitialization, performCriticalInitializationAsync, performDeferredInitialization, CriticalAppState

## Calendar (1 files)

- `src/calendar/calendarService.ts` — cleanupTouchGrassCalendars, requestCalendarPermissions, hasCalendarPermissions, getWritableCalendars, getOrCreateTouchGrassCalendar, getSelectedCalendarId, …

## I18n (1 files)

- `src/i18n/index.ts` — resolveSupportedLocale, getDeviceSupportedLocale, t, localeTag, formatLocalDate, formatLocalTime, …

## Storage (1 files)

- `src/storage/database.ts` — initDatabase, initDatabaseAsync, insertSession, insertSessionAsync, getSessionsForDayAsync, getSessionsForRange, …

---

_Back to [overview.md](./overview.md)_
