# TouchGrass 🌱 - AI Context

TouchGrass is a privacy-focused React Native (Expo) application designed to encourage outdoor activity through tracking, goal setting, and smart reminders.

## Project Overview

- **Purpose**: Track outdoor time automatically and manually, set goals, and provide reminders based on weather and schedules.
- **Platform**: Cross-platform (Android-first with Health Connect, iOS coming soon).
- **Core Technologies**:
  - **Framework**: Expo 55.x (React Native 0.83.x)
  - **Language**: TypeScript (Strict Mode)
  - **Database**: SQLite (`expo-sqlite`) for local storage.
  - **Navigation**: React Navigation 7.x (Stack + Bottom Tabs)
  - **Styling**: Vanilla CSS / React Native StyleSheet (Theme-aware via `useAppStore`).
  - **State Management**: Zustand (`src/store/useAppStore.ts`) for global app state (Theme, Locale, Intro, Feedback).
  - **Detection**: Background location (Geofencing) and Health Connect (Exercise/Steps).
  - **Notifications**: `expo-notifications` for smart reminders.
  - **Android Specific**: Custom Android widgets (`react-native-android-widget`) and native alarm bridge for precise background execution.

## Key Directories

- `src/background/`: Unified background tasks and alarm timing logic.
- `src/calendar/`: Integration with device calendars.
- `src/components/`: Reusable UI components.
- `src/store/`: Zustand state management (Theme, Language, Feedback, etc.).
- `src/detection/`: Logic for GPS and Health Connect outdoor detection.
- `src/hooks/`: Custom React hooks (Init, Foreground sync, OTA updates).
- `src/i18n/`: Internationalization files (English `en`, Dutch `nl`).
- `src/navigation/`: App routing and navigation config.
- `src/notifications/`: Reminder scheduling and notification management.
- `src/screens/`: Full-page screen components.
- `src/storage/`: SQLite database schema, queries, and migrations.
- `src/utils/`: Theme helpers, unit converters, and general utilities.
- `src/widget/`: Android home screen widget task handler and layout.
- `src/__tests__/`: Comprehensive Jest test suite.

## Building and Running

- `npm start`: Starts the Expo development server.
- `npm run android`: Runs the app on an Android emulator or device.
- `npm run android:release`: Build/Run release version.
- `npm test`: Runs all Jest tests.
- `npm run type-check`: Validates TypeScript types.
- `npm run lint`: Checks for linting errors.
- `npm run format`: Formats code with Prettier.

## Development Conventions

### 1. CodeSight Context Map (AI Optimized)

The project utilizes the `codesight` package to maintain a high-signal overview of the repository for AI agents.

- **Location**: `.codesight/`
- **Key Files**:
  - `.codesight/CODESIGHT.md`: A comprehensive map of components, library functions, and dependency graphs. Use this for quick lookups of symbols and their locations.
  - `.codesight/wiki/`: Detailed architectural overviews, library breakdowns, and UI maps.
- **Usage**: Always check `CODESIGHT.md` when looking for existing components or logic to avoid duplication and understand the "blast radius" of changes.

### 2. AI Agent Commit Rules (Mandatory)

See `CONTRIBUTING_AGENTS.md` for full details.

- **Format**: `type(scope): description` (Conventional Commits).
- **Types**: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `revert`.
- **Scopes**: `ui`, `gps`, `health`, `notifications`, `storage`, `background`, `widget`, `weather`, `i18n`, `api`, `ci`.
- **PR Titles**: PR titles are used for release notes (Squash & Merge). They must be high-quality and user-centric.

### 2. Testing Standards

- **Exhaustive Testing**: New features or bug fixes MUST include tests in `src/__tests__/`.
- **Regression Prevention**: Always run `npm test` before proposing changes.
- **Mocking**: Use `jest.setup.js` for platform-specific Expo modules.

### 3. Internationalization (i18n)

- **Hard-coded strings**: User-facing text must NEVER be hard-coded. Use `i18n.t('key')`.
- **Locales**: Always update `src/i18n/` for both `en.json` and `nl.json`.

### 4. Database & Sessions

- **Intelligent Merging**: Automated sessions (GPS/Health) are merged or trimmed around confirmed/manual sessions. Manual sessions are never overwritten.
- **Storage Layer**: Use `src/storage/database.ts` for all SQLite operations.

### 5. Code Style

- **Functional Components**: Prefer functional components with hooks.
- **Naming**: `PascalCase` for components, `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for constants.
- **Strict Typing**: Avoid `any`. Use explicit interfaces for props and data models.

## Architectural Insights

- **Foreground Sync**: `useForegroundSync` is triggered when the app is opened to catch up on background tasks and refresh the UI/widget.
- **Initialization**: `useAppStore.getState().initialize()` handles critical (database, settings) and deferred (background tasks) startup logic on app mount.
- **Alarm Bridge**: Uses a local native module (`modules/alarm-bridge-native`) to overcome Android background limitations for precise reminder scheduling.
