# Testing on iPhone - Step by Step Guide

This guide explains how to install and test the Renter Guardian app on your iPhone.

## Option 1: Expo Go (Easiest - Recommended for Quick Testing)

Expo Go is the fastest way to test your app on a real iPhone. Your iPhone and computer must be on the same Wi-Fi network.

### Prerequisites
- iPhone with iOS 13.4 or later
- Expo Go app installed from the App Store
- Your computer and iPhone on the same Wi-Fi network
- Environment variables configured (Firebase keys in `.env` file)

### Steps

1. **Install Expo Go on your iPhone**
   - Open the App Store on your iPhone
   - Search for "Expo Go"
   - Install the app (free)

2. **Start the development server**
   ```bash
   npm start
   ```
   This will start the Expo development server and display a QR code in your terminal.

3. **Connect your iPhone**
   - Open the Expo Go app on your iPhone
   - Tap "Scan QR Code"
   - Point your camera at the QR code in your terminal/browser
   - The app will load on your iPhone

4. **Development workflow**
   - Any code changes will automatically reload on your iPhone
   - Shake your iPhone to open the developer menu
   - Press `r` in the terminal to reload manually
   - Press `m` to toggle the menu

### Limitations of Expo Go
- Some native modules may not work (though all dependencies in this project are Expo-compatible)
- Performance may be slightly slower than a standalone build
- Requires an active connection to the development server

---

## Option 2: Development Build (Production-Like Testing)

A development build creates a standalone app on your iPhone that works without Expo Go. This is better for testing production-like behavior.

### Prerequisites
- Apple Developer account (free or paid)
- EAS CLI installed: `npm install -g eas-cli`
- Expo account (free at expo.dev)

### Steps

1. **Install EAS CLI and login**
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Configure the project**
   ```bash
   eas build:configure
   ```
   This creates an `eas.json` file with build configuration.

3. **Build for iOS development**
   ```bash
   eas build --platform ios --profile development
   ```
   This will:
   - Upload your project to Expo's servers
   - Build a development version of your app
   - Provide a download link (takes ~15-20 minutes)

4. **Install on your iPhone**
   - **Option A: Via TestFlight (Requires paid Apple Developer account)**
     - The build will automatically be uploaded to TestFlight
     - Install TestFlight from the App Store
     - Accept the TestFlight invitation email
     - Install the app from TestFlight
   
   - **Option B: Via direct download (Works with free Apple Developer account)**
     - Download the `.ipa` file from the build page
     - Install via Apple Configurator or other tools
     - Or use the Expo build link to install directly

5. **Start the development server**
   ```bash
   npm start
   ```
   The development build will connect to this server for hot reloading.

### Advantages of Development Build
- Standalone app (works independently)
- Better performance
- Can use custom native code if needed
- More production-like experience

---

## Quick Comparison

| Feature | Expo Go | Development Build |
|---------|---------|-------------------|
| Setup Time | ~2 minutes | ~30 minutes (first time) |
| Build Time | None (instant) | ~15-20 minutes |
| Cost | Free | Free (or $99/year for TestFlight) |
| Standalone App | No | Yes |
| Performance | Good | Excellent |
| Best For | Quick testing, development | Pre-release testing, demos |

---

## Troubleshooting

### Expo Go Issues

**"Unable to connect to Expo"**
- Ensure iPhone and computer are on the same Wi-Fi network
- Check firewall settings (allow Expo on port 8081)
- Try `npm start -- --tunnel` to use Expo's tunnel (slower but works across networks)

**App crashes or errors**
- Check that all environment variables are set in `.env`
- Verify Firebase configuration is correct
- Check the terminal for error messages
- Try clearing Expo Go cache: Settings → Expo Go → Clear Cache

**QR code won't scan**
- Ensure terminal font is large enough
- Try the tunnel option: `npm start -- --tunnel`
- Or type the connection URL manually in Expo Go

### Development Build Issues

**Build fails**
- Check that `eas.json` is configured correctly
- Verify Apple Developer account is linked
- Check build logs on expo.dev

**App won't install**
- Verify iOS version compatibility (iOS 13.4+)
- Check device UDID is registered (if needed)
- Ensure proper code signing certificates

**App won't connect to dev server**
- Ensure development server is running
- Check network connectivity
- Verify bundle identifier matches configuration

---

## Recommended Approach

For **initial testing and development**, use **Expo Go** (Option 1). It's the fastest way to get your app running on your iPhone.

For **pre-release testing or demos**, use **Development Build** (Option 2) for a more polished experience.

