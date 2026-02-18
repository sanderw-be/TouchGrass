# Automated Testing Guide

This document describes the automated testing setup for TouchGrass, a React Native mobile app.

## Overview

The TouchGrass project uses **Jest** and **React Native Testing Library** for automated testing. Tests run automatically on every pull request via GitHub Actions to ensure code quality and prevent regressions.

## Test Structure

Tests are organized in the `src/__tests__/` directory with the following coverage:

- **Unit Tests**: Test individual functions and utilities
  - `helpers.test.ts` - Date/time formatting functions
  - `database.test.ts` - Database initialization and core functions
  
- **Integration Tests**: Test component behavior and interactions
  - `IntroScreen.test.tsx` - First-run tutorial screens
  - `App.test.tsx` - App initialization and navigation

## Running Tests Locally

### Run all tests
```bash
npm test
```

### Run tests in watch mode (useful during development)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

### Run TypeScript type checking
```bash
npm run type-check
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- Uses `jest-expo` preset for React Native/Expo compatibility
- Transforms node_modules for React Native libraries
- Collects coverage from `src/**/*.{ts,tsx}` files

### Mock Setup (`jest.setup.js`)
Mocks are configured for Expo modules that require native functionality:
- `expo-sqlite` - Database operations
- `expo-location` - GPS/location services
- `expo-notifications` - Push notifications
- `react-native-health-connect` - Health data integration
- And other platform-specific modules

## Continuous Integration (CI)

### GitHub Actions Workflow

The CI pipeline runs on every pull request and push to main/master branches:

#### 1. **Build and Test** Job
- Installs dependencies
- Runs TypeScript type checking
- Executes all Jest tests
- Generates and uploads coverage reports

#### 2. **Build Android App** Job
- Builds Android APK using EAS Build
- Uploads APK as downloadable artifact
- Artifact available for 30 days after workflow run
- APK can be installed on test devices for manual testing

#### 3. **Lint and Format Check** Job
- Validates TypeScript compilation
- Checks for common code issues

### CI Requirements Met

✅ **Does the build succeed?** - TypeScript compilation and dependency installation verified  
✅ **Can the app run?** - App initialization and structure validated  
✅ **Do first-run tutorial steps work?** - IntroScreen component and navigation tested

### Downloading Build Artifacts

After a successful workflow run, you can download the Android APK:

1. Go to the **Actions** tab in the GitHub repository
2. Select the completed workflow run
3. Scroll down to the **Artifacts** section
4. Click on **touchgrass-android-apk** to download
5. Install the APK on your Android device for testing

The APK artifact is retained for 30 days after the workflow run.

## Writing New Tests

### Unit Test Example
```typescript
describe('formatMinutes', () => {
  it('formats minutes less than 60', () => {
    expect(formatMinutes(45)).toBe('45m');
  });
  
  it('formats hours with minutes', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
  });
});
```

### Component Test Example
```typescript
describe('IntroScreen', () => {
  it('renders without crashing', () => {
    const onComplete = jest.fn();
    const { getByText } = render(<IntroScreen onComplete={onComplete} />);
    expect(getByText('intro_welcome_title')).toBeTruthy();
  });
});
```

## Best Practices

1. **Test Behavior, Not Implementation** - Focus on what the user sees and experiences
2. **Use Descriptive Test Names** - Test names should clearly describe what is being tested
3. **Mock External Dependencies** - Use jest.mock() for platform-specific APIs
4. **Keep Tests Fast** - Unit tests should run in milliseconds
5. **Test Edge Cases** - Include tests for null values, empty data, and boundary conditions

## Debugging Tests

### View detailed test output
```bash
npm test -- --verbose
```

### Run a specific test file
```bash
npm test -- helpers.test.ts
```

### Update snapshots (if using snapshot tests)
```bash
npm test -- -u
```

## Coverage Goals

Current test coverage focuses on:
- Core business logic (date helpers, formatters)
- Database operations (initialization, settings)
- Critical user flows (app initialization, intro tutorial)
- Component rendering (smoke tests for key screens)

## Future Enhancements

Potential improvements to the test suite:
- E2E tests with Detox or Maestro for full user flow testing
- Visual regression testing for UI components
- Performance testing for database queries
- Integration tests for notification scheduling
- Mock service workers for API testing (if applicable)

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Cannot find module" errors  
**Solution**: Ensure all mocks are set up in `jest.setup.js` before modules are imported

**Issue**: React Native warnings in test output  
**Solution**: These are typically safe to ignore in tests, but can be suppressed with custom mock implementations

**Issue**: Async state updates not wrapped in act(...)  
**Solution**: Use `waitFor` from @testing-library/react-native or wrap state updates in `act()`

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing React Native Apps (Official Guide)](https://reactnative.dev/docs/testing-overview)
- [Expo Testing Guide](https://docs.expo.dev/develop/unit-testing/)

## Contact

For questions about testing or to report issues with the test suite, please open an issue on GitHub.
