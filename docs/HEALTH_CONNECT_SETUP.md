# Health Connect Setup - Why expo-health-connect?

## The Question

**"Why couldn't we use expo-health-connect?"**

## The Answer

We absolutely can and should! The project has now been updated to use `expo-health-connect` instead of directly using `react-native-health-connect`.

## What's the Difference?

### react-native-health-connect
- Core library that provides Health Connect functionality
- Works for React Native CLI projects
- Requires manual setup in `MainActivity.kt`:
  ```kotlin
  HealthConnectPermissionDelegate.setPermissionDelegate(this)
  ```
- In Expo managed projects, we don't have access to `MainActivity.kt`
- Results in crash: `UninitializedPropertyAccessException: lateinit property requestPermission has not been initialized`

### expo-health-connect
- **Expo Config Plugin** for `react-native-health-connect`
- Automatically configures native code during `expo prebuild`
- Sets up the `HealthConnectPermissionDelegate` properly
- No manual native code changes needed
- This is the **official recommended way** for Expo projects

## How It Works

When you add `"expo-health-connect"` to your `app.json` plugins array:

1. During `expo prebuild`, the config plugin runs
2. It generates the necessary native code configuration
3. It properly initializes the `HealthConnectPermissionDelegate`
4. The `requestPermission()` function can now work without crashing

## Implementation

### Before (Wrong Approach)
```json
// app.json
{
  "plugins": [
    "react-native-health-connect"  // ❌ Direct use - doesn't set up delegate
  ]
}
```

```typescript
// healthConnect.ts
// Had to skip requestPermission() entirely to avoid crash
const opened = await openHealthConnectPermissionsViaIntent();
```

### After (Correct Approach)
```json
// app.json
{
  "plugins": [
    "expo-health-connect"  // ✅ Config plugin - sets up delegate
  ]
}
```

```typescript
// healthConnect.ts
// Can now use requestPermission() with graceful fallback
try {
  const granted = await requestPermission([...]);
  if (granted && granted.length > 0) {
    return true;
  }
} catch (error) {
  // Fallback to Intent if needed
}
```

## Benefits

### 1. **No More Crashes**
The permission delegate is properly initialized, so `requestPermission()` won't crash.

### 2. **Better User Experience**
When the library's permission dialog works:
- Faster permission flow
- In-app dialog (no need to go to Settings)
- Immediate permission grant

### 3. **Graceful Fallback**
If the dialog doesn't appear (Android version differences, etc.):
- Automatically falls back to Intent-based flow
- Opens Settings → Health Connect
- User can still grant permissions manually

### 4. **Proper Expo Integration**
- Following Expo best practices
- Uses official config plugin
- No workarounds or hacks needed

### 5. **Maintainable**
- Future updates to `expo-health-connect` will improve functionality
- Easier to debug and maintain
- Clear separation of concerns

## Installation

### Dependencies Required
```json
{
  "dependencies": {
    "react-native-health-connect": "^3.5.0",  // Core library
    "expo-health-connect": "^0.1.1",          // Config plugin
    "expo-build-properties": "~1.0.10"        // For build config
  }
}
```

### App Configuration
```json
{
  "expo": {
    "plugins": [
      "expo-health-connect",
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 26,
            "manifestQueries": {
              "intents": [
                {
                  "action": "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"
                },
                {
                  "action": "android.settings.HEALTH_CONNECT_SETTINGS"
                }
              ]
            },
            "queries": [
              {
                "package": "com.google.android.apps.healthdata"
              }
            ]
          }
        }
      ]
    ],
    "android": {
      "permissions": [
        "android.permission.health.READ_EXERCISE",
        "android.permission.health.READ_STEPS",
        "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
        "android.permission.health.READ_DISTANCE"
      ]
    }
  }
}
```

## Building the App

After changing the config plugin, you **must rebuild**:

```bash
# Clean and prebuild
expo prebuild --clean

# Build for Android
expo run:android
# or
eas build --platform android
```

The prebuild step is when the config plugin sets up the native code.

## Testing

### What to Test
1. **Permission Dialog**: Tap "Connect" - does a dialog appear?
2. **No Crash**: App should not crash when requesting permissions
3. **Fallback**: If dialog doesn't appear, Settings should open
4. **App Listing**: TouchGrass should appear in Health Connect app list
5. **Verification**: Permissions should be verified after granting

### Expected Flows

#### Best Case (Dialog Works)
```
User taps "Connect"
  → Permission dialog appears ✨
  → User grants permissions
  → Permissions immediately active
  → Success alert shows
```

#### Fallback Case (Dialog Doesn't Work)
```
User taps "Connect"
  → requestPermission() called but fails gracefully
  → Settings opens automatically
  → User grants permissions in Settings
  → Returns to app
  → Auto-verification succeeds
  → Success alert shows
```

## References

- [expo-health-connect GitHub](https://github.com/matinzd/expo-health-connect)
- [react-native-health-connect Documentation](https://matinzd.github.io/react-native-health-connect/)
- [Health Connect Developer Guide](https://developer.android.com/health-and-fitness/guides/health-connect)

## Summary

**Q: Why couldn't we use expo-health-connect?**

**A: We can and we should!** The project was incorrectly using `react-native-health-connect` directly, which doesn't work properly in Expo managed projects. Switching to `expo-health-connect` provides the proper config plugin that:
- Sets up the permission delegate correctly
- Enables the permission dialog to work
- Provides better user experience
- Follows Expo best practices
- Maintains graceful fallback for edge cases
