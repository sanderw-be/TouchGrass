# touchgrass — AI Context Map

> **Stack:** raw-http | none | react | typescript

> 0 routes | 0 models | 39 components | 58 lib files | 3 env vars | 1 middleware | 0% test coverage
> **Token savings:** this file is ~6.300 tokens. Without it, AI exploration would cost ~37.500 tokens. **Saves ~31.200 tokens per conversation.**
> **Last scanned:** 2026-05-03 05:25 — re-run after significant changes

---

# Components

- **App** — `App.tsx`
- **AppProviders** — `src\components\AppProviders.tsx`
- **DiagnosticSheet** — props: visible, onClose — `src\components\DiagnosticSheet.tsx`
- **EditLocationSheet** — props: visible, location, initialCoords, initialLabel, onClose, onSave — `src\components\EditLocationSheet.tsx`
- **EditSessionSheet** — props: visible, session, onClose, onSessionUpdated — `src\components\EditSessionSheet.tsx`
- **ErrorBoundary** — `src\components\ErrorBoundary.tsx`
- **CalendarSection** — props: calendarEnabled, calendarPermissionGranted, calendarBuffer, calendarDuration, calendarSelectedId, calendarOptions, onToggleCalendar, onCycleCalendarBuffer, onCycleCalendarDuration, onSelectCalendar — `src\components\goals\CalendarSection.tsx`
- **CATCHUP_REMINDERS_OPTIONS** — `src\components\goals\GoalsShared.tsx`
- **RemindersSection** — props: smartRemindersCount, catchupRemindersCount, notificationPermissionGranted, batteryOptimizationGranted, onCycleSmartReminders, onCycleCatchupReminders, onNavigateScheduledNotifications, onShowNotificationPermissionSheet, onShowBatteryPermissionSheet — `src\components\goals\RemindersSection.tsx`
- **WeatherSection** — props: weatherEnabled, weatherLocationGranted, onToggleWeather, onShowWeatherPermissionSheet, onNavigateWeatherSettings — `src\components\goals\WeatherSection.tsx`
- **ManualSessionSheet** — props: visible, onClose, onSessionLogged — `src\components\ManualSessionSheet.tsx`
- **PermissionExplainerSheet** — props: visible, onClose, onOpenSettings, title, body, openSettingsLabel, onDisable, disableLabel, onCancel — `src\components\PermissionExplainerSheet.tsx`
- **ProgressRing** — props: current, target, size, strokeWidth, label, onTimerPress, timerRunning, timerSeconds — `src\components\ProgressRing.tsx`
- **ReminderFeedbackModal** — `src\components\ReminderFeedbackModal.tsx`
- **ResponsiveGridList** — props: data, renderItem — `src\components\ResponsiveGridList.tsx`
- **SessionNotesSheet** — props: visible, session, onClose, onNoteSaved — `src\components\SessionNotesSheet.tsx`
- **Divider** — props: style, inset — `src\components\ui\atoms\Divider.tsx`
- **DetectionSettingRow** — props: enabled, permissionGranted, icon, label, desc, permissionMissingLabel, onToggle, isLoading, isInitializing, onPermissionFix — `src\components\ui\molecules\DetectionSettingRow.tsx`
- **PermissionToggleRow** — props: icon, label, desc, permissionMissingLabel, enabled, permissionGranted, onToggle, onPermissionFix, style — `src\components\ui\molecules\PermissionToggleRow.tsx`
- **SettingRow** — props: icon, label, sublabel, hint, right, style, disabled — `src\components\ui\molecules\SettingRow.tsx`
- **UndoSnackbar** — props: visible, message, onUndo, onDismiss, duration — `src\components\UndoSnackbar.tsx`
- **UpdateSplashScreen** — props: status — `src\components\UpdateSplashScreen.tsx`
- **WeatherSettingsScreen** — `src\navigation\AppNavigator.tsx`
- **AboutAppScreen** — `src\screens\AboutAppScreen.tsx`
- **ActivityLogScreen** — `src\screens\ActivityLogScreen.tsx`
- **EventsScreen** — `src\screens\EventsScreen.tsx`
- **FeedbackSupportScreen** — `src\screens\FeedbackSupportScreen.tsx`
- **GoalsScreen** — `src\screens\GoalsScreen.tsx`
- **HealthConnectRationaleScreen** — `src\screens\HealthConnectRationaleScreen.tsx`
- **HistoryScreen** — `src\screens\HistoryScreen.tsx`
- **BarChart** — props: data, target, maxValue, period, isLoading — `src\screens\HistoryScreen.tsx`
- **HomeScreen** — `src\screens\HomeScreen.tsx`
- **IntroScreen** — props: onComplete — `src\screens\IntroScreen.tsx`
- **KnownLocationsScreen** — `src\screens\KnownLocationsScreen.tsx`
- **ScheduledNotificationsScreen** — `src\screens\ScheduledNotificationsScreen.tsx`
- **SettingsScreen** — `src\screens\SettingsScreen.tsx`
- **WeatherSettingsScreen** — `src\screens\WeatherSettingsScreen.tsx`
- **SkeletonWidget** — props: widgetWidth, widgetHeight — `src\widget\ProgressWidget.tsx`
- **ProgressWidget** — props: current, target, timerRunning, timerStartMs, widgetWidth, widgetHeight — `src\widget\ProgressWidget.tsx`

