# touchgrass — AI Context Map

> **Stack:** raw-http | none | react | typescript

> 0 routes | 0 models | 39 components | 30 lib files | 2 env vars | 1 middleware | 0% test coverage
> **Token savings:** this file is ~4,400 tokens. Without it, AI exploration would cost ~30,100 tokens. **Saves ~25,700 tokens per conversation.**
> **Last scanned:** 2026-04-19 13:02 — re-run after significant changes

---

# Components

- **App** — `App.tsx`
- **AppProviders** — `src/components/AppProviders.tsx`
- **DiagnosticSheet** — props: visible, onClose — `src/components/DiagnosticSheet.tsx`
- **EditLocationSheet** — props: visible, location, initialCoords, initialLabel, onClose, onSave — `src/components/EditLocationSheet.tsx`
- **EditSessionSheet** — props: visible, session, onClose, onSessionUpdated — `src/components/EditSessionSheet.tsx`
- **ErrorBoundary** — `src/components/ErrorBoundary.tsx`
- **ManualSessionSheet** — props: visible, onClose, onSessionLogged — `src/components/ManualSessionSheet.tsx`
- **PermissionExplainerSheet** — props: visible, onClose, onOpenSettings, title, body, openSettingsLabel, onDisable, disableLabel, onCancel — `src/components/PermissionExplainerSheet.tsx`
- **ProgressRing** — props: current, target, size, strokeWidth, label, onTimerPress, timerRunning, timerSeconds — `src/components/ProgressRing.tsx`
- **ReminderFeedbackModal** — `src/components/ReminderFeedbackModal.tsx`
- **SessionNotesSheet** — props: visible, session, onClose, onNoteSaved — `src/components/SessionNotesSheet.tsx`
- **DetectionSettingRow** — props: enabled, permissionGranted, icon, label, desc, permissionMissingLabel, onToggle, isLoading, isInitializing, onPermissionFix — `src/components/Settings/DetectionSettingRow.tsx`
- **Divider** — props: colors — `src/components/Settings/Divider.tsx`
- **SettingRow** — props: icon, label, sublabel, hint, right, colors — `src/components/Settings/SettingRow.tsx`
- **UndoSnackbar** — props: visible, message, onUndo, onDismiss, duration — `src/components/UndoSnackbar.tsx`
- **UpdateSplashScreen** — props: status — `src/components/UpdateSplashScreen.tsx`
- **CalendarSection** — props: calendarEnabled, calendarPermissionGranted, calendarBuffer, calendarDuration, calendarSelectedId, calendarOptions, onToggleCalendar, onCycleCalendarBuffer, onCycleCalendarDuration, onSelectCalendar — `src/components/goals/CalendarSection.tsx`
- **SettingRow** — props: icon, label, sublabel, right — `src/components/goals/GoalsShared.tsx`
- **Divider** — `src/components/goals/GoalsShared.tsx`
- **PermissionToggleRow** — props: icon, label, desc, permissionMissingLabel, enabled, permissionGranted, onToggle, onPermissionFix — `src/components/goals/GoalsShared.tsx`
- **RemindersSection** — props: smartRemindersCount, catchupRemindersCount, notificationPermissionGranted, batteryOptimizationGranted, onCycleSmartReminders, onCycleCatchupReminders, onNavigateScheduledNotifications, onShowNotificationPermissionSheet, onShowBatteryPermissionSheet — `src/components/goals/RemindersSection.tsx`
- **WeatherSection** — props: weatherEnabled, weatherLocationGranted, onToggleWeather, onShowWeatherPermissionSheet, onNavigateWeatherSettings — `src/components/goals/WeatherSection.tsx`
- **WeatherSettingsScreen** — `src/navigation/AppNavigator.tsx`
- **AboutAppScreen** — `src/screens/AboutAppScreen.tsx`
- **ActivityLogScreen** — `src/screens/ActivityLogScreen.tsx`
- **EventsScreen** — `src/screens/EventsScreen.tsx`
- **FeedbackSupportScreen** — `src/screens/FeedbackSupportScreen.tsx`
- **GoalsScreen** — `src/screens/GoalsScreen.tsx`
- **HealthConnectRationaleScreen** — `src/screens/HealthConnectRationaleScreen.tsx`
- **HistoryScreen** — `src/screens/HistoryScreen.tsx`
- **BarChart** — props: data, target, maxValue, period, isLoading — `src/screens/HistoryScreen.tsx`
- **HomeScreen** — `src/screens/HomeScreen.tsx`
- **IntroScreen** — props: onComplete — `src/screens/IntroScreen.tsx`
- **KnownLocationsScreen** — `src/screens/KnownLocationsScreen.tsx`
- **ScheduledNotificationsScreen** — `src/screens/ScheduledNotificationsScreen.tsx`
- **SettingsScreen** — `src/screens/SettingsScreen.tsx`
- **WeatherSettingsScreen** — `src/screens/WeatherSettingsScreen.tsx`
- **SkeletonWidget** — props: widgetWidth, widgetHeight — `src/widget/ProgressWidget.tsx`
- **ProgressWidget** — props: current, target, timerRunning, timerStartMs, widgetWidth, widgetHeight — `src/widget/ProgressWidget.tsx`

