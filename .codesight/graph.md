# Dependency Graph

## Most Imported Files (change these carefully)

- `src\storage\database.ts` — imported by **72** files
- `src\context\ThemeContext.tsx` — imported by **31** files
- `src\utils\theme.ts` — imported by **27** files
- `src\utils\helpers.ts` — imported by **10** files
- `src\notifications\notificationManager.ts` — imported by **9** files
- `src\detection\index.ts` — imported by **8** files
- `src\detection\manualCheckin.ts` — imported by **8** files
- `src\utils\sessionsChangedEmitter.ts` — imported by **8** files
- `src\background\alarmTiming.ts` — imported by **7** files
- `src\utils\widgetHelper.ts` — imported by **7** files
- `src\weather\weatherService.ts` — imported by **7** files
- `src\calendar\calendarService.ts` — imported by **7** files
- `src\detection\sessionMerger.ts` — imported by **6** files
- `src\utils\constants.ts` — imported by **6** files
- `src\utils\units.ts` — imported by **5** files
- `src\navigation\AppNavigator.tsx` — imported by **4** files
- `src\utils\batteryOptimization.ts` — imported by **4** files
- `src\context\ReminderFeedbackContext.tsx` — imported by **4** files
- `src\utils\temperature.ts` — imported by **4** files
- `src\context\LanguageContext.tsx` — imported by **3** files

## Import Map (who imports what)

- `src\storage\database.ts` ← `src\background\backgroundTick.ts`, `src\calendar\calendarService.ts`, `src\components\EditSessionSheet.tsx`, `src\components\ReminderFeedbackModal.tsx`, `src\components\SessionNotesSheet.tsx` +67 more
- `src\context\ThemeContext.tsx` ← `App.tsx`, `src\components\AppProviders.tsx`, `src\components\DiagnosticSheet.tsx`, `src\components\EditLocationSheet.tsx`, `src\components\EditSessionSheet.tsx` +26 more
- `src\utils\theme.ts` ← `src\components\DiagnosticSheet.tsx`, `src\components\EditLocationSheet.tsx`, `src\components\EditSessionSheet.tsx`, `src\components\ErrorBoundary.tsx`, `src\components\goals\GoalsShared.tsx` +22 more
- `src\utils\helpers.ts` ← `src\components\EditSessionSheet.tsx`, `src\components\ManualSessionSheet.tsx`, `src\components\ProgressRing.tsx`, `src\components\ReminderFeedbackModal.tsx`, `src\i18n\index.ts` +5 more
- `src\notifications\notificationManager.ts` ← `src\hooks\useForegroundSync.ts`, `src\screens\EventsScreen.tsx`, `src\screens\GoalsScreen.tsx`, `src\screens\HomeScreen.tsx`, `src\screens\IntroScreen.tsx` +4 more
- `src\detection\index.ts` ← `appBootstrap.ts`, `src\screens\KnownLocationsScreen.tsx`, `src\__tests__\appBootstrap.test.ts`, `src\__tests__\detectionBackgroundTask.test.ts`, `src\__tests__\IntroScreen.test.tsx` +3 more
- `src\detection\manualCheckin.ts` ← `src\components\ManualSessionSheet.tsx`, `src\screens\HomeScreen.tsx`, `src\widget\widget-task-handler.tsx`, `src\__tests__\ManualSessionSheet.test.tsx`, `src\__tests__\ManualSessionSheet.test.tsx` +3 more
- `src\utils\sessionsChangedEmitter.ts` ← `src\detection\gpsDetection.ts`, `src\detection\healthConnect.ts`, `src\navigation\AppNavigator.tsx`, `src\screens\EventsScreen.tsx`, `src\screens\HomeScreen.tsx` +3 more
- `src\background\alarmTiming.ts` ← `appBootstrap.ts`, `index.ts`, `src\background\unifiedBackgroundTask.ts`, `src\hooks\useForegroundSync.ts`, `src\__tests__\appBootstrap.test.ts` +2 more
- `src\utils\widgetHelper.ts` ← `appBootstrap.ts`, `src\hooks\useForegroundSync.ts`, `src\screens\EventsScreen.tsx`, `src\widget\widget-task-handler.tsx`, `src\__tests__\appBootstrap.test.ts` +2 more
