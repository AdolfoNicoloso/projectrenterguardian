# iOS Development Build - Step by Step Guide

This guide will walk you through creating and installing a development build of the Renter Guardian app on your iPhone. This is necessary when your Expo Go app version doesn't match the project's Expo SDK version (e.g., Expo Go SDK 54 vs project SDK 51).

## Prerequisites

Before you begin, ensure you have:

- ✅ A Mac computer (required for iOS builds)
- ✅ An Expo account (free at [expo.dev](https://expo.dev))
- ✅ An Apple Developer account (free or paid)
- ✅ Your iPhone connected to the same Wi-Fi network as your computer
- ✅ Node.js and npm installed
- ✅ Environment variables configured (Firebase keys in `.env` file)

---

## Step 1: Install EAS CLI

EAS (Expo Application Services) CLI is the tool you'll use to build your app.

```bash
npm install -g eas-cli
```

Verify the installation:

```bash
eas --version
```

---

## Step 2: Log in to Expo

Log in to your Expo account (create one at [expo.dev](https://expo.dev) if you don't have one):

```bash
eas login
```

This will open a browser window for authentication. After logging in, verify your login:

```bash
eas whoami
```

---

## Step 3: Install expo-dev-client

Development builds require the `expo-dev-client` package. Install it in your project:

```bash
npm install expo-dev-client
```

This package enables your app to connect to the Expo development server for hot reloading.

---

## Step 4: Configure EAS Build

Initialize EAS Build configuration in your project:

```bash
eas build:configure
```

This command will:
- Create an `eas.json` file in your project root
- Ask you a few questions about your build setup
- Set up build profiles (development, preview, production)

**Recommended answers:**
- **Build profile:** Development
- **Auto-submit to stores:** No (for now)
- **Build configuration:** Default is fine

The generated `eas.json` should look something like this:

```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

---

## Step 5: Link Apple Developer Account

Link your Apple Developer account to EAS:

```bash
eas credentials
```

Then select:
1. **iOS** platform
2. **Setup credentials for development build** (or similar option)
3. Follow the prompts to authenticate with Apple

**Options:**
- **Free Apple Developer Account:** You can use a free account, but you'll need to install the app manually (not via TestFlight)
- **Paid Apple Developer Account ($99/year):** Allows automatic distribution via TestFlight

EAS will guide you through:
- Signing in with your Apple ID
- Registering your device (if needed)
- Setting up code signing certificates (automatic)

---

## Step 6: Build the Development App

Start the build process:

```bash
eas build --platform ios --profile development
```

**What happens:**
1. EAS uploads your project to Expo's build servers
2. Expo builds your app in the cloud
3. The build typically takes **15-20 minutes**
4. You'll see a build URL in your terminal
5. You can check build status at [expo.dev](https://expo.dev) in your project's builds section

**Important notes:**
- Keep your terminal open to see the build progress
- You can check build logs on expo.dev if something fails
- The build process will ask if you want to configure credentials if not already done

---

## Step 7: Install the App on Your iPhone

After the build completes, you have several options to install:

### Option A: Install via Expo Build Link (Easiest)

1. **Find your build URL:**
   - Check your terminal for the build URL, or
   - Go to [expo.dev](https://expo.dev) → Your Project → Builds

2. **Open the build URL on your iPhone:**
   - Copy the build URL
   - Send it to yourself (email, messages, etc.)
   - Open it on your iPhone's Safari browser

3. **Install the app:**
   - Tap "Install" or "Download"
   - You may need to trust the developer certificate:
     - Go to Settings → General → VPN & Device Management
     - Tap your Apple Developer account
     - Tap "Trust [Your Name]"
   - The app will install on your iPhone

### Option B: Install via TestFlight (Requires Paid Developer Account)

If you have a paid Apple Developer account ($99/year):

1. **Install TestFlight:**
   - Download TestFlight from the App Store on your iPhone

2. **Set up automatic distribution:**
   - When building, EAS can automatically submit to TestFlight
   - Or manually submit: `eas build --platform ios --profile development --auto-submit`

3. **Accept invitation:**
   - You'll receive an email invitation to test the app
   - Open the email on your iPhone
   - Tap the TestFlight link
   - Install via TestFlight

### Option C: Install via .ipa File (Manual)

1. **Download the .ipa file:**
   - Download from the build page on expo.dev
   - Or from the build URL

2. **Install using Apple Configurator 2 (Mac):**
   - Install Apple Configurator 2 from the Mac App Store
   - Connect your iPhone via USB
   - Drag the .ipa file onto your device in Apple Configurator
   - Follow the prompts

---

## Step 8: Start the Development Server

After the app is installed on your iPhone, start the Expo development server on your computer:

```bash
npm start
```

Or use the dev client mode:

```bash
npx expo start --dev-client
```

**What you'll see:**
- A QR code in your terminal
- A local network URL (e.g., `exp://192.168.1.x:8081`)

---

## Step 9: Connect Your iPhone to the Dev Server

Open the **Renter Guardian** app on your iPhone (the development build you just installed).

**The app should automatically:**
- Connect to the development server on your local network
- Load your app code
- Display your app

**If it doesn't connect automatically:**

1. **Shake your iPhone** to open the developer menu
2. **Tap "Enter URL manually"**
3. **Enter the URL** from your terminal (e.g., `exp://192.168.1.x:8081`)
4. **Tap "Connect"**

---

## Step 10: Development Workflow

Now you're set up! Here's your development workflow:

### Making Changes

1. **Edit your code** in your editor
2. **Save the file**
3. **The app auto-reloads** on your iPhone (fast refresh)

### Developer Menu

- **Shake your iPhone** to open the developer menu
- **Or press `m` in your terminal** to toggle the menu

### Manual Reload

- **Shake iPhone** → Tap "Reload"
- **Or press `r` in your terminal**

### Debugging

- Check terminal logs for errors
- Use React Native Debugger or Chrome DevTools
- Enable remote debugging from the developer menu

---

## Troubleshooting

### Build Fails

**"Credentials not found"**
- Run `eas credentials` and set up your Apple Developer account
- Ensure you're logged in: `eas whoami`

**"Bundle identifier already in use"**
- Your bundle identifier (`com.renterguardian.app`) might already be registered
- You can change it in `app.json` under `ios.bundleIdentifier`
- Or use a different Apple Developer account

**"Build timeout"**
- Free Expo accounts have build time limits
- Try again, or consider upgrading to a paid Expo plan

**"Missing icon or splash screen"**
- Check that `assets/icon.png` and `assets/splash.png` exist
- Run `npm run setup-assets` if needed

### App Won't Install

**"Unable to install" or "Untrusted Developer"**
- Go to Settings → General → VPN & Device Management
- Tap your Apple Developer account
- Tap "Trust [Your Name]"

**"App installation failed"**
- Ensure your iPhone is on iOS 13.4 or later
- Check that you have enough storage space
- Try restarting your iPhone

### App Won't Connect to Dev Server

**"Unable to connect to development server"**
- Ensure your iPhone and computer are on the same Wi-Fi network
- Check your firewall settings (allow port 8081)
- Try the tunnel option: `npx expo start --dev-client --tunnel`
- Verify the URL in the developer menu matches your terminal

**"Network request failed"**
- Restart the development server: `npm start`
- Try clearing the app's cache (reinstall the app)
- Check that your computer's firewall isn't blocking connections

### App Crashes

**App crashes on launch**
- Check terminal logs for errors
- Verify all environment variables are set in `.env`
- Ensure Firebase configuration is correct
- Try rebuilding: `eas build --platform ios --profile development --clear-cache`

**"Module not found" errors**
- Ensure all dependencies are installed: `npm install`
- Rebuild the app with `--clear-cache` flag

---

## Rebuilding the App

If you need to rebuild the app (e.g., after adding native dependencies):

```bash
eas build --platform ios --profile development
```

To clear cache and force a clean build:

```bash
eas build --platform ios --profile development --clear-cache
```

---

## Next Steps

Once your development build is working:

- ✅ Make code changes and see them reload on your iPhone
- ✅ Test app functionality on a real device
- ✅ Use the developer menu for debugging
- ✅ When ready, create a production build: `eas build --platform ios --profile production`

---

## Quick Command Reference

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Install dev client
npm install expo-dev-client

# Configure builds
eas build:configure

# Setup credentials
eas credentials

# Build for iOS development
eas build --platform ios --profile development

# Start dev server
npm start
# or
npx expo start --dev-client

# Rebuild with cache cleared
eas build --platform ios --profile development --clear-cache

# Check build status
eas build:list
```

---

## Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Development Builds Guide](https://docs.expo.dev/development/introduction/)
- [Expo Discord Community](https://chat.expo.dev/)
- [EAS Build Status](https://status.expo.dev/)

