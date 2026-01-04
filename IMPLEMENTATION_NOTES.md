# Photo Details Experience Implementation Notes

## Dependencies Required

Before running the app, install the following dependencies:

```bash
npm install react-native-reanimated react-native-gesture-handler
```

## Babel Configuration

Update `babel.config.js` to include the Reanimated plugin:

```js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // Add this - MUST be last
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
    ],
  };
};
```

**Important**: The `react-native-reanimated/plugin` must be listed LAST in the plugins array.

## Entry Point Setup

In your app entry point (likely `app/_layout.tsx` or `index.js`), add at the top:

```js
import 'react-native-gesture-handler';
```

This import must come before any other imports.

## iOS Setup (if building native)

If building for iOS, you may need to run:
```bash
cd ios && pod install
```

## Android Setup

No additional setup required for Android.