---

# Libraries

- `appBootstrap.ts`
  - function performCriticalInitializationAsync: () => Promise<CriticalAppState>
  - function performDeferredInitialization: () => void
  - interface CriticalAppState
- `src\background\smartReminderTask.ts` — function handleSmartReminder
- `src\calendar\calendarService.ts`
  - function cleanupTouchGrassCalendars: () => Promise<CalendarCleanupResult>
  - function requestCalendarPermissions: () => Promise<
  - function hasCalendarPermissions: () => Promise<boolean>
  - function getWritableCalendars: () => Promise<Calendar.Calendar[]>
  - function getOrCreateTouchGrassCalendar: (forceCreate) => Promise<string | null>
  - function getSelectedCalendarId: () => Promise<string>
  - _...6 more_
- `src\core\container.ts`
  - function createContainer: (db) => IAppContainer
  - function getContainer: () => IAppContainer
  - interface IAppContainer
- `src\detection\GeofenceManager.ts`
  - function isAtKnownIndoorLocation: (lat, lon, locations) => boolean
  - function wasDefinitelyAtKnownIndoorLocationSync: (startMs, endMs, allSamples, knownLocations) => boolean
  - function shouldTriggerBurst: (lat, lon, locations, now, lastBurstAtTimestamp, currentProfile, locationAccuracy?) => boolean
  - function computeMinActiveRadius: (locations) => number
  - function clampRadiusMeters: (radius) => number
  - function createClusterObject: (samples) => LocationCluster
  - _...4 more_
- `src\detection\gpsDetection.ts`
  - function loadGPSState: () => Promise<void>
  - function requestLocationPermissions: () => Promise<
  - function computeMinActiveRadius: (locations) => number
  - function startLocationTracking: (profile, minRadiusMeters) => Promise<void>
  - function stopLocationTracking: () => Promise<void>
  - function startGeofenceTracking: () => Promise<void>
  - _...4 more_
- `src\detection\GpsSessionBuilder.ts` — function buildGpsNotes: (startLocationLabel, endLocationLabel, distanceMeters, averageSpeedKmh) => string
- `src\detection\healthConnect.ts`
  - function isHealthConnectAvailable: () => Promise<boolean>
  - function requestHealthPermissions: () => Promise<boolean>
  - function openHealthConnectForManagement: () => Promise<boolean>
  - function syncHealthConnect: () => Promise<boolean>
- `src\detection\healthConnectIntent.ts` — function openHealthConnectPermissionsViaIntent: () => Promise<boolean>, function verifyHealthConnectPermissions: () => Promise<boolean>
- `src\detection\HealthSessionBuilder.ts` — class HealthSessionBuilder
- `src\detection\index.ts`
  - function initDetection: () => Promise<DetectionStatus>
  - function checkWeatherLocationPermissions: () => Promise<boolean>
  - function requestWeatherLocationPermissions: () => Promise<boolean>
  - function checkGPSPermissions: () => Promise<boolean>
  - function requestGPSPermissions: () => Promise<
  - function refreshDetectionSync: () => Promise<void>
  - _...5 more_
