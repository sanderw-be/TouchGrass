# TouchGrass 🌱

A React Native mobile app that encourages users to spend more time outdoors by tracking outdoor activities, setting goals, and providing smart reminders.

[![CI](https://github.com/sanderw-be/TouchGrass/actions/workflows/ci.yml/badge.svg)](https://github.com/sanderw-be/TouchGrass/actions/workflows/ci.yml)

## Features

- 📍 **Automatic Outdoor Detection** - Uses GPS and Health Connect to track outdoor time
- 🎯 **Customizable Goals** - Set daily and weekly outdoor activity targets
- 🔔 **Smart Reminders** - Get personalized notifications to encourage outdoor time
- 📊 **Progress Tracking** - View daily, weekly, and monthly outdoor activity statistics
- 🏠 **Home Screen Widget** - Quick access to progress and timer from the Android home screen
- 🔒 **Privacy First** - All data stays on your device, no external servers
- 🌍 **Multi-language Support** - Available in English and Dutch

## Tech Stack

- **Framework**: React Native with Expo SDK (~55.0)
- **Language**: TypeScript with strict mode enabled
- **Navigation**: React Navigation (bottom tabs + stack)
- **Database**: SQLite (expo-sqlite)
- **Testing**: Jest + React Native Testing Library
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Expo CLI
- Android Studio (for Android development) or Xcode (for iOS development)

### Quick Start

```bash
# Clone and install
git clone https://github.com/sanderw-be/TouchGrass.git
cd TouchGrass
npm install

# Start development server
npm start

# Run on Android
npm run android
```

For detailed setup and development workflow, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Testing

The project includes comprehensive automated tests.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Type checking
npm run type-check
```

See [TESTING.md](docs/TESTING.md) for detailed testing guidelines.

## Project Structure

```
src/
├── components/       # Reusable UI components
├── detection/        # Outdoor activity detection logic
├── i18n/            # Internationalization (en, nl)
├── navigation/      # React Navigation setup
├── notifications/   # Notification scheduling
├── screens/         # Full-screen components
├── storage/         # Database layer (SQLite)
├── utils/           # Helper functions and theme
└── weather/         # Weather data integration
```

## Session Detection & Merging

When multiple sources (GPS, Health Connect) detect overlapping outdoor time, TouchGrass merges them intelligently while always preserving the user's own decisions:

| Situation                                                           | Behaviour                                                                                                             |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Two unconfirmed automated sessions overlap                          | Merged into one session pending user review                                                                           |
| New automated session overlaps a **confirmed** session (any source) | Confirmed session is left intact; only the time outside the confirmed window is proposed as a new unconfirmed session |
| New automated session is fully covered by a confirmed session       | No new session is created                                                                                             |
| New automated session overlaps a **denied** session                 | Sessions are merged; the denied (`userConfirmed = 0`) status is preserved                                             |
| Manual session submitted                                            | Always inserted as a standalone entry, bypassing all merge logic entirely — regardless of `userConfirmed` status      |

In short: **confirmed and manual sessions are never overwritten.** Automated sessions are only ever trimmed or split to fit around time the user has already approved.

## Platform-Specific Features

### Android

- Health Connect integration for fitness data
- Background location tracking
- Notification channels for smart reminders

### iOS

- HealthKit integration (coming soon)
- Background location tracking
- Notification permissions

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for setup, workflow, and common tasks.

### Code Style

- TypeScript strict mode enabled
- Functional components with hooks
- PascalCase for components, camelCase for functions
- All user-facing strings must be internationalized

### Building

```bash
# Local development build (APK)
npm run android:dev

# Local release build (APK)
npm run android:release

# Cloud build via EAS
eas build --platform android --profile development  # APK
eas build --platform android --profile preview      # APK
eas build --platform android --profile production   # AAB for Play Store
```

## Documentation

- [Testing Guide](docs/TESTING.md) - Automated testing setup and guidelines
- [Health Connect Setup](docs/HEALTH_CONNECT_SETUP.md) - Configure Health Connect integration
- [Release Process](docs/RELEASE.md) - How to build and release the app

## Contributing

Contributions are welcome! Before submitting a merge request:

1. Run tests: `npm test`
2. Type check: `npm run type-check`
3. Follow code style (see [DEVELOPMENT.md](DEVELOPMENT.md))
4. Add tests for new functionality
5. Update i18n strings for user-facing text

For AI-assisted development, see [.gitlab/duo/agents.md](.gitlab/duo/agents.md).

## License

**All Rights Reserved** © 2026

This software and its source code are proprietary. All rights are reserved by the copyright holder.

You may:

- Run the binary/application on your device

You may NOT:

- Modify, distribute, sublicense, or sell copies of this software
- Reverse engineer, decompile, or disassemble the software
- Use this software for any commercial purposes without explicit permission

For licensing inquiries or permissions, please contact the repository owner.

## Privacy

TouchGrass is designed with privacy in mind:

- All location and health data is stored locally on your device
- No data is sent to external servers
- No user tracking or analytics
- You can clear all data at any time from the Settings screen

## Support

For issues, questions, or feature requests, please [open an issue](https://github.com/sanderw-be/TouchGrass/issues).
