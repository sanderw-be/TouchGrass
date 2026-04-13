# touchgrass — AI Context Map

> **Stack:** raw-http | none | react | typescript

> 0 routes | 0 models | 38 components | 28 lib files | 2 env vars | 1 middleware | 0% test coverage
> **Token savings:** this file is ~4,500 tokens. Without it, AI exploration would cost ~29,300 tokens. **Saves ~24,800 tokens per conversation.**
> **Last scanned:** 2026-04-13 05:57 — re-run after significant changes

---

# Components

- **App** — `App.tsx`
- **DiagnosticSheet** — props: visible, onClose — `src/components/DiagnosticSheet.tsx`
- **EditLocationSheet** — props: visible, location, initialCoords, initialLabel, onClose, onSave — `src/components/EditLocationSheet.tsx`
- **EditSessionSheet** — props: visible, session, onClose, onSessionUpdated — `src/components/EditSessionSheet.tsx`
- **CRASH_REPORT_FORM_URL** — `src/components/ErrorBoundary.tsx`
- **ManualSessionSheet** — props: visible, onClose, onSessionLogged — `src/components/ManualSessionSheet.tsx`
- **PermissionExplainerSheet** — props: visible, onClose, onOpenSettings, title, body, openSettingsLabel, onDisable, disableLabel, onCancel — `src/components/PermissionExplainerSheet.tsx`
- **ProgressRing** — props: current, target, size, strokeWidth, label, onTimerPress, timerRunning, timerSeconds — `src/components/ProgressRing.tsx`
- **ReminderFeedbackModal** — `src/components/ReminderFeedbackModal.tsx`
- **SessionNotesSheet** — props: visible, session, onClose, onNoteSaved — `src/components/SessionNotesSheet.tsx`
- **UndoSnackbar** — props: visible, message, onUndo, onDismiss, duration — `src/components/UndoSnackbar.tsx`
- **UpdateSplashScreen** — props: status — `src/components/UpdateSplashScreen.tsx`
- **CalendarSection** — props: calendarEnabled, calendarPermissionGranted, calendarBuffer, calendarDuration, calendarSelectedId, calendarOptions, onToggleCalendar, onCycleCalendarBuffer, onCycleCalendarDuration, onSelectCalendar — `src/components/goals/CalendarSection.tsx`
- **SettingRow** — props: icon, label, sublabel, right — `src/components/goals/GoalsShared.tsx`
- **Divider** — `src/components/goals/GoalsShared.tsx`
- **PermissionToggleRow** — props: icon, label, desc, permissionMissingLabel, enabled, permissionGranted, onToggle, onPermissionFix — `src/components/goals/GoalsShared.tsx`
- **RemindersSection** — props: smartRemindersCount, catchupRemindersCount, notificationPermissionGranted, batteryOptimizationGranted, onCycleSmartReminders, onCycleCatchupReminders, onNavigateScheduledNotifications, onShowNotificationPermissionSheet, onShowBatteryPermissionSheet — `src/components/goals/RemindersSection.tsx`
- **WeatherSection** — props: weatherEnabled, weatherLocationGranted, onToggleWeather, onShowWeatherPermissionSheet, onNavigateWeatherSettings — `src/components/goals/WeatherSection.tsx`
- **IntroContext** — `src/context/IntroContext.tsx`
- **LanguageContext** — `src/context/LanguageContext.tsx`
- **ReminderFeedbackProvider** — `src/context/ReminderFeedbackContext.tsx`
- **ThemeProvider** — `src/context/ThemeContext.tsx`
- **AppNavigator** — props: initialState, onStateChange — `src/navigation/AppNavigator.tsx`
- **AboutAppScreen** — `src/screens/AboutAppScreen.tsx`
- **ActivityLogScreen** — `src/screens/ActivityLogScreen.tsx`
- **EventsScreen** — `src/screens/EventsScreen.tsx`
- **FeedbackSupportScreen** — `src/screens/FeedbackSupportScreen.tsx`
- **GoalsScreen** — `src/screens/GoalsScreen.tsx`
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

- `modules/alarm-bridge-native/src/index.ts`
  - function scheduleNextPulse: (delayMs) => Promise<void>
  - function cancelPulse: () => Promise<void>
  - const PULSE_TASK_NAME
- `src/background/alarmTiming.ts`
  - function computeNextSleepMs: (now) => void
  - function scheduleNextAlarmPulse: (now?) => Promise<void>
  - const PULSE_INTERVAL_DAY_MS
  - const PULSE_INTERVAL_NIGHT_MS
- `src/background/backgroundTick.ts` — function performBackgroundTick: () => Promise<void>
- `src/background/unifiedBackgroundTask.ts`
  - function registerUnifiedBackgroundTask: () => Promise<void>
  - function unregisterUnifiedBackgroundTask: () => Promise<void>
  - const UNIFIED_BACKGROUND_TASK
- `src/calendar/calendarService.ts`
  - function cleanupTouchGrassCalendars: () => Promise<CalendarCleanupResult>
  - function requestCalendarPermissions: () => Promise<boolean>
  - function hasCalendarPermissions: () => Promise<boolean>
  - function getWritableCalendars: () => Promise<Calendar.Calendar[]>
  - function getOrCreateTouchGrassCalendar: (forceCreate) => Promise<string | null>
  - function getSelectedCalendarId: () => string
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
- `src/i18n/index.ts`
  - function resolveSupportedLocale: (localeCode?) => SupportedLocale
  - function getDeviceSupportedLocale: () => SupportedLocale
  - function t: (key, options?, unknown>) => string
  - function localeTag: () => string
  - function formatLocalDate: (ms, options?) => string
  - function formatLocalTime: (ms) => string
  - _...1 more_