- `src\detection\LocationTracker.ts` — class LocationTracker
- `src\detection\manualCheckin.ts`
  - function logManualSession: (durationMinutes, startTime?, endTime?, notes?) => void
  - function logManualSessionAsync: (durationMinutes, startTime?, endTime?) => Promise<void>
  - function startManualSession: () => () => void
- `src\detection\PermissionService.ts` — class PermissionService
- `src\detection\sessionConfidence.ts`
  - function loadTimeSlotProbabilities: () => Promise<Record<string, number>>
  - function getTimeSlotProbability: (hour, dayOfWeek) => Promise<number>
  - function updateTimeSlotProbability: (hour, dayOfWeek, confirmed) => Promise<void>
  - function scoreDuration: (durationMs) => number
  - function computeSessionScore: (session) => Promise<number>
  - function computeSessionScoreFromProbs: (session, probs, number>) => number
- `src\detection\sessionMerger.ts` — function submitSession: (candidate) => Promise<void>, function buildSession: (startTime, endTime, source, confidence, notes?, steps?, distanceMeters?, averageSpeedKmh?) => OutsideSession
- `src\detection\utils.ts` — function haversineDistance: (lat1, lon1, lat2, lon2) => number, const EARTH_RADIUS_METERS
- `src\domain\GoalDomain.ts`
  - function validateDailyGoal: (minutes) => boolean
  - function validateWeeklyGoal: (minutes) => boolean
  - const DAILY_PRESETS
  - const WEEKLY_PRESETS
  - const MIN_DAILY_MINUTES
  - const MAX_DAILY_MINUTES
  - _...2 more_
- `src\domain\ReminderDomain.ts`
  - function isPermissionIssue: (enabled, permissionGranted) => boolean
  - function getPermissionIssueLabels: (smartRemindersCount, notificationPermissionGranted, weatherEnabled, weatherLocationGranted, calendarEnabled, calendarPermissionGranted, labels) => string[]
  - const SMART_REMINDERS_OPTIONS
  - const CALENDAR_BUFFER_OPTIONS
  - const CALENDAR_DURATION_OPTIONS
- `src\domain\ScoringDomain.ts`
  - function calculateUpdatedProbability: (currentProb, confirmed) => number
  - function scoreDuration: (durationMs) => number
  - function calculateSessionScore: (baseConfidence, durationMs, timeSlotProb) => number
  - const DISCARD_CONFIDENCE_THRESHOLD
  - const DEFAULT_TIME_SLOT_PROBABILITY
- `src\domain\SessionDomain.ts`
  - function mergeSessionData: (candidate, unconfirmedSessions) => MergedSessionData
  - function calculateMergedSpeed: (durationMs, distanceMeters?, steps?, stepsPerMinBaseline, speedBaselineKmh) => number | undefined
  - function splitRangeAroundConfirmed: (rangeStart, rangeEnd, confirmedSessions) => [number, number][]
  - interface MergedSessionData
- `src\hooks\useDetectionSettings.ts` — function useDetectionSettings: () => void
- `src\hooks\useForegroundSync.ts` — function useForegroundSync: () => void
- `src\hooks\useGoalIntegrations.ts` — function useGoalIntegrations: () => void
- `src\hooks\useGoalTargets.ts` — function useGoalTargets: () => void
- `src\hooks\useOTAUpdates.ts` — function useOTAUpdates: () => void, type OTAUpdateStatus
- `src\hooks\useTheme.ts` — function useTheme: () => void
- `src\i18n\index.ts`
  - function resolveSupportedLocale: (localeCode?) => SupportedLocale
  - function getDeviceSupportedLocale: () => SupportedLocale
  - function t: (key, options?, unknown>) => string
  - function localeTag: () => string
  - function formatLocalDate: (ms, options?) => string
  - function formatLocalTime: (ms) => string
  - _...2 more_
- `src\navigation\navigationRef.ts` — function navigate: (name, params?) => void, const navigationRef
- `src\notifications\notificationManager.ts`
  - function getNotificationInfrastructureService
  - function getSmartReminderScheduler
  - function getScheduledNotificationManager
  - function getNotificationResponseHandler
  - function getReminderQueueManager
  - function getReminderMessageBuilder
  - _...1 more_
