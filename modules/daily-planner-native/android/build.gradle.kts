plugins {
  id("com.android.library")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "expo.modules.dailyplannernative"
  compileSdk = 35

  defaultConfig {
    minSdk = 26
    consumerProguardFiles("consumer-rules.pro")
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }
}

dependencies {
  implementation(project(":expo-modules-core"))
  implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.9.25")
  implementation("androidx.work:work-runtime-ktx:2.9.1")
  implementation("com.facebook.react:react-android")
}