---

# Libraries

- `appBootstrap.ts`
  - function performCriticalInitializationAsync: () => Promise<CriticalAppState>
  - function performDeferredInitialization: () => void
  - interface CriticalAppState
- `modules/alarm-bridge-native/src/index.ts`
  - function scheduleNextPulse: (delayMs) => Promise<void>
  - function cancelPulse: () => Promise<void>
  - const PULSE_TASK_NAME
- `src/calendar/calendarService.ts`
  - function cleanupTouchGrassCalendars: () => Promise<CalendarCleanupResult>
  - function requestCalendarPermissions: () => Promise<boolean>
  - function hasCalendarPermissions: () => Promise<boolean>
  - function getWritableCalendars: () => Promise<Calendar.Calendar[]>
  - function getOrCreateTouchGrassCalendar: (forceCreate) => Promise<string | null>
  - function getSelectedCalendarId: () => Promise<string>
  - _...6 more_
- `src/detection/gpsDetection.ts`
  - function clampRadiusMeters: (r) => number
  - function loadGPSState: () => Promise<void>
  - function \_resetGPSStateForTesting: () => void
  - function requestLocationPermissions: () => Promise<boolean>
  - function computeMinActiveRadius: (locations) => number
  - function computeLowDistanceInterval: (minRadiusMeters) => number
  - _...19 more_
- `src/detection/healthConnect.ts`
  - function isHealthConnectAvailable: () => Promise<boolean>
  - function requestHealthPermissions: () => Promise<boolean>
  - function openHealthConnectForManagement: () => Promise<boolean>
  - function syncHealthConnect: () => Promise<boolean>
- `src/detection/healthConnectIntent.ts` — function openHealthConnectPermissionsViaIntent: () => Promise<boolean>, function verifyHealthConnectPermissions: () => Promise<boolean>
- `src/detection/index.ts`
  - function initDetection: () => Promise<DetectionStatus>
  - function requestHealthConnect: () => Promise<boolean>
  - function recheckHealthConnect: () => Promise<boolean>
  - function openHealthConnectSettings: () => Promise<boolean>
  - function getDetectionStatus: () => Promise<DetectionStatus>
  - function checkGPSPermissions: () => Promise<boolean>
  - _...6 more_
- `src/detection/manualCheckin.ts`
  - function logManualSession: (durationMinutes, startTime?, endTime?, notes?) => void
  - function logManualSessionAsync: (durationMinutes, startTime?, endTime?) => Promise<void>
  - function startManualSession: () => () => void
- `src/detection/sessionConfidence.ts`
  - function getTimeSlotProbability: (hour, dayOfWeek) => Promise<number>
  - function updateTimeSlotProbability: (hour, dayOfWeek, confirmed) => Promise<void>
  - function scoreDuration: (durationMs) => number
  - function computeSessionScore: (session) => Promise<number>
  - function computeSessionScoreFromProbs: (session, probs, number>) => number
  - const DISCARD_CONFIDENCE_THRESHOLD
  - _...1 more_
- `src/detection/sessionMerger.ts` — function submitSession: (candidate) => Promise<void>, function buildSession: (startTime, endTime, source, confidence, notes?, steps?, distanceMeters?, averageSpeedKmh?) => OutsideSession
- `src/hooks/useDetectionSettings.ts` — function useDetectionSettings: () => void
- `src/hooks/useForegroundSync.ts` — function useForegroundSync: () => void
- `src/hooks/useGoalIntegrations.ts` — function useGoalIntegrations: () => void
- `src/hooks/useGoalTargets.ts`
  - function useGoalTargets: () => void
  - const DAILY_PRESETS
  - const WEEKLY_PRESETS