- `src\notifications\reminderAlgorithm.ts`
  - function scoreReminderHours: (todayMinutes, dailyTargetMinutes, currentHour, currentMinute, plannedSlots, baseDateMs) => void
  - function shouldRemindNow: (todayMinutes, dailyTargetMinutes, lastReminderMs, isCurrentlyOutside) => Promise<
  - interface ScoreContributor
  - interface HourScore
- `src\notifications\services\NotificationInfrastructureService.ts`
  - class NotificationInfrastructureService
  - interface INotificationInfrastructureService
  - const ACTION_WENT_OUTSIDE
  - const ACTION_SNOOZE
  - const ACTION_LESS_OFTEN
  - const CHANNEL_ID
  - _...3 more_
- `src\notifications\services\NotificationResponseHandler.ts` — class NotificationResponseHandler, interface INotificationResponseHandler
- `src\notifications\services\ReminderMessageBuilder.ts` — class ReminderMessageBuilder, interface IReminderMessageBuilder
- `src\notifications\services\ReminderQueueManager.ts` — class ReminderQueueManager, interface IReminderQueueManager
- `src\notifications\services\ScheduledNotificationManager.ts`
  - class ScheduledNotificationManager
  - interface IScheduledNotificationManager
  - const SCHEDULED_NOTIF_PREFIX
- `src\notifications\services\SmartReminderScheduler.ts`
  - class SmartReminderScheduler
  - interface ReplanOptions
  - interface ISmartReminderScheduler
  - const FAILSAFE_REMINDER_PREFIX
- `src\storage\dateHelpers.ts`
  - function startOfDay: (ms) => number
  - function startOfWeek: (ms) => number
  - function startOfMonth: (ms) => number
  - function startOfNextMonth: (ms) => number
- `src\storage\db.ts`
  - function initDatabaseAsync: () => Promise<void>
  - function clearAllDataAsync: () => Promise<void>
  - const db
  - const SEVEN_DAYS_MS
- `src\storage\repositories\GoalRepository.ts`
  - function getCurrentDailyGoalAsync: () => Promise<DailyGoal | null>
  - function getCurrentWeeklyGoalAsync: () => Promise<WeeklyGoal | null>
  - function setDailyGoalAsync: (minutes) => Promise<void>
  - function setWeeklyGoalAsync: (minutes) => Promise<void>
  - function getDailyStreakAsync: () => Promise<number>
  - function getWeeklyStreakAsync: () => Promise<number>
- `src\storage\repositories\LocationRepository.ts`
  - function getKnownLocationsAsync: () => Promise<KnownLocation[]>
  - function getAllKnownLocationsAsync: () => Promise<KnownLocation[]>
  - function getSuggestedLocationsAsync: () => Promise<KnownLocation[]>
  - function upsertKnownLocationAsync: (loc) => Promise<void>
  - function denyKnownLocationAsync: (id) => Promise<void>
  - function deleteKnownLocationAsync: (id) => Promise<void>
- `src\storage\repositories\LogRepository.ts` — function insertBackgroundLogAsync: (category, message) => Promise<void>, function getBackgroundLogsAsync: (category?, limit) => Promise<BackgroundTaskLog[]>
- `src\storage\repositories\NotificationRepository.ts`
  - function insertReminderFeedbackAsync: (feedback) => Promise<void>
  - function getReminderFeedbackAsync: () => Promise<ReminderFeedback[]>
  - function getScheduledNotificationsAsync: () => Promise<ScheduledNotification[]>
  - function insertScheduledNotificationAsync: (notification, 'id'>) => Promise<number>
  - function updateScheduledNotificationAsync: (notification) => Promise<void>
  - function deleteScheduledNotificationAsync: (id) => Promise<void>
  - _...2 more_
