# Directus CMS Connection Guide

## ✅ Yes, the app connects to your Directus CMS!

The app is fully configured to connect to your Directus instance. Here's how it works:

## 🔌 How It Connects

### 1. Environment Configuration

The app reads your Directus URL from the `.env` file:

```env
EXPO_PUBLIC_DIRECTUS_URL=https://your-directus-instance.com
```

**Important:** The `EXPO_PUBLIC_` prefix is required for Expo to expose the variable to your app.

### 2. Connection Logic

The app automatically detects if a Directus URL is configured:

- **If URL is set:** Connects to your real Directus instance
- **If URL is missing/empty:** Runs in mock mode with sample data

You can see this in `src/services/directus.ts`:

```typescript
const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL || '';
const USE_MOCK = !DIRECTUS_URL;
```

### 3. API Endpoints Used

The app connects to these Directus endpoints:

#### Authentication
- `POST /auth/login` - User login
- `POST /users` - User registration

#### Collections (Phase 1)
- `GET /items/properties` - List properties
- `POST /items/properties` - Create property
- `GET /items/spaces` - List spaces
- `PATCH /items/spaces/:id` - Update space
- `GET /items/photos` - List photos
- `POST /items/photos` - Create photo metadata
- `POST /items/photo_space_assignments` - Create assignment
- `GET /items/reports` - List reports
- `POST /items/reports` - Create report
- `PATCH /items/reports/:id` - Update report
- `GET /items/disclaimer_blocks` - Get disclaimers
- `GET /items/jurisdiction_context` - Get jurisdiction info

#### Files
- `POST /files` - Upload photo files

## 🔐 Authentication

The app uses token-based authentication:

1. User logs in → Gets access token from Directus
2. Token stored securely using Expo SecureStore
3. Token automatically included in all API requests via `Authorization: Bearer <token>` header

## 📋 Required Directus Collections

Make sure your Directus instance has these collections configured (as per the wireframe):

- ✅ `properties` (belongs to `app_profiles`)
- ✅ `spaces` (belongs to `properties`)
- ✅ `photos` (belongs to `properties`, references `directus_files`)
- ✅ `photo_space_assignments` (junction table)
- ✅ `reports` (belongs to `properties`)
- ✅ `disclaimer_blocks` (content-managed)
- ✅ `jurisdiction_context` (state-level data)
- ✅ `app_profiles` (user profiles)

## 🧪 Testing the Connection

### 1. Check Your .env File

Make sure your `.env` file contains:
```env
EXPO_PUBLIC_DIRECTUS_URL=https://your-actual-directus-url.com
```

**No trailing slash!** The app handles that automatically.

### 2. Verify Connection

When you start the app:
- If connected: You'll see real data from your Directus instance
- If mock mode: You'll see sample data and the app will still work

### 3. Test Authentication

Try logging in with your Directus user credentials:
- If it works → Connected! ✅
- If it fails → Check your Directus URL and permissions

## 🔧 Troubleshooting

### "Network request failed"
- Check your Directus URL is correct
- Verify your Directus instance is accessible
- Check CORS settings in Directus (if accessing from web)

### "Unauthorized" errors
- Verify your Directus user has proper permissions
- Check that the collections exist and are accessible
- Ensure authentication is working

### App uses mock data
- Check `.env` file exists and has `EXPO_PUBLIC_DIRECTUS_URL`
- Restart Expo dev server after changing `.env`
- Verify the URL doesn't have a trailing slash

## 📝 Next Steps

1. **Set your Directus URL** in `.env`:
   ```
   EXPO_PUBLIC_DIRECTUS_URL=https://your-directus-instance.com
   ```

2. **Restart the dev server** after changing `.env`:
   ```bash
   npm start -- --clear
   ```

3. **Test the connection** by logging in with your Directus credentials

4. **Verify collections** exist in your Directus admin panel

## 🎯 Mock Mode vs Real Connection

| Feature | Mock Mode | Real Directus |
|---------|-----------|---------------|
| Data Source | In-memory sample data | Your Directus database |
| Authentication | Accepts any email/password | Real Directus users |
| Persistence | Data resets on app restart | Data persists in database |
| Use Case | Development/testing | Production |

The app seamlessly switches between modes based on your `.env` configuration!


