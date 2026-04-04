# Home Screen Widget

TouchGrass includes an Android home screen widget that displays your daily outdoor progress and provides quick access to start/stop a manual timer.

## Features

- **Progress Ring**: Shows current outdoor minutes vs. daily goal with color-coded feedback
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
5. Resize if needed (minimum 3×3 grid cells recommended)

## Widget Behavior

### Data Display

- **Current Minutes**: Total confirmed outdoor time for today
- **Daily Goal**: Your configured daily goal (default: 30 minutes)
- **Progress Percentage**: Visual and numeric progress indicator

### Interactions

- **Tap Play/Stop Button**: Starts or stops a manual timer session directly — the widget writes/reads from the database without opening the app
- **Tap Progress Ring**: Opens TouchGrass app to the home screen

### How the Timer Works

The widget handles the timer entirely on its own via broadcast intents:

1. **Play tapped**: Writes `widget_timer_start` (epoch ms) into the `app_settings` table and switches to the stop icon
2. **Stop tapped**: Reads the start time, inserts a completed session into `outside_sessions`, clears the marker, and refreshes the progress display
3. **App opened**: If the app gains focus and finds a `widget_timer_start` marker, it adopts the timer and shows the running state in the in-app ring

### Updates

- Widget automatically updates every 30 minutes
- Widget refreshes instantly after starting/stopping a timer
- To manually force an update, remove and re-add the widget

## Implementation Details

### Files Structure

**Config Plugin (committed to repository):**

```
withWidgetPlugin.js          # Expo config plugin that generates widget code
src/utils/widgetHelper.ts    # JS helpers for widget ↔ app communication
```

**Generated files (android/ directory is gitignored):**

```
android/app/src/main/
├── java/com/jollyheron/touchgrass/
│   └── ProgressWidgetProvider.kt          # Widget logic and data fetching
├── res/
│   ├── drawable/
│   │   ├── widget_background.xml          # Widget background styling
│   │   ├── widget_button_background.xml   # Button styling
│   │   ├── widget_play_icon.xml           # Play icon vector
│   │   ├── widget_stop_icon.xml           # Stop icon vector
│   │   ├── widget_preview.xml             # Widget picker preview
│   │   ├── widget_ring_low.xml            # 0-30% progress (blue)
│   │   ├── widget_ring_medium.xml         # 30-60% progress (yellow)
│   │   ├── widget_ring_good.xml           # 60-100% progress (green)
│   │   └── widget_ring_complete.xml       # 100%+ progress (light green)
│   ├── layout/
│   │   └── widget_progress.xml            # Widget layout structure
│   ├── values/
│   │   └── strings.xml                    # Widget description string
│   └── xml/
│       └── widget_info.xml                # Widget configuration metadata
└── AndroidManifest.xml                     # Widget receiver registration
```

### Database Access

The widget directly reads/writes the Expo SQLite database (`touchgrass.db`):

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
| Fog (Gray)    | `#E8E9E7` | Background ring track  |
| Background    | `#F8F9F7` | Widget card background |

## Limitations

- **Android Only**: Home screen widgets are an Android feature (iOS uses WidgetKit, not yet implemented)
- **Static Ring**: The progress ring uses static drawable resources, not animated
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
- Check logcat for `TouchGrassWidget` tag for error messages

## Rebuilding Native Code

The widget requires native Android code. To regenerate the `android/` directory:

```bash
npx expo prebuild --platform android --clean
```

The widget files will be automatically generated by the config plugin.

Note: The `android/` directory is gitignored as it's generated by Expo prebuild.