- `src/hooks/useOTAUpdates.ts` — function useOTAUpdates: () => void, type OTAUpdateStatus
- `src/i18n/index.ts`
  - function resolveSupportedLocale: (localeCode?) => SupportedLocale
  - function getDeviceSupportedLocale: () => SupportedLocale
  - function t: (key, options?, unknown>) => string
  - function localeTag: () => string
  - function formatLocalDate: (ms, options?) => string
  - function formatLocalTime: (ms) => string
  - _...1 more_
- `src/notifications/reminderAlgorithm.ts`
  - function scoreReminderHours: (todayMinutes, dailyTargetMinutes, currentHour, currentMinute, plannedSlots) => Promise<HourScore[]>
  - function shouldRemindNow: (todayMinutes, dailyTargetMinutes, lastReminderMs, isCurrentlyOutside) => Promise<
  - interface ScoreContributor
  - interface HourScore
- `src/storage/database.ts`
  - function initDatabaseAsync: () => Promise<void>
  - function insertSessionAsync: (session) => Promise<number>
  - function getSessionsForDayAsync: (dateMs) => Promise<OutsideSession[]>
  - function getSessionsForRangeAsync: (fromMs, toMs) => Promise<OutsideSession[]>
  - function deleteSessionAsync: (id) => Promise<void>
  - function deleteSessionsByIdsAsync: (ids) => Promise<void>
  - _...57 more_
- `src/store/useAppStore.ts`
  - function triggerReminderFeedbackModal: (data) => void
  - interface FeedbackModalData
  - interface AppState
  - type ThemePreference
  - type FeedbackAction
  - const useAppStore
- `src/utils/batteryOptimization.ts`
  - function isBatteryOptimizationDisabled
  - function refreshBatteryOptimizationSetting
  - function openBatteryOptimizationSettings
  - const BATTERY_OPTIMIZATION_SETTING_KEY
- `src/utils/helpers.ts`
  - function uses24HourClock: () => boolean
  - function formatMinutes: (minutes) => string
  - function normalizeAmPm: (s) => string
  - function formatTime: (ms) => string
  - function formatDate: (ms) => string
  - function formatTimer: (seconds) => string
- `src/utils/permissionIssues.ts` — function countPermissionIssues: () => Promise<
- `src/utils/permissionIssuesChangedEmitter.ts` — function emitPermissionIssuesChanged: () => void, function onPermissionIssuesChanged: (listener) => () => void
- `src/utils/sessionsChangedEmitter.ts` — function emitSessionsChanged: () => void, function onSessionsChanged: (listener) => () => void
- `src/utils/temperature.ts`
  - function isFahrenheit: () => boolean
  - function celsiusToFahrenheit: (celsius) => number
  - function formatTemperature: (celsius) => string
- `src/utils/theme.ts`
  - function makeShadows: (themeColors) => Shadows
  - function progressColor: (percent) => string
  - type ThemeColors
  - type Shadows
  - const colors
  - const darkColors: typeof colors
  - _...4 more_
- `src/utils/units.ts`
  - function isImperialUnits: () => boolean
  - function metersToYards: (m) => number
  - function yardsToMeters: (yd) => number
  - function kmToMiles: (km) => number
  - function kmhToMph: (kmh) => number
- `src/utils/widgetHelper.ts`
  - function isWidgetTimerRunning: (marker) => boolean
  - function requestWidgetRefresh: () => Promise<void>
  - const WIDGET_TIMER_KEY
- `src/weather/weatherAlgorithm.ts`
  - function scoreWeatherCondition: (condition, preferences) => number
  - function getWeatherPreferences: () => Promise<WeatherPreferences>
  - function getWeatherDescription: (condition) => string
  - function getWeatherEmoji: (condition) => string
- `src/weather/weatherService.ts`
  - function fetchWeatherForecast: (options) => Promise<WeatherFetchResult>
  - function getWeatherForHour: (hour) => Promise<WeatherCondition | null>
  - function isWeatherDataAvailable: () => Promise<boolean>
  - interface WeatherFetchResult
  - interface FetchWeatherForecastOptions

