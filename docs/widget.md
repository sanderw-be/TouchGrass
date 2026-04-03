# Home Screen Widget

TouchGrass includes an Android home screen widget that displays your daily outdoor progress and provides quick access to start a timer.

## Features

- **Progress Ring**: Shows current outdoor minutes vs. daily goal with color-coded feedback
  - 0-30%: Blue (sky) - Just getting started
  - 30-60%: Yellow (sun) - Making progress
  - 60-100%: Green (grass) - Almost there!
  - 100%+: Light green - Goal achieved!
- **Start Timer Button**: Quick access to start a manual outdoor session timer
- **Auto-updates**: Widget refreshes every 30 minutes automatically
- **Live Data**: Reads directly from the SQLite database for accurate progress

## Adding the Widget

1. Long-press on your Android home screen
2. Tap "Widgets" or the widgets icon
3. Find "TouchGrass Progress" in the list
4. Drag the widget to your desired location on the home screen
5. Resize if needed (minimum 3x3 grid cells recommended)

## Widget Behavior

### Data Display

- **Current Minutes**: Total confirmed outdoor time for today
- **Daily Goal**: Your configured daily goal (default: 30 minutes)
- **Progress Percentage**: Visual and numeric progress indicator

### Interactions

- **Tap Progress Ring**: Opens TouchGrass app to the home screen
- **Tap Start Timer Button**: Opens app and signals to start manual timer
  - The app will open to the home screen
  - The intent extra `startTimer=true` is passed to the app
  - You can handle this in your HomeScreen component to auto-start the timer

### Updates

- Widget automatically updates every 30 minutes
- Widget updates when you open the app and approve/log sessions
- To manually force an update, remove and re-add the widget

## Implementation Details

### Files Structure

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

- Sky (Blue): `#7EB8D4`
- Sun (Yellow): `#F5C842`
- Grass (Green): `#4A7C59`
- Grass Light (Light Green): `#6BAF7A`
- Fog (Gray): `#E8E9E7`
- Background: `#F8F9F7`

### Performance Considerations

- Widget uses read-only database access
- Minimal query overhead (2 queries: sessions + settings)
- Graceful error handling with default values
- Update interval set to 30 minutes to balance freshness with battery life

## Limitations

- **Android Only**: Home screen widgets are an Android feature (iOS uses WidgetKit, not currently implemented)
- **Static Ring**: The progress ring uses static drawable resources, not animated like the in-app version
- **Update Frequency**: Limited to 30-minute intervals by Android's widget update mechanism
- **No Real-time Updates**: Won't update while a manual timer is running (updates occur when app processes data)

## Troubleshooting

### Widget Shows 0m / Default Values

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

## Future Enhancements

Potential improvements for future versions:

- Configurable update intervals
- Multiple widget sizes (1x1, 2x2, 4x2)
- Dark mode support
- Weekly progress display option
- Streak counter display
- iOS WidgetKit implementation

## Development Notes

### Rebuilding Native Code

The widget requires native Android code. To regenerate the `android/` directory:

```bash
npx expo prebuild --platform android --clean
```

Note: The `android/` directory is gitignored as it's generated by Expo prebuild.

### Testing

To test widget changes:

1. Rebuild the app: `npm run android`
2. Remove and re-add the widget to the home screen
3. Check Android Studio logs for any errors: `adb logcat | grep TouchGrass`

### Updating Widget Programmatically

To trigger a widget update from JavaScript (future enhancement):

```typescript
// This would require a native module bridge
import { AppWidgetManager } from 'react-native';

// Request widget update
AppWidgetManager.updateWidgets('ProgressWidgetProvider');
```

Currently, widgets auto-update based on the 30-minute interval and app lifecycle events.
