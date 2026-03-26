# Keep all classes in the daily-planner-native module so that R8 does not
# strip or rename them.  Expo modules are discovered reflectively at runtime
# and must retain their original class names.
-keep class expo.modules.dailyplannernative.** { *; }
