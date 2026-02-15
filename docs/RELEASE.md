# Release Build Notes

## Local Release Build (Android)

1) Ensure Android SDK, platform-tools, and JDK 17 are installed.
2) Make sure `ANDROID_HOME` and `JAVA_HOME` are set.
3) Build a release APK on a connected device or emulator:

```
npm run android:release
```

This produces a release build installed on the device/emulator. It is useful for local testing.

## Signed Release (Play Store)

For a Play Store upload you need a signed AAB or APK.

Option A: Android Studio
1) Open the `android/` folder in Android Studio.
2) Build -> Generate Signed Bundle / APK.
3) Follow the wizard to create or select a keystore.
4) Export an AAB (preferred) or APK.

Option B: EAS Build
1) Install EAS CLI:
```
npm install -g eas-cli
```
2) Configure once:
```
eas build:configure
```
3) Build for Android:
```
eas build -p android
```

## Notes
- Health Connect requires `minSdkVersion` 26.
- Keep JDK 17 active when building Android.
