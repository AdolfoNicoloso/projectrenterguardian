# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Verify Setup
```bash
npm run verify-setup
```

This will check:
- ✅ Environment variables configured
- ✅ Required files present
- ✅ Assets available (warnings if missing)
- ✅ Dependencies installed

### 3. Start Development
```bash
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Press `w` for web browser

## 📱 First Run

1. **Sign Up / Log In**
   - Use any email/password in mock mode
   - Or use your Directus credentials if configured

2. **Create a Property**
   - Tap "Add Property"
   - Fill in address and lease dates
   - Default spaces will be created automatically

3. **Upload Photos**
   - Go to Photos tab
   - Tap "Upload Photos"
   - Select multiple images
   - Photos will appear in Assignments queue

4. **Assign Photos**
   - Go to Assignments tab
   - Select photos (long press)
   - Choose a space
   - Confirm assignment

5. **Generate Report**
   - Go to Report tab
   - Tap "Generate Move-In Report"
   - View in Report Archive

## 🔧 Troubleshooting

### "Cannot find module" errors
```bash
rm -rf node_modules
npm install
```

### Metro bundler cache issues
```bash
npm start -- --clear
```

### Assets missing warnings
The app will work without assets, but you'll see warnings. Add placeholder images to `assets/` directory or ignore for development.

### Environment variables not loading
- Make sure `.env` file is in the root directory
- Restart the Expo dev server after changing `.env`
- Use `EXPO_PUBLIC_` prefix for all environment variables

### iOS Simulator timeout error (xcrun simctl openurl timeout)
If you see "Operation timed out" when opening on iOS simulator, try these solutions:

**Solution 1: Ensure simulator is fully booted**
```bash
# Open Simulator manually first
open -a Simulator

# Wait for it to fully boot (home screen visible), then try again
npm start
# Then press 'i'
```

**Solution 2: Install Expo Go on the simulator**
1. Open Simulator manually: `open -a Simulator`
2. In the simulator, open Safari
3. Go to https://expo.dev/tools
4. Download and install Expo Go

**Solution 3: Reset the simulator**
```bash
# List all simulators
xcrun simctl list devices

# Erase a specific simulator (replace with your device UDID)
xcrun simctl erase 535DFB88-0C5A-45BF-99FF-5DC106BFA018

# Or erase all unavailable simulators
xcrun simctl erase all
```

**Solution 4: Use tunnel mode (if on different network)**
```bash
npm start -- --tunnel
```

**Solution 5: Manual URL opening**
After starting the dev server, manually open the Expo URL in Safari on the simulator, or scan the QR code if you have Expo Go installed.

**Solution 6: Check simulator status**
```bash
# Check if simulator is booted
xcrun simctl list devices | grep Booted

# Boot the simulator if not running
xcrun simctl boot "iPhone 16 Pro"
```

## 📚 Next Steps

- Read `SETUP.md` for detailed setup instructions
- Read `README.md` for project overview
- Check `src/services/directus.ts` for API integration details


