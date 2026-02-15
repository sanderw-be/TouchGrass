# TouchGrass - GitHub Copilot Instructions

## Project Overview

TouchGrass is a React Native mobile app that encourages users to spend more time outdoors. The app tracks outdoor activities using multiple detection methods (GPS, Health Connect, manual check-ins), sets goals, and sends smart reminders to help users achieve their outdoor time targets.

## Tech Stack

- **Framework**: React Native with Expo SDK (~54.0)
- **Language**: TypeScript with strict mode enabled
- **Navigation**: React Navigation (bottom tabs)
- **Database**: SQLite (expo-sqlite)
- **Internationalization**: i18n-js with English and Dutch locales
- **Platform Features**: 
  - Expo Location for GPS tracking
  - Expo Notifications for reminders
  - React Native Health Connect for Android fitness data
  - Expo Task Manager for background tasks

## Code Style & Conventions

### TypeScript
- **Strict mode** is enabled - all code must type-check without errors
- Use explicit interfaces for data models (see `src/storage/database.ts`)
- Prefer `const` over `let` where possible
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer null handling

### React/React Native
- Use functional components with hooks exclusively
- Use `useFocusEffect` from React Navigation for screen-specific lifecycle effects
- Follow existing patterns for state management with `useState` and `useCallback`
- Use `StyleSheet.create()` for component styles (inline when appropriate)

### Naming Conventions
- **Files**: PascalCase for components (`HomeScreen.tsx`), camelCase for utilities (`helpers.ts`)
- **Components**: PascalCase (`ProgressRing`, `ManualSessionSheet`)
- **Functions**: camelCase (`getTodayMinutes`, `formatMinutes`)
- **Constants**: camelCase for theme objects (`colors`, `spacing`), UPPER_CASE for true constants

### Database
- SQLite is used synchronously via `expo-sqlite`
- All database functions are in `src/storage/database.ts`
- Use TypeScript interfaces for all table schemas
- SQLite has no boolean type - use INTEGER (0/1) or NULL for tri-state logic
- Timestamps are stored as Unix milliseconds (number)

## Project Structure

```
src/
├── components/       # Reusable UI components
├── detection/        # Outdoor activity detection logic
├── i18n/            # Internationalization (en.ts, nl.ts)
├── navigation/      # React Navigation setup
├── notifications/   # Notification scheduling and algorithms
├── screens/         # Full-screen components
├── storage/         # Database layer (database.ts)
└── utils/           # Helper functions and theme
```

## Design System

### Theme (`src/utils/theme.ts`)
- **Colors**: Nature-inspired palette with grass greens, sky blues, earthy neutrals
  - Primary: `colors.grass`, `colors.grassLight`, `colors.grassDark`
  - Accent: `colors.sky`, `colors.sun`
  - Text: `colors.textPrimary`, `colors.textSecondary`, `colors.textMuted`
- **Spacing**: Use `spacing.xs` through `spacing.xxl` (4px to 48px)
- **Border Radius**: Use `radius.sm`, `radius.md`, `radius.lg`, or `radius.full`
- **Shadows**: Use `shadows.soft` or `shadows.medium` for elevation

### UI Patterns
- Progress rings show daily/weekly goal completion
- Cards use rounded corners (`radius.lg`) and soft shadows
- Bottom sheets for modal interactions
- Consistent padding and spacing using theme values

## Internationalization

- All user-facing strings must use `t()` function from `src/i18n`
- Supported languages: English (en) and Dutch (nl)
- Add new translation keys to BOTH `src/i18n/en.ts` and `src/i18n/nl.ts`
- Use `formatLocalDate()` and `formatLocalTime()` for locale-aware date/time formatting
- Never hardcode strings in JSX - always use translation keys

## Data Models

Key database tables:
- **outside_sessions**: Tracks outdoor activity sessions with source, confidence, and user confirmation
- **daily_goals** / **weekly_goals**: Target minutes for goals
- **reminder_feedback**: User interactions with notifications
- **known_locations**: User-defined indoor/outdoor locations
- **app_settings**: Key-value store for app settings

Source types: `'health_connect' | 'gps' | 'manual' | 'timeline'`

## Testing & Validation

- No automated test suite currently exists - validate changes manually
- Test on both Android and iOS when making platform-specific changes
- Use Expo Go or development builds for testing
- Check database queries with edge cases (empty data, large datasets)

## Important Patterns

### Date/Time Handling
- Always use Unix milliseconds for timestamps
- Use helper functions: `startOfDay()`, `startOfWeek()`, `startOfMonth()`
- Week starts on Monday (implemented in `startOfWeek()`)

### Boolean Storage in SQLite
- SQLite stores booleans as INTEGER (0/1) or NULL
- For simple booleans (non-nullable): Write as `value ? 1 : 0`, read as `value === 1`
- For tri-state (nullable) booleans: Write as `value === null ? null : (value ? 1 : 0)`
- Example tri-state: `userConfirmed` can be null (not reviewed), 0 (rejected), or 1 (confirmed)
  - Write: `userConfirmed === null ? null : (userConfirmed ? 1 : 0)`
  - Read: `row.userConfirmed === null ? null : row.userConfirmed === 1`

### Navigation
- Bottom tab navigation with Home, Events, History, Goals, Settings
- Use `useFocusEffect` to refresh data when screen comes into focus
- Navigation types defined in `src/navigation/AppNavigator.tsx`

## Common Tasks

### Adding a New Screen
1. Create component in `src/screens/[Name]Screen.tsx`
2. Add navigation type in `AppNavigator.tsx`
3. Add route to tab navigator
4. Add translation keys for screen title and content

### Adding Database Fields
1. Update interface in `src/storage/database.ts`
2. Add ALTER TABLE or CREATE TABLE IF NOT EXISTS in `initDatabase()`
3. Update relevant query functions
4. Consider data migration for existing users

### Adding Translation Keys
1. Add key to `src/i18n/en.ts`
2. Add same key to `src/i18n/nl.ts` with Dutch translation
3. Use `t('your_key')` in components

## Build & Run

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Platform-Specific Notes

- **Android**: Health Connect integration requires specific permissions
- **iOS**: Location permissions must be requested properly
- Background tasks have different behaviors per platform
- Test notification scheduling on both platforms

## Security & Privacy

- Location data stays on device (stored in local SQLite)
- No external servers or analytics
- Users can clear all data via Settings screen
- Health data accessed only with explicit permissions
