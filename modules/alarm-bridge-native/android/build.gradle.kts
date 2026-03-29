plugins {
    id("expo-module")
}

android {
    namespace = "expo.modules.alarmbridgenative"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // React Native is provided by the host app; declare as compileOnly to avoid
    // version conflicts.
    compileOnly("com.facebook.react:react-android")
}
