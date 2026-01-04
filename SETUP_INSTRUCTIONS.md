# Universal Photo Details Experience - Setup Instructions

## ✅ Completed Implementation Files

The following files have been created:

1. **Core Types & Utilities:**
   - `src/features/photos/types.ts` - PhotoScope and ViewRect types
   - `src/features/photos/scope.ts` - buildPhotoScope and generateScopeId utilities
   - `src/features/photos/transition/PhotoHeroTransitionStore.ts` - Zustand store for transition state
   - `src/features/photos/transition/PhotoHeroTransitionOverlay.tsx` - Transition overlay component
   - `src/features/photos/viewer/PhotoFullscreenViewer.tsx` - Fullscreen viewer component
   - `src/features/photos/hooks/usePhotoTransition.ts` - Hook for photo transitions
   - `src/features/photos/index.ts` - Barrel exports

2. **Documentation:**
   - `IMPLEMENTATION_NOTES.md` - Technical notes about dependencies

## ⚠️ Required Manual Steps

### Step 1: Install Dependencies

```bash
npm install react-native-reanimated react-native-gesture-handler
```

### Step 2: Update Babel Configuration

Edit `babel.config.js` and add the Reanimated plugin **as the LAST plugin**:

```js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
      'react-native-reanimated/plugin', // ⚠️ MUST be last
    ],
  };
};
```

### Step 3: Update App Entry Point

Add at the **very top** of `app/_layout.tsx` (before any other imports):

```tsx
import 'react-native-gesture-handler';
```

### Step 4: iOS Pod Install (if building for iOS)

```bash
cd ios && pod install && cd ..
```

### Step 5: Restart Development Server

After making the above changes, restart your Expo development server:

```bash
npm start
# Then press 'r' to reload or rebuild the app
```

## 🔧 Remaining Implementation Steps

The core infrastructure is in place, but the following integration steps need to be completed:

1. **Update PRGPhotoGrid component** - Add measurement refs and integrate usePhotoTransition hook
2. **Update Photo Details screen** - Make it scope-aware with horizontal swipe navigation
3. **Update collection screens** - PropertyPhotos, PropertyAssignments, and Space detail screens to use the scope system
4. **Add transition overlay to root layout** - Render PhotoHeroTransitionOverlay at app root level
5. **Fix any TypeScript/import errors** - Resolve any compilation issues

## 📝 Next Steps Summary

1. Install dependencies (Step 1)
2. Update babel config (Step 2)
3. Update app entry point (Step 3)
4. Complete the integration steps listed above
5. Test the implementation

## 🐛 Troubleshooting

- **Reanimated not working**: Ensure the plugin is LAST in babel.config.js plugins array
- **Gesture handler errors**: Ensure import is at the very top of _layout.tsx
- **TypeScript errors**: May need to install @types packages or adjust type definitions
- **Animation not smooth**: Ensure useNativeDriver is used where possible

