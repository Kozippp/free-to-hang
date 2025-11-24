# Java Version Setup for Android Build

## Overview
This project requires **Java 17** for building the Android app. The configuration has been set up to automatically use Java 17 regardless of your system's default Java version.

## What Has Been Configured

### 1. Root build.gradle (`android/build.gradle`)
- Explicitly sets Java 17 as the target version for all modules
- Forces all Java and Kotlin compilation tasks to use Java 17
- Configures Gradle Toolchain to use Java 17

### 2. App build.gradle (`android/app/build.gradle`)
- Sets `compileOptions` to use Java 17
- Sets Kotlin `jvmTarget` to Java 17

### 3. gradle.properties (`android/gradle.properties`)
- Enables auto-detection and auto-download of Java installations
- Gradle will automatically find or download Java 17 if needed

## How to Verify Your Java Version

### Check System Java Version
```bash
java -version
```

### Check Gradle's Java Version
```bash
cd android
./gradlew -version
```

## Installing Java 17 (if needed)

### macOS
Using Homebrew:
```bash
brew install openjdk@17
```

Then add to your shell profile (~/.zshrc or ~/.bash_profile):
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v17)
export PATH="$JAVA_HOME/bin:$PATH"
```

### Linux
```bash
sudo apt update
sudo apt install openjdk-17-jdk
```

### Windows
Download from [Adoptium](https://adoptium.net/temurin/releases/?version=17)

## Building the Android App

Once Java 17 is installed, you can build normally:

```bash
# Development build
npm run android

# Or using Expo
npx expo run:android
```

## Troubleshooting

### Error: "Unsupported Java version"
If you still see Java version errors:

1. **Check your JAVA_HOME**:
   ```bash
   echo $JAVA_HOME
   ```

2. **Set JAVA_HOME explicitly** (temporary):
   ```bash
   export JAVA_HOME=$(/usr/libexec/java_home -v17)
   ```

3. **Clear Gradle cache**:
   ```bash
   cd android
   ./gradlew clean
   rm -rf ~/.gradle/caches/
   ```

### Error: "Could not determine Java version"
This usually means Java is not installed. Follow the installation steps above.

### Multiple Java Versions Installed
If you have multiple Java versions, you can:

1. **Use jenv** (recommended for managing multiple versions):
   ```bash
   brew install jenv
   jenv add /Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
   jenv global 17
   ```

2. **Or set JAVA_HOME permanently** in your shell profile:
   ```bash
   # Add to ~/.zshrc or ~/.bash_profile
   export JAVA_HOME=$(/usr/libexec/java_home -v17)
   ```

## Why Java 17?

- **React Native 0.79+** requires Java 17 minimum
- **Android Gradle Plugin 8.x** requires Java 17
- **Better performance** and modern language features
- **Long-term support (LTS)** version

## Configuration Files Modified

The following files have been configured to enforce Java 17:
- `android/build.gradle` - Root build configuration
- `android/app/build.gradle` - App-level build configuration
- `android/gradle.properties` - Gradle properties

**Do not modify Java version settings in these files unless you know what you're doing!**