- `src\storage\repositories\SessionRepository.ts`
  - function insertSessionAsync: (session) => Promise<number>
  - function getSessionsForDayAsync: (dateMs) => Promise<OutsideSession[]>
  - function getSessionsForRangeAsync: (fromMs, toMs) => Promise<OutsideSession[]>
  - function deleteSessionAsync: (id) => Promise<void>
  - function deleteSessionsByIdsAsync: (ids) => Promise<void>
  - function insertSessionsBatchAsync: (sessions) => Promise<number[]>
  - _...14 more_
- `src\storage\repositories\SettingRepository.ts` — function getSettingAsync: (key, fallback) => Promise<string>, function setSettingAsync: (key, value) => Promise<void>
- `src\storage\repositories\WeatherRepository.ts`
  - function saveWeatherConditionsAsync: (conditions) => Promise<void>
  - function getWeatherConditionsForHourAsync: (forecastDate, startHour, endHour) => Promise<WeatherCondition[]>
  - function saveWeatherCacheAsync: (cache) => Promise<void>
  - function getWeatherCacheAsync: () => Promise<WeatherCache | null>
  - function clearExpiredWeatherDataAsync: (now) => Promise<void>
- `src\storage\StorageService.ts` — class StorageService, interface IStorageService
- `src\utils\batteryOptimization.ts`
  - function isBatteryOptimizationDisabled
  - function refreshBatteryOptimizationSetting
  - function openBatteryOptimizationSettings
  - const BATTERY_OPTIMIZATION_SETTING_KEY
- `src\utils\helpers.ts`
  - function uses24HourClock: () => boolean
  - function formatMinutes: (minutes) => string
  - function normalizeAmPm: (s) => string
  - function formatTime: (ms) => string
  - function formatDate: (ms) => string
  - function formatTimer: (seconds) => string
- `src\utils\permissionIssues.ts` — function countPermissionIssues: () => Promise<
- `src\utils\permissionIssuesChangedEmitter.ts` — function emitPermissionIssuesChanged: () => void, function onPermissionIssuesChanged: (listener) => () => void
- `src\utils\sessionsChangedEmitter.ts` — function emitSessionsChanged: () => void, function onSessionsChanged: (listener) => () => void
- `src\utils\temperature.ts`
  - function isFahrenheit: () => boolean
  - function celsiusToFahrenheit: (celsius) => number
  - function formatTemperature: (celsius) => string
- `src\utils\theme.ts`
  - function makeShadows: (themeColors) => Shadows
  - function progressColor: (percent) => string
  - type ThemeColors
  - type Shadows
  - const colors
  - const darkColors: typeof colors
  - _...4 more_
- `src\utils\units.ts`
  - function isImperialUnits: () => boolean
  - function metersToYards: (m) => number
  - function yardsToMeters: (yd) => number
  - function kmToMiles: (km) => number
  - function kmhToMph: (kmh) => number
- `src\utils\widgetHelper.ts`
  - function isWidgetTimerRunning: (marker) => boolean
  - function requestWidgetRefresh: () => Promise<void>
  - const WIDGET_TIMER_KEY
- `src\weather\weatherAlgorithm.ts`
  - function scoreWeatherCondition: (condition, preferences) => number
  - function getWeatherPreferences: () => Promise<WeatherPreferences>
  - function getWeatherDescription: (condition) => TxKey
  - function getWeatherEmoji: (condition) => string
- `src\weather\weatherService.ts`
  - function fetchWeatherForecast: (options) => Promise<WeatherFetchResult>
  - function getWeatherForHour: (hour, dateMs) => void
  - function isWeatherDataAvailable: () => Promise<boolean>
  - interface WeatherFetchResult
  - interface FetchWeatherForecastOptions

---

# Config

## Environment Variables

- `EAS_BUILD_PROFILE` **required** — app.config.js
- `EXPO_PUBLIC_SHOW_DEV_MENU` **required** — src\screens\SettingsScreen.tsx
- `NODE_ENV` **required** — metro.config.js

## Config Files

- `tsconfig.json`

## Key Dependencies

- react: 19.2.0

---

# Middleware

## custom

- generate-play-store-notes — `scripts\generate-play-store-notes.js`

---

# Dependency Graph

## Most Imported Files (change these carefully)

