# UI

> **Navigation aid.** Component inventory and prop signatures extracted via AST. Read the source files before adding props or modifying component logic.

**39 components** (react)

## Components

- **App** — `App.tsx`
- **AppProviders** — `src/components/AppProviders.tsx`
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

_Back to [overview.md](./overview.md)_
