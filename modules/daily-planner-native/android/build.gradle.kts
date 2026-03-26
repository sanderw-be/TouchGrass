plugins {
  id("com.android.library")
  id("org.jetbrains.kotlin.android")
  id("expo-module")
}

android {
  namespace = "expo.modules.dailyplannernative"
  compileSdk = 35

  defaultConfig {
    minSdk = 26
    consumerProguardFiles("consumer-rules.pro")
  }
}

dependencies {
  implementation("androidx.work:work-runtime-ktx:2.9.1")
}
