# Setup Instructions

## Initial Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   
   Create a `.env` file in the root directory with the following variables:
   
   **Firebase Configuration (Required for Authentication):**
   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```
   
   **Directus Configuration (Optional - for data):**
   ```
   EXPO_PUBLIC_DIRECTUS_URL=https://your-directus-instance.com
   ```
   
   To get your Firebase configuration:
   1. Go to [Firebase Console](https://console.firebase.google.com/)
   2. Create a new project or select an existing one
   3. Go to Project Settings > General
   4. Scroll down to "Your apps" and add a web app (or use existing)
   5. Copy the configuration values to your `.env` file
   
   **Important:** Make sure to enable the following in Firebase Console:
   - Authentication > Sign-in method > Email/Password (enable)
   - Authentication > Sign-in method > Google (enable and configure)
   
   If `EXPO_PUBLIC_DIRECTUS_URL` is not set, the app will run in mock mode with sample data.

3. **Verify Setup**
   
   Run the verification script to check everything is configured:
   ```bash
   npm run verify-setup
   ```

4. **Add Assets (Optional for Development)**
   
   Add the following files to the `assets/` directory:
   - `icon.png` (1024x1024)
   - `splash.png` (1242x2436 recommended)
   - `adaptive-icon.png` (1024x1024)
   - `favicon.png` (48x48)

   You can use placeholder images for development. The app will work without them, but you'll see warnings.

5. **Start Development Server**
   ```bash
   npm start
   ```

## Running on Different Platforms

- **iOS Simulator**: Press `i` in the terminal or run `npm run ios`
- **Android Emulator**: Press `a` in the terminal or run `npm run android`
- **Web**: Press `w` in the terminal or run `npm run web`

## Project Structure

- `app/` - Expo Router screens and navigation
- `src/components/` - Reusable UI components
- `src/screens/` - Screen components (used within property dashboard)
- `src/services/` - API client and storage utilities
- `src/state/` - Zustand state management
- `src/theme/` - Design system tokens
- `src/types/` - TypeScript type definitions

## Key Features

### Authentication
- Sign Up / Log In screens with email/password
- Google Sign-In (web support, mobile requires additional setup)
- Firebase Authentication integration
- Token-based authentication with secure storage
- Profile screen

### Properties
- List all properties
- Create new property
- Property dashboard with tabs (Overview, Spaces, Photos, Assignments, Report)

### Spaces
- View spaces for a property
- Edit space display names
- Default spaces created automatically by backend

### Photos
- Multi-select photo upload
- Photo gallery with filters (All, Unassigned, Assigned)
- Photo detail view with assignment and notes

### Assignments
- Assignment queue showing unassigned photos
- Bulk assignment to spaces
- Manual assignment confirmation

### Reports
- Generate move-in report snapshot
- View report archive
- Display disclaimers
- Export PDF (when available)

## Mock Mode

When running without a Directus URL, the app uses mock data:
- Sample property with default spaces
- Mock authentication (accepts any email/password)
- Simulated API responses

This allows development and testing without a backend connection.

## Next Steps

1. Connect to your Directus instance by setting `EXPO_PUBLIC_DIRECTUS_URL`
2. Update the `app_profile_id` in property creation to use actual user profile
3. Implement actual file URL generation for photos
4. Add PDF export functionality
5. Enhance error handling and offline support

