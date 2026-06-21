// Lumi for Mobile App — native Android SDK.
// Kotlin-first, Java-compatible. Distributed via Maven Central + JitPack.
//
// Publish flow (post-implementation):
//   $ ./gradlew :lumi:publishToMavenLocal       # smoke test
//   $ ./gradlew :lumi:publishToMavenCentral     # public release

plugins {
    id("com.android.library") version "8.2.0"
    id("org.jetbrains.kotlin.android") version "1.9.20"
    id("maven-publish")
    id("signing")
}

group = "ai.boostboss"
version = "0.1.0-alpha.1"

android {
    namespace = "ai.boostboss.lumi"
    compileSdk = 34

    defaultConfig {
        minSdk = 23  // Android 6.0 — matches Play Install Referrer API floor
        targetSdk = 34
        consumerProguardFiles("consumer-rules.pro")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    publishing {
        singleVariant("release") {
            withSourcesJar()
            withJavadocJar()
        }
    }
}

dependencies {
    // Kotlin stdlib + coroutines (network I/O off the main thread).
    implementation("org.jetbrains.kotlin:kotlin-stdlib:1.9.20")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // Google Play Install Referrer — the standard Android install
    // attribution API. Roughly the SKAdNetwork equivalent.
    implementation("com.android.installreferrer:installreferrer:2.2")

    // Lifecycle, for app-launch detection.
    implementation("androidx.lifecycle:lifecycle-process:2.7.0")

    // Test deps.
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
}

publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = project.group.toString()
            artifactId = "lumi"
            version = project.version.toString()

            pom {
                name.set("Lumi for Mobile App — Android")
                description.set(
                    "Boost Boss's native Android ad SDK. Auto-mounts " +
                    "BottomBanner and SplashSponsor placements, fires the " +
                    "publisher handshake on launch, integrates Play Install " +
                    "Referrer for install attribution."
                )
                url.set("https://boostboss.ai/publish/mobile")
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://opensource.org/licenses/MIT")
                    }
                }
                scm {
                    url.set("https://github.com/BoostBoss-AI/boostboss")
                }
            }
        }
    }
}
