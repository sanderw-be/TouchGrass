# GitHub Copilot Instructions

## Project Overview

TouchGrass is a React Native mobile app that encourages users to spend more time outdoors. It automatically tracks outdoor sessions using GPS and Health Connect, lets users set daily/weekly goals, sends smart reminders, and shows progress statistics. **All data is stored locally on the device — no external servers.**

## Tech Stack

- **Framework**: React Native with Expo SDK (~54.0)
- **Language**: TypeScript (strict mode)
- **Navigation**: React Navigation (bottom tabs + stack navigator)
- **Database**: SQLite via `expo-sqlite`
- **Testing**: Jest + React Native Testing Library (`@testing-library/react-native`)
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`)
- **Internationalization**: `i18n-js` with locales in `src/i18n/` (English + Dutch)

## Project Structure

```
src/
├── __tests__/        # All tests live here (Jest)
├── components/       # Reusable UI components (sheets, rings, etc.)
├── detection/        # Outdoor activity detection (GPS, Health Connect)
├── i18n/             # Translation files (en, nl) and i18n setup
├── navigation/       # React Navigation tab and stack configuration
├── notifications/    # Notification scheduling logic
├── screens/          # Full-screen page components
├── storage/          # SQLite database layer
├── utils/            # Helper functions, theme/colors
└── weather/          # Weather data fetching and background tasks
```

## Build, Test, and Run Commands

```bash
# Install dependencies
npm ci

# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (during development)
npm run test:watch

# TypeScript type checking (no emit)
npm run type-check

# Lint the codebase
npm run lint

# Prettier code formatting
npm run format:check  # Check for formatting issues
npm run format       # Automatically fix formatting issues

# Start the Expo development server
npm start

# Run on Android device/emulator
npm run android

# Run on iOS simulator
npm run ios
```

## Coding Conventions

- Use **functional components with hooks** — no class components.
- Use **TypeScript strict mode**; all new files must be `.ts` or `.tsx`.
- All **user-facing strings must use the i18n helper** (`t('key')`); never hardcode display text.
- Follow the existing **file naming convention**: PascalCase for components/screens, camelCase for utilities/hooks.
- Prefer **named exports** over default exports for utilities and hooks; screens and components may use default exports.
- Use the `theme` object from `src/utils/` for colors and spacing rather than inline style values.
- Database access must go through `src/storage/`; never call `expo-sqlite` directly from screens or components.
- ALWAYS run linter and prettier before finalizing PR to ensure code style consistency.

## Testing Requirements

- All new functionality must include unit tests in `src/__tests__/`.
- Tests use Jest + React Native Testing Library. Mock native modules in `jest.setup.js`.
- Every new test file should follow the naming convention `<subject>.test.ts` or `<subject>.test.tsx`.
- Code coverage must not decrease with new changes.
- All existing tests must continue to pass.
- Mock platform-specific APIs (location, notifications, health connect, SQLite) using `jest.mock()`.
- ALWAYS run tests and check coverage before finalizing PR to ensure test quality and prevent regressions.

Example test structure:

```typescript
describe('myFunction', () => {
  it('does the expected thing', () => {
    expect(myFunction(input)).toBe(expectedOutput);
  });
});
```

## Platform-Specific Notes

- **Android**: Health Connect integration (`react-native-health-connect`) and background location tracking are Android-only features.
- **iOS**: HealthKit integration is planned but not yet implemented.
- Use `Platform.OS` checks when behavior must differ between platforms.
- Background tasks are registered with `expo-task-manager` and `expo-background-task`.

## Key Files

| File                       | Purpose                                      |
| -------------------------- | -------------------------------------------- |
| `App.tsx`                  | Root component, navigation container         |
| `src/storage/database.ts`  | SQLite schema and query helpers              |
| `src/detection/`           | GPS and Health Connect session detection     |
| `src/i18n/`                | Locale definitions and `t()` helper          |
| `src/utils/theme.ts`       | Shared colors and spacing constants          |
| `jest.setup.js`            | Global mock configuration for native modules |
| `.github/workflows/ci.yml` | CI pipeline (test → build Android → lint)    |

# Codebase Context Map
Before answering questions, planning features, or generating code, always review the codebase summaries compiled by Codesight:
- Read `.codesight/CODESIGHT.md` to understand existing routes, database schemas, and blast radius.
- Read `.codesight/wiki/index.md` for targeted sub-system logic.
- Read `.codesight/KNOWLEDGE.md` to understand architectural decisions and notes.
