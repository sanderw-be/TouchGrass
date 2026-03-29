# Development Guide

Quick reference for setting up and working on TouchGrass.

## Prerequisites

- **Node.js**: 20.x or higher
- **npm**: 10.x or higher
- **Expo CLI**: Latest version
- **Android Studio**: For Android development (emulator or device)
- **Git**: For version control

## Initial Setup

### 1. Clone and Install

```bash
git clone https://gitlab.com/JollyHeron2/TouchGrass.git
cd TouchGrass
npm install
```

### 2. Start Development Server

```bash
npm start
```

This starts the Expo development server. You'll see a QR code in the terminal.

### 3. Run on Device/Emulator

**Android Emulator:**
```bash
npm run android
```

**Android Device (USB):**
```bash
npm run android:device
```

**Debug Build:**
```bash
npm run android:dev
```

## Development Workflow

### Making Changes

1. **Edit code** in `src/`
2. **Save file** - Expo will hot-reload automatically
3. **Test changes** on device/emulator
4. **Run tests** before committing:
   ```bash
   npm test
   npm run type-check
   ```

### Testing

```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Type checking
npm run type-check
```

### Debugging

**React Native Debugger:**
- Press `j` in Expo terminal to open debugger
- Use Chrome DevTools for console, network, etc.

**Console Logs:**
```typescript
console.log('Debug message:', value);
```

**React DevTools:**
- Available in Expo dev client
- Inspect component tree and props

## Building

### Local Build (APK)

```bash
# Debug APK
npm run android:dev

# Release APK
npm run android:release
```

### EAS Build (Cloud)

**Development Build:**
```bash
eas build --platform android --profile development
```

**Preview Build (APK):**
```bash
eas build --platform android --profile preview
```

**Production Build (AAB):**
```bash
eas build --platform android --profile production
```

Builds are available in the EAS dashboard or via CLI.

## Project Structure

```
TouchGrass/
├── src/
│   ├── __tests__/          # Test files
│   ├── components/         # Reusable UI components
│   ├── detection/          # Activity detection logic
│   ├── i18n/              # Translations (en, nl)
│   ├── navigation/        # Navigation setup
│   ├── notifications/     # Reminder scheduling
│   ├── screens/           # Full-screen views
│   ├── storage/           # Database layer
│   ├── utils/             # Helpers and theme
│   ├── weather/           # Weather integration
│   └── context/           # React Context
├── assets/                 # Images, icons, splash
├── docs/                   # Documentation
├── .github/               # GitHub Actions workflows
├── app.json               # Expo config
├── app.config.js          # Dynamic config
├── eas.json               # EAS Build profiles
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── jest.config.js         # Jest config
└── metro.config.js        # Metro bundler config
```

## Code Style

### TypeScript

- Strict mode enabled
- Always type function parameters and returns
- Use interfaces for component props
- Avoid `any` type

### Naming Conventions

- **Components**: `PascalCase` (e.g., `HomeScreen`)
- **Functions/variables**: `camelCase` (e.g., `calculateDuration`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_DURATION`)
- **Files**: Match export name

### Imports

```typescript
// Use path aliases (@/ points to src/)
import { db } from '@/storage';
import { useTheme } from '@/utils/theme';

// Group: React, libraries, local
import { FC } from 'react';
import { View } from 'react-native';
import i18n from '@/i18n';
```

## Internationalization

All user-facing strings must be translated:

```typescript
import i18n from '@/i18n';

const title = i18n.t('screens.home.title');
```

Add translations to `src/i18n/` for English and Dutch.

## Database

Use the storage layer in `src/storage/`:

```typescript
import { db } from '@/storage';

// Query
const sessions = await db.getSessions();

// Insert
await db.insertSession({ startTime, endTime, source });

// Update
await db.updateSession(id, { userConfirmed: true });
```

## Git Workflow

1. **Create feature branch**:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes** and test

3. **Commit with clear messages**:
   ```bash
   git commit -m "feat: add outdoor detection"
   git commit -m "fix: handle overlapping sessions"
   git commit -m "refactor: simplify notification logic"
   ```

4. **Push and create MR**:
   ```bash
   git push origin feature/my-feature
   ```

5. **MR checks**:
   - Tests pass
   - TypeScript compiles
   - Code review

## Common Tasks

### Add a New Screen

1. Create `src/screens/MyScreen.tsx`
2. Add route in `src/navigation/`
3. Add i18n strings in `src/i18n/`
4. Create test in `src/__tests__/MyScreen.test.tsx`

### Add a New Component

1. Create `src/components/MyComponent.tsx`
2. Export from `src/components/index.ts` (if applicable)
3. Create test in `src/__tests__/MyComponent.test.tsx`
4. Use in screens

### Fix a Bug

1. Write test that reproduces bug
2. Fix code
3. Verify test passes
4. Run full test suite: `npm test`
5. Type check: `npm run type-check`

### Refactor Code

1. Ensure tests exist
2. Make changes
3. Run tests: `npm test`
4. Type check: `npm run type-check`
5. Verify no regressions

## Troubleshooting

### Expo Won't Start

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm start
```

### Android Build Fails

```bash
# Clear Android build cache
cd android && ./gradlew clean && cd ..
npm run android:dev
```

### Tests Fail

```bash
# Clear Jest cache
npm test -- --clearCache
npm test
```

### TypeScript Errors

```bash
# Check for errors
npm run type-check

# Fix common issues
# - Add missing type annotations
# - Check import paths
# - Verify interface definitions
```

## Performance Tips

- **Location tracking**: Optimize update frequency to reduce battery drain
- **Database**: Index frequently queried columns
- **Notifications**: Batch scheduling requests
- **Health Connect**: Cache results to avoid repeated queries
- **Components**: Use React.memo for expensive renders

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing](https://jestjs.io/)

## Getting Help

- Check existing issues: https://gitlab.com/JollyHeron2/TouchGrass/-/issues
- Review documentation in `docs/`
- Check test files for usage examples
- Ask in merge request discussions
