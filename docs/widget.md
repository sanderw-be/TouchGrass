# Home Screen Widget

TouchGrass includes an Android home screen widget that displays your daily outdoor progress and provides quick access to start/stop a manual timer.

## Features

- **Progress Bar**: Shows current outdoor minutes vs. daily goal with color-coded feedback
  - 0–30 %: Blue (sky) — Just getting started
  - 30–60 %: Yellow (sun) — Making progress
  - 60–100 %: Green (grass) — Almost there!
  - 100 %+: Light green — Goal achieved!
- **Start/Stop Timer Button**: Start and stop a manual outdoor session directly from the widget — no app launch required
- **Auto-updates**: Widget refreshes every 30 minutes automatically
- **Live Data**: Reads directly from the SQLite database for accurate progress

## Adding the Widget

1. Long-press on your Android home screen
2. Tap "Widgets" or the widgets icon
3. Find "TouchGrass Progress" in the list
4. Drag the widget to your desired location on the home screen
5. Resize if needed (minimum 3×2 grid cells)

## Widget Behavior

### Data Display

- **Current Minutes**: Total confirmed outdoor time for today
- **Daily Goal**: Your configured daily goal (default: 30 minutes)
- **Progress Percentage**: Visual and numeric progress indicator

### Interactions

- **Tap Start/Stop Button**: Starts or stops a manual timer session directly — the widget reads/writes from the database without opening the app
- **Tap Anywhere Else**: Opens the TouchGrass app to the home screen

### How the Timer Works

The widget handles the timer via a headless JS task (powered by `react-native-android-widget`):

1. **Start tapped**: Writes `widget_timer_start` (epoch ms) into the `app_settings` table and re-renders with the stop button
2. **Stop tapped**: Reads the start time, logs a completed session via `logManualSession`, clears the marker, and re-renders with updated progress
3. **App opened**: If the app gains focus and finds a `widget_timer_start` marker, it adopts the timer and shows the running state in the in-app ring

### Updates

- Widget automatically updates every 30 minutes
- Widget refreshes instantly after starting/stopping a timer
- The app refreshes the widget when the in-app timer is started/stopped

## Implementation Details

### Architecture

This widget uses `react-native-android-widget` instead of a custom Expo config plugin with native Kotlin code. The benefits are:

- **Widget UI is written in TypeScript/JSX** using the library's layout primitives (`FlexWidget`, `TextWidget`)
- **No custom native code** — the library's Expo config plugin handles native registration
- **Widget task handler runs in a headless JS context** — can access the SQLite database and app logic directly

### File Structure

```
src/widget/
├── ProgressWidget.tsx       # Widget UI using FlexWidget/TextWidget primitives
└── widget-task-handler.tsx  # Handles widget lifecycle and click actions

src/utils/
└── widgetHelper.ts          # WIDGET_TIMER_KEY + requestWidgetRefresh()

index.ts                     # Registers widget task handler
app.json                     # Widget plugin configuration
```

### Database Access

The widget task handler reads/writes the Expo SQLite database:

- **Sessions**: Table `outside_sessions` — `startTime` (epoch ms), `durationMinutes` (REAL), `userConfirmed` (1/0/null)
- **Goals**: Table `daily_goals` — `targetMinutes` (INT), ordered by `createdAt` DESC
- **Timer marker**: Table `app_settings` — key `widget_timer_start`, value is epoch ms string

### Color Scheme

Widget colors match the app's nature-inspired theme:

| Name          | Hex       | Usage                  |
| ------------- | --------- | ---------------------- |
| Sky (Blue)    | `#7EB8D4` | 0–30 % progress        |
| Sun (Yellow)  | `#F5C842` | 30–60 % progress       |
| Grass (Green) | `#4A7C59` | 60–100 % progress      |
| Grass Light   | `#6BAF7A` | 100 %+ (goal achieved) |
| Fog (Gray)    | `#E8EBE6` | Background bar track   |
| Background    | `#F8F9F7` | Widget card background |

## Limitations

- **Android Only**: Home screen widgets are an Android feature (iOS uses WidgetKit, not yet implemented)
- **Update Frequency**: Limited to 30-minute intervals by Android's widget update mechanism (but instant on timer toggle)

## Troubleshooting

### Widget Shows 0 m / Default Values

- Ensure you've logged at least one outdoor session in the app
- Check that sessions are confirmed (not pending)
- Try removing and re-adding the widget

### Widget Not Updating

- Widgets update every 30 minutes by default
- Open the app to trigger an immediate refresh
- Check battery optimization settings aren't restricting the app

### Timer Button Not Working

- Ensure TouchGrass app is installed and has been opened at least once (so the database exists)
- Check logcat for widget-related error messages

## Rebuilding Native Code

The widget requires native Android code. To regenerate the `android/` directory:

```bash
npx expo prebuild --platform android --clean
```

The widget files will be automatically generated by the `react-native-android-widget` config plugin.

Note: The `android/` directory is gitignored as it's generated by Expo prebuild.
