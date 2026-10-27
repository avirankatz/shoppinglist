import java.net.URI
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

val config = Properties().apply {
    val file = rootProject.file("supabase.properties")
    if (file.isFile) file.inputStream().use { load(it) }
}
fun configValue(name: String): String = providers.gradleProperty(name).orNull
    ?: System.getenv(name) ?: config.getProperty(name, "")
fun quoted(value: String): String = "\"" + value.replace("\\", "\\\\")
    .replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\""

val webUrl = configValue("WEB_APP_URL")
val webUri = runCatching { URI(webUrl) }.getOrNull()

android {
    namespace = "com.shoppinglist"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.avirankatz.shoppinglist"
        minSdk = 26
        targetSdk = 36
        versionCode = configValue("VERSION_CODE").ifBlank { "1" }.toInt().also {
            require(it in 1..2100000000) { "VERSION_CODE must be between 1 and 2100000000" }
        }
        versionName = configValue("VERSION_NAME").ifBlank { "1.0.0" }
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "SUPABASE_URL", quoted(configValue("SUPABASE_URL")))
        buildConfigField("String", "SUPABASE_ANON_KEY", quoted(configValue("SUPABASE_ANON_KEY")))
        buildConfigField("String", "WEB_APP_URL", quoted(webUrl))
        buildConfigField("String", "BUY_ME_COFFEE_URL", quoted(configValue("BUY_ME_COFFEE_URL")))
        // A harmless unmatched host leaves only the custom scheme active without a web URL.
        manifestPlaceholders["inviteHost"] = webUri?.host ?: "invitations.invalid"
        manifestPlaceholders["invitePath"] = webUri?.path?.trimEnd('/')?.ifBlank { "/" } ?: "/"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    signingConfigs {
        if (configValue("ANDROID_KEYSTORE_PATH").isNotBlank()) {
            create("release") {
                storeFile = file(configValue("ANDROID_KEYSTORE_PATH"))
                storePassword = configValue("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = configValue("ANDROID_KEY_ALIAS")
                keyPassword = configValue("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.findByName("release")
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    bundle { language { enableSplit = false } }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.04.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("sh.calvin.reorderable:reorderable:2.4.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
