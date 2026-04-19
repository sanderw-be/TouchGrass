# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**45 library files** across 11 modules

## Detection (13 files)

- `src/detection/index.ts` — initDetection, checkWeatherLocationPermissions, requestWeatherLocationPermissions, checkGPSPermissions, requestGPSPermissions, refreshDetectionSync, …
- `src/detection/GeofenceManager.ts` — isAtKnownIndoorLocation, wasDefinitelyAtKnownIndoorLocationSync, shouldTriggerBurst, computeMinActiveRadius, clampRadiusMeters, createClusterObject, …
- `src/detection/gpsDetection.ts` — loadGPSState, requestLocationPermissions, computeMinActiveRadius, startLocationTracking, stopLocationTracking, switchLocationProfile, …
- `src/detection/sessionConfidence.ts` — getTimeSlotProbability, updateTimeSlotProbability, scoreDuration, computeSessionScore, computeSessionScoreFromProbs, DISCARD_CONFIDENCE_THRESHOLD, …
- `src/detection/healthConnect.ts` — isHealthConnectAvailable, requestHealthPermissions, openHealthConnectForManagement, syncHealthConnect
- `src/detection/manualCheckin.ts` — logManualSession, logManualSessionAsync, startManualSession
- `src/detection/utils.ts` — haversineDistance, EARTH_RADIUS_METERS, haversineDistanceMeters
- `src/detection/healthConnectIntent.ts` — openHealthConnectPermissionsViaIntent, verifyHealthConnectPermissions
- `src/detection/sessionMerger.ts` — submitSession, buildSession
- `src/detection/GpsSessionBuilder.ts` — buildGpsNotes
- `src/detection/HealthSessionBuilder.ts` — HealthSessionBuilder
- `src/detection/LocationTracker.ts` — LocationTracker
- `src/detection/PermissionService.ts` — PermissionService

## Storage (9 files)

- `src/storage/repositories/SessionRepository.ts` — insertSessionAsync, getSessionsForDayAsync, getSessionsForRangeAsync, deleteSessionAsync, deleteSessionsByIdsAsync, insertSessionsBatchAsync, …
- `src/storage/repositories/NotificationRepository.ts` — insertReminderFeedbackAsync, getReminderFeedbackAsync, getScheduledNotificationsAsync, insertScheduledNotificationAsync, updateScheduledNotificationAsync, deleteScheduledNotificationAsync, …
- `src/storage/repositories/GoalRepository.ts` — getCurrentDailyGoalAsync, getCurrentWeeklyGoalAsync, setDailyGoalAsync, setWeeklyGoalAsync, getDailyStreakAsync, getWeeklyStreakAsync
- `src/storage/repositories/LocationRepository.ts` — getKnownLocationsAsync, getAllKnownLocationsAsync, getSuggestedLocationsAsync, upsertKnownLocationAsync, denyKnownLocationAsync, deleteKnownLocationAsync
- `src/storage/repositories/WeatherRepository.ts` — saveWeatherConditionsAsync, getWeatherConditionsForHourAsync, saveWeatherCacheAsync, getWeatherCacheAsync, clearExpiredWeatherDataAsync
- `src/storage/dateHelpers.ts` — startOfDay, startOfWeek, startOfMonth, startOfNextMonth
- `src/storage/db.ts` — initDatabaseAsync, clearAllDataAsync, db, SEVEN_DAYS_MS
- `src/storage/repositories/LogRepository.ts` — insertBackgroundLogAsync, getBackgroundLogsAsync
- `src/storage/repositories/SettingRepository.ts` — getSettingAsync, setSettingAsync

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

## Hooks (6 files)

- `src/hooks/useGoalTargets.ts` — useGoalTargets, DAILY_PRESETS, WEEKLY_PRESETS
- `src/hooks/useOTAUpdates.ts` — useOTAUpdates, OTAUpdateStatus
- `src/hooks/useDetectionSettings.ts` — useDetectionSettings
- `src/hooks/useForegroundSync.ts` — useForegroundSync
- `src/hooks/useGoalIntegrations.ts` — useGoalIntegrations
- `src/hooks/useTheme.ts` — useTheme

## Weather (2 files)

- `src/weather/weatherService.ts` — fetchWeatherForecast, getWeatherForHour, isWeatherDataAvailable, WeatherFetchResult, FetchWeatherForecastOptions
- `src/weather/weatherAlgorithm.ts` — scoreWeatherCondition, getWeatherPreferences, getWeatherDescription, getWeatherEmoji

## Alarm-bridge-native (1 files)

- `modules/alarm-bridge-native/src/index.ts` — scheduleNextPulse, cancelPulse, PULSE_TASK_NAME

## AppBootstrap.ts (1 files)

- `appBootstrap.ts` — performCriticalInitializationAsync, performDeferredInitialization, CriticalAppState

## Calendar (1 files)

- `src/calendar/calendarService.ts` — cleanupTouchGrassCalendars, requestCalendarPermissions, hasCalendarPermissions, getWritableCalendars, getOrCreateTouchGrassCalendar, getSelectedCalendarId, …

## I18n (1 files)

- `src/i18n/index.ts` — resolveSupportedLocale, getDeviceSupportedLocale, t, localeTag, formatLocalDate, formatLocalTime, …

## Notifications (1 files)

- `src/notifications/reminderAlgorithm.ts` — scoreReminderHours, shouldRemindNow, ScoreContributor, HourScore

## Store (1 files)

- `src/store/useAppStore.ts` — triggerReminderFeedbackModal, FeedbackModalData, AppState, ThemePreference, FeedbackAction, useAppStore

---

_Back to [overview.md](./overview.md)_