---

# Config

## Environment Variables

- `EAS_BUILD_PROFILE` **required** — app.config.js
- `NODE_ENV` **required** — metro.config.js

## Config Files

- `tsconfig.json`

## Key Dependencies

- react: 19.2.0

---

# Middleware

## custom

- generate-play-store-notes — `scripts/generate-play-store-notes.js`

---

# Dependency Graph

## Most Imported Files (change these carefully)

- `src/storage/database.ts` — imported by **63** files
- `src/i18n/index.ts` — imported by **49** files
- `src/store/useAppStore.ts` — imported by **34** files
- `src/utils/theme.ts` — imported by **29** files
- `src/notifications/notificationManager.ts` — imported by **14** files
- `src/detection/index.ts` — imported by **12** files
- `src/utils/helpers.ts` — imported by **10** files
- `src/utils/sessionsChangedEmitter.ts` — imported by **8** files
- `src/detection/manualCheckin.ts` — imported by **8** files
- `src/background/unifiedBackgroundTask.ts` — imported by **7** files
- `src/utils/widgetHelper.ts` — imported by **7** files
- `src/calendar/calendarService.ts` — imported by **7** files
- `src/weather/weatherService.ts` — imported by **7** files
- `src/utils/constants.ts` — imported by **6** files
- `src/detection/sessionMerger.ts` — imported by **6** files
- `src/navigation/AppNavigator.tsx` — imported by **5** files
- `src/utils/units.ts` — imported by **5** files
- `src/components/goals/GoalsShared.tsx` — imported by **5** files
- `src/utils/batteryOptimization.ts` — imported by **4** files
- `src/utils/temperature.ts` — imported by **4** files

## Import Map (who imports what)

- `src/storage/database.ts` ← `appBootstrap.ts`, `src/__tests__/EditSessionSheet.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx` +58 more
- `src/i18n/index.ts` ← `appBootstrap.ts`, `src/__tests__/ErrorBoundary.test.tsx`, `src/__tests__/FeedbackSupportScreen.test.tsx`, `src/__tests__/appBootstrap.test.ts`, `src/__tests__/i18n.test.ts` +44 more
- `src/store/useAppStore.ts` ← `App.tsx`, `src/__tests__/App.test.tsx`, `src/__tests__/notificationManager.test.ts`, `src/__tests__/useAppStore.test.ts`, `src/components/DiagnosticSheet.tsx` +29 more
- `src/utils/theme.ts` ← `src/components/DiagnosticSheet.tsx`, `src/components/EditLocationSheet.tsx`, `src/components/EditSessionSheet.tsx`, `src/components/ErrorBoundary.tsx`, `src/components/ManualSessionSheet.tsx` +24 more
- `src/notifications/notificationManager.ts` ← `appBootstrap.ts`, `src/__tests__/appBootstrap.test.ts`, `src/__tests__/backgroundService.test.ts`, `src/__tests__/backgroundTick.test.ts`, `src/__tests__/notificationManager.test.ts` +9 more
- `src/detection/index.ts` ← `appBootstrap.ts`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx` +7 more
- `src/utils/helpers.ts` ← `src/components/EditSessionSheet.tsx`, `src/components/ManualSessionSheet.tsx`, `src/components/ProgressRing.tsx`, `src/components/ReminderFeedbackModal.tsx`, `src/i18n/index.ts` +5 more
- `src/utils/sessionsChangedEmitter.ts` ← `src/__tests__/EventsScreen.test.tsx`, `src/__tests__/HomeScreen.test.tsx`, `src/__tests__/sessionsChangedEmitter.test.ts`, `src/detection/gpsDetection.ts`, `src/detection/healthConnect.ts` +3 more
- `src/detection/manualCheckin.ts` ← `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/widget-task-handler.test.tsx` +3 more
- `src/background/unifiedBackgroundTask.ts` ← `appBootstrap.ts`, `index.ts`, `src/__tests__/appBootstrap.test.ts`, `src/__tests__/backgroundService.test.ts`, `src/__tests__/backgroundTick.test.ts` +2 more

---

# Test Coverage

> **0%** of routes and models are covered by tests
> 65 test files found

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_
