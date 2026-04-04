# Home Screen Widget

TouchGrass includes an Android home screen widget that displays your daily outdoor progress and provides quick access to start a timer.

## Features

- **Progress Ring**: Shows current outdoor minutes vs. daily goal with color-coded feedback
  - 0–30 %: Blue (sky) — Just getting started
  - 30–60 %: Yellow (sun) — Making progress
  - 60–100 %: Green (grass) — Almost there!
  - 100 %+: Light green — Goal achieved!
- **Start Timer Button**: Quick access to start a manual outdoor session timer
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

- **Tap Progress Ring**: Opens TouchGrass app to the home screen
- **Tap Start Timer Button**: Opens app and automatically starts a manual timer

### How the Timer Button Works

The widget sends a deep link (`touchgrass://widget?startTimer=true`) which React
Native's Linking API detects. `widgetHelper.ts` exposes two helpers:

| Helper                       | Purpose                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `wasOpenedFromWidgetTimer()` | Checks whether the app was cold-started from the widget timer button |
| `addWidgetTimerListener(cb)` | Listens for widget timer deep links while the app is already running |

HomeScreen uses both to auto-start the manual timer when the widget button is
tapped.

### Updates

- Widget automatically updates every 30 minutes
- Widget updates when you open the app and approve/log sessions
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

The widget directly reads from the Expo SQLite database (`touchgrass.db`):

- **Sessions**: Queries confirmed sessions for today's date
- **Settings**: Reads the `daily_goal` setting
- **Date Format**: Uses `YYYY-MM-DD` format for date comparisons

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
- **Update Frequency**: Limited to 30-minute intervals by Android's widget update mechanism

## Troubleshooting

### Widget Shows 0 m / Default Values

- Ensure you've logged at least one outdoor session in the app
- Check that sessions are confirmed (not pending)
- Try removing and re-adding the widget

### Widget Not Updating

- Widgets update every 30 minutes by default
- Open the app to trigger an immediate refresh
- Check battery optimization settings aren't restricting the app

### Start Timer Button Not Working

- Ensure TouchGrass app is installed and not restricted
- Check that the app has necessary permissions
- Try force-stopping the app and reopening it

## Rebuilding Native Code

The widget requires native Android code. To regenerate the `android/` directory:

```bash
npx expo prebuild --platform android --clean
```

The widget files will be automatically generated by the config plugin.

Note: The `android/` directory is gitignored as it's generated by Expo prebuild.