- `src\utils\theme.ts` — imported by **38** files
- `src\store\useAppStore.ts` — imported by **33** files
- `src\notifications\notificationManager.ts` — imported by **12** files
- `src\components\ResponsiveGridList.tsx` — imported by **11** files
- `src\storage\StorageService.ts` — imported by **10** files
- `src\utils\helpers.ts` — imported by **10** files
- `src\storage\db.ts` — imported by **10** files
- `src\utils\sessionsChangedEmitter.ts` — imported by **9** files
- `src\storage\types.ts` — imported by **9** files
- `src\detection\index.ts` — imported by **8** files
- `src\detection\manualCheckin.ts` — imported by **8** files
- `src\i18n\en.ts` — imported by **8** files
- `src\utils\widgetHelper.ts` — imported by **7** files
- `src\detection\sessionMerger.ts` — imported by **7** files
- `src\weather\weatherService.ts` — imported by **7** files
- `src\hooks\useTheme.ts` — imported by **6** files
- `src\detection\PermissionService.ts` — imported by **6** files
- `src\calendar\calendarService.ts` — imported by **6** files
- `src\utils\constants.ts` — imported by **6** files
- `src\navigation\AppNavigator.tsx` — imported by **5** files

## Import Map (who imports what)

- `src\utils\theme.ts` ← `src\background\geofenceTask.ts`, `src\background\smartReminderTask.ts`, `src\components\DiagnosticSheet.tsx`, `src\components\EditLocationSheet.tsx`, `src\components\EditSessionSheet.tsx` +33 more
- `src\store\useAppStore.ts` ← `App.tsx`, `src\components\DiagnosticSheet.tsx`, `src\components\EditLocationSheet.tsx`, `src\components\EditSessionSheet.tsx`, `src\components\ErrorBoundary.tsx` +28 more
- `src\notifications\notificationManager.ts` ← `src\background\smartReminderTask.ts`, `src\hooks\useForegroundSync.ts`, `src\hooks\useGoalIntegrations.ts`, `src\notifications\services\ReminderQueueManager.ts`, `src\notifications\services\SmartReminderScheduler.ts` +7 more
- `src\components\ResponsiveGridList.tsx` ← `src\screens\AboutAppScreen.tsx`, `src\screens\ActivityLogScreen.tsx`, `src\screens\EventsScreen.tsx`, `src\screens\FeedbackSupportScreen.tsx`, `src\screens\GoalsScreen.tsx` +6 more
- `src\storage\StorageService.ts` ← `src\background\smartReminderTask.ts`, `src\core\container.ts`, `src\notifications\services\NotificationResponseHandler.ts`, `src\notifications\services\ReminderMessageBuilder.ts`, `src\notifications\services\ReminderQueueManager.ts` +5 more
- `src\utils\helpers.ts` ← `src\components\EditSessionSheet.tsx`, `src\components\ManualSessionSheet.tsx`, `src\components\ProgressRing.tsx`, `src\components\ReminderFeedbackModal.tsx`, `src\i18n\index.ts` +5 more
- `src\storage\db.ts` ← `src\storage\index.ts`, `src\storage\repositories\GoalRepository.ts`, `src\storage\repositories\LocationRepository.ts`, `src\storage\repositories\LogRepository.ts`, `src\storage\repositories\NotificationRepository.ts` +5 more
- `src\utils\sessionsChangedEmitter.ts` ← `src\background\geofenceTask.ts`, `src\detection\HealthSessionBuilder.ts`, `src\detection\LocationTracker.ts`, `src\navigation\AppNavigator.tsx`, `src\screens\EventsScreen.tsx` +4 more
- `src\storage\types.ts` ← `src\domain\SessionDomain.ts`, `src\storage\index.ts`, `src\storage\repositories\GoalRepository.ts`, `src\storage\repositories\LocationRepository.ts`, `src\storage\repositories\LogRepository.ts` +4 more
- `src\detection\index.ts` ← `appBootstrap.ts`, `src\screens\HealthConnectRationaleScreen.tsx`, `src\screens\KnownLocationsScreen.tsx`, `src\__tests__\detectionBackgroundTask.test.ts`, `src\__tests__\IntroScreen.test.tsx` +3 more

---

# Test Coverage

> **0%** of routes and models are covered by tests
> 65 test files found

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_