- `src/notifications/notificationManager.ts`
  - function \_resetSchedulingGuards: () => void
  - function logReminderQueueSnapshot: () => Promise<void>
  - function setupNotificationInfrastructure: () => Promise<void>
  - function requestNotificationPermissions: () => Promise<boolean>
  - function setupNotifications: () => Promise<void>
  - function scheduleNextReminder: () => Promise<void>
  - _...12 more_
- `src/notifications/reminderAlgorithm.ts`
  - function scoreReminderHours: (todayMinutes, dailyTargetMinutes, currentHour, currentMinute, plannedSlots) => Promise<HourScore[]>
  - function shouldRemindNow: (todayMinutes, dailyTargetMinutes, lastReminderMs, isCurrentlyOutside) => Promise<
  - interface ScoreContributor
  - interface HourScore
- `src/notifications/scheduledNotifications.ts`
  - function scheduleAllScheduledNotifications: () => Promise<void>
  - function cancelAllScheduledNotifications: () => Promise<void>
  - function isSlotNearScheduledNotification: (slotHour, slotMinute, windowMinutes) => Promise<boolean>
  - function hasScheduledNotificationNearby: (windowMinutes) => Promise<boolean>
- `src/storage/database.ts`
  - function initDatabase: () => void
  - function insertSession: (session) => number
  - function insertSessionAsync: (session) => Promise<number>
  - function getSessionsForDayAsync: (dateMs) => Promise<OutsideSession[]>
  - function getSessionsForRange: (fromMs, toMs) => OutsideSession[]
  - function getSessionsForRangeAsync: (fromMs, toMs) => Promise<OutsideSession[]>
  - _...81 more_
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

- `src/storage/database.ts` — imported by **71** files
- `src/i18n/index.ts` — imported by **45** files
- `src/context/ThemeContext.tsx` — imported by **30** files
- `src/utils/theme.ts` — imported by **27** files
- `src/utils/helpers.ts` — imported by **10** files
- `src/detection/index.ts` — imported by **9** files
- `src/utils/sessionsChangedEmitter.ts` — imported by **8** files
- `src/detection/manualCheckin.ts` — imported by **8** files
- `src/weather/weatherService.ts` — imported by **7** files
- `src/calendar/calendarService.ts` — imported by **6** files
- `src/utils/constants.ts` — imported by **6** files
- `src/notifications/notificationManager.ts` — imported by **6** files
- `src/detection/sessionMerger.ts` — imported by **6** files
- `src/utils/units.ts` — imported by **5** files
- `src/background/alarmTiming.ts` — imported by **4** files
- `src/navigation/AppNavigator.tsx` — imported by **4** files
- `src/context/ReminderFeedbackContext.tsx` — imported by **4** files
- `src/utils/widgetHelper.ts` — imported by **4** files
- `src/utils/temperature.ts` — imported by **4** files
- `src/context/LanguageContext.tsx` — imported by **3** files

## Import Map (who imports what)

- `src/storage/database.ts` ← `App.tsx`, `src/__tests__/App.test.tsx`, `src/__tests__/App.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx` +66 more
- `src/i18n/index.ts` ← `App.tsx`, `src/__tests__/App.test.tsx`, `src/__tests__/App.test.tsx`, `src/__tests__/ErrorBoundary.test.tsx`, `src/__tests__/FeedbackSupportScreen.test.tsx` +40 more
- `src/context/ThemeContext.tsx` ← `App.tsx`, `src/__tests__/ThemeContext.test.tsx`, `src/components/DiagnosticSheet.tsx`, `src/components/EditLocationSheet.tsx`, `src/components/EditSessionSheet.tsx` +25 more
- `src/utils/theme.ts` ← `src/__tests__/ThemeContext.test.tsx`, `src/components/DiagnosticSheet.tsx`, `src/components/EditLocationSheet.tsx`, `src/components/EditSessionSheet.tsx`, `src/components/ErrorBoundary.tsx` +22 more
- `src/utils/helpers.ts` ← `src/components/EditSessionSheet.tsx`, `src/components/ManualSessionSheet.tsx`, `src/components/ProgressRing.tsx`, `src/components/ReminderFeedbackModal.tsx`, `src/i18n/index.ts` +5 more
- `src/detection/index.ts` ← `App.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/SettingsScreen.test.tsx` +4 more
- `src/utils/sessionsChangedEmitter.ts` ← `src/__tests__/EventsScreen.test.tsx`, `src/__tests__/HomeScreen.test.tsx`, `src/__tests__/sessionsChangedEmitter.test.ts`, `src/detection/gpsDetection.ts`, `src/detection/healthConnect.ts` +3 more
- `src/detection/manualCheckin.ts` ← `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/widget-task-handler.test.tsx` +3 more
- `src/weather/weatherService.ts` ← `src/__tests__/backgroundService.test.ts`, `src/__tests__/backgroundTick.test.ts`, `src/__tests__/notificationManager.test.ts`, `src/__tests__/reminderAlgorithm.test.ts`, `src/background/backgroundTick.ts` +2 more
- `src/calendar/calendarService.ts` ← `App.tsx`, `src/__tests__/GoalsScreen.test.tsx`, `src/__tests__/notificationManager.test.ts`, `src/__tests__/permissionIssues.test.ts`, `src/screens/IntroScreen.tsx` +1 more

---

# Test Coverage

> **0%** of routes and models are covered by tests
> 61 test files found

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_
