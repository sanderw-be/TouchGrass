# TouchGrass - AI Agent Guide

This guide helps AI agents understand the TouchGrass project structure, conventions, and development patterns for efficient collaboration.

## Project Overview

**TouchGrass** is a React Native Expo app that encourages outdoor activity through automatic detection, goal tracking, and smart reminders.

- **Platform**: Android (primary), iOS (planned)
- **Language**: TypeScript (strict mode)
- **Framework**: React Native with Expo SDK 55
- **Database**: SQLite (expo-sqlite)
- **Testing**: Jest + React Native Testing Library
- **Build**: EAS Build (APK for development/preview, AAB for production)

## Architecture & Key Modules

### Core Modules

| Module           | Purpose                                         | Key Files                               |
| ---------------- | ----------------------------------------------- | --------------------------------------- |
| `detection/`     | GPS + Health Connect outdoor activity detection | Session merging logic, overlap handling |
| `storage/`       | SQLite database layer                           | Schema, queries, migrations             |
| `notifications/` | Reminder scheduling and delivery                | Background tasks, notification channels |
| `calendar/`      | Calendar integration                            | Event creation, sync logic              |
| `weather/`       | Weather data integration                        | API calls, caching                      |
| `components/`    | Reusable UI components                          | Buttons, modals, sheets, lists          |
| `screens/`       | Full-screen views                               | Home, History, Events, Settings         |
| `navigation/`    | React Navigation setup                          | Bottom tabs, stack navigation           |
| `i18n/`          | Internationalization                            | English (en), Dutch (nl)                |
| `utils/`         | Helpers and theme                               | Colors, formatting, constants           |
| `context/`       | React Context providers                         | Global state management                 |

### Session Merging Logic

When GPS and Health Connect detect overlapping outdoor time:

- **Unconfirmed + Unconfirmed**: Merge into one pending session
- **Automated + Confirmed**: Confirmed session stays intact; only non-overlapping time becomes new unconfirmed session
- **Automated + Denied**: Sessions merge; denied status is preserved
- **Manual sessions**: Always inserted standalone, bypassing all merge logic

**Key principle**: Confirmed and manual sessions are never overwritten.

## Development Patterns

### Component Structure

```typescript
// Functional components with hooks
import { FC } from 'react';
import { View, Text } from 'react-native';

interface MyComponentProps {
  title: string;
  onPress?: () => void;
}

const MyComponent: FC<MyComponentProps> = ({ title, onPress }) => {
  return (
    <View>
      <Text>{title}</Text>
    </View>
  );
};

export default MyComponent;
```

### Internationalization

All user-facing strings must be internationalized:

```typescript
import i18n from '@/i18n';

const message = i18n.t('screens.home.title');
```

Add translations to `src/i18n/` for both English and Dutch.

### Database Access

Use the storage layer in `src/storage/`:

```typescript
import { db } from '@/storage';

const sessions = await db.getSessions();
await db.insertSession({ startTime, endTime, source });
```

### Testing

- Test files: `src/__tests__/` (one test file per screen/component)
- Use React Native Testing Library for UI tests
- Mock Expo modules (location, notifications, etc.)
- Run: `npm test`, `npm run test:watch`, `npm run test:coverage`

## Build & Release

### Development Build (APK)

```bash
npm run android:dev
```

### Preview Build (APK via EAS)

```bash
eas build --platform android --profile preview
```

### Production Build (AAB via EAS)

```bash
eas build --platform android --profile production
```

### Key Build Configurations

- **Development**: arm64-v8a only, debug variant, development client enabled
- **Preview**: arm64-v8a only, APK format, internal distribution
- **Production**: All architectures (Play Store handles splitting), AAB format, ProGuard enabled

See `eas.json` and `app.config.js` for detailed build profiles.

## Code Style & Conventions

### Naming

- **Components**: PascalCase (e.g., `HomeScreen`, `SessionCard`)
- **Functions/variables**: camelCase (e.g., `calculateDuration`, `isOutdoor`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_SESSION_DURATION`)
- **Files**: Match export name (e.g., `HomeScreen.tsx` exports `HomeScreen`)

### TypeScript

- Strict mode enabled
- Always type function parameters and return types
- Use interfaces for component props
- Avoid `any` type

### Imports

```typescript
// Use path aliases
import { db } from '@/storage';
import { useTheme } from '@/utils/theme';
import HomeScreen from '@/screens/HomeScreen';

// Group imports: React, libraries, local
import { FC } from 'react';
import { View } from 'react-native';
import i18n from '@/i18n';
import { colors } from '@/utils/theme';
```

## Common Tasks for AI Agents

### Adding a New Feature

1. Create screen in `src/screens/`
2. Add navigation route in `src/navigation/`
3. Add i18n strings in `src/i18n/`
4. Create tests in `src/__tests__/`
5. Update README if user-facing

### Fixing a Bug

1. Write a test that reproduces the bug
2. Fix the code
3. Verify test passes
4. Run full test suite: `npm test`
5. Type check: `npm run type-check`

### Refactoring

1. Ensure tests exist for the code being refactored
2. Make changes
3. Run tests: `npm test`
4. Verify no TypeScript errors: `npm run type-check`
5. Check for i18n strings that need updating

## Important Files

- `App.tsx` - Root component, error boundary
- `app.json` - Expo configuration, permissions, plugins
- `app.config.js` - Dynamic config, background service setup
- `eas.json` - EAS Build profiles
- `package.json` - Dependencies, scripts
- `tsconfig.json` - TypeScript configuration with path aliases
- `jest.config.js` - Jest test configuration
- `metro.config.js` - Metro bundler configuration

## Dependencies to Know

- **expo-location**: GPS tracking
- **expo-health-connect**: Health Connect integration (Android)
- **expo-notifications**: Push notifications
- **expo-sqlite**: Local database
- **react-navigation**: Navigation framework
- **i18n-js**: Internationalization
- **react-native-background-actions**: Background task execution

## Testing Utilities

- `@testing-library/react-native`: Component testing
- `jest-expo`: Expo-specific Jest setup
- Mock location, notifications, and database calls in tests

## Performance Considerations

- Background location tracking uses significant battery; optimize update frequency
- SQLite queries should be indexed for large datasets
- Notification scheduling should batch requests
- Health Connect queries can be slow; cache results

## Privacy & Security

- All data stored locally; no external servers
- Location data never leaves the device
- Health data accessed only with user permission
- Users can clear all data from Settings

## Useful Commands

```bash
# Development
npm start                 # Start Expo dev server
npm run android          # Run on Android device/emulator
npm run android:dev      # Debug build
npm run android:release  # Release build

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run type-check       # TypeScript check

# Building
eas build --platform android --profile development
eas build --platform android --profile preview
eas build --platform android --profile production
```

## Documentation

- `DEVELOPMENT.md` - Setup and workflow guide
- `docs/TESTING.md` - Testing guidelines
- `docs/HEALTH_CONNECT_SETUP.md` - Health Connect configuration
- `docs/RELEASE.md` - Release process
