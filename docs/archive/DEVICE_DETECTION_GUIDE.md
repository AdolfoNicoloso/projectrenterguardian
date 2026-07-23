# Device Detection Guide for React Native Web

## Overview

In React Native Web, `Platform.OS` only tells you it's `'web'`, not whether it's mobile, tablet, or desktop. Here are the recommended methods to detect device type.

## Method 1: Screen Width (Recommended) ✅

**Most reliable method** - Use `useWindowDimensions()` or `Dimensions.get('window')`.

### Standard Breakpoints:
- **Mobile (Phone)**: width < 768px
- **Tablet (iPad, Android tablets)**: 768px ≤ width < 1024px  
- **Desktop**: width ≥ 1024px

### Usage with Hook:

```tsx
import { useWindowDimensions } from 'react-native';
import { getDeviceType, isMobileDevice } from '../utils/deviceDetection';

function MyComponent() {
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);
  const isMobile = isMobileDevice(width);

  if (isMobile) {
    // Mobile-specific styling
  }

  return <View>...</View>;
}
```

### Usage without Hook:

```tsx
import { Dimensions } from 'react-native';
import { getDeviceTypeFromDimensions } from '../utils/deviceDetection';

const deviceType = getDeviceTypeFromDimensions();
```

## Method 2: User Agent Detection (Alternative)

**Less reliable** - Can be spoofed, but useful for detecting device capabilities.

```tsx
import { detectDeviceFromUserAgent } from '../utils/deviceDetection';

const deviceType = detectDeviceFromUserAgent();
// Returns: 'mobile' | 'tablet' | 'desktop' | null
```

**Note:** Modern iPads report as macOS in user agent, so this method has limitations.

## Method 3: Touch Detection (Web Only)

Check if device supports touch:

```tsx
const isTouchDevice = Platform.OS === 'web' && 
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);
```

## Common Use Cases

### Example 1: Responsive Tab Bar Height

```tsx
import { useWindowDimensions } from 'react-native';
import { isMobileDevice } from '../utils/deviceDetection';

function TabsLayout() {
  const { width } = useWindowDimensions();
  const isMobile = isMobileDevice(width);

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          height: isMobile ? 60 : 70,  // Different heights
        },
      }}
    />
  );
}
```

### Example 2: Conditional Styling

```tsx
import { useWindowDimensions } from 'react-native';
import { getDeviceType } from '../utils/deviceDetection';

function MyScreen() {
  const { width } = useWindowDimensions();
  const deviceType = getDeviceType(width);

  const padding = deviceType === 'mobile' 
    ? spacing.md 
    : spacing.xl;

  return <View style={{ padding }}>...</View>;
}
```

### Example 3: Platform + Device Detection

```tsx
import { Platform } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { isMobileDevice } from '../utils/deviceDetection';

function MyComponent() {
  const { width } = useWindowDimensions();
  const isWebMobile = Platform.OS === 'web' && isMobileDevice(width);
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  // Apply mobile styles for both native and web mobile
  if (isNative || isWebMobile) {
    // Mobile styling
  }
}
```

## Breakpoint Reference

| Device Type | Width Range | Common Devices |
|------------|-------------|----------------|
| Mobile | < 768px | iPhone (320-428px), Android phones (360-412px) |
| Tablet | 768px - 1024px | iPad (768px, 1024px), Android tablets |
| Desktop | ≥ 1024px | Laptops (1366px+), Desktops (1920px+) |

## Best Practices

1. **Use screen width as primary method** - Most reliable and accurate
2. **Use breakpoints consistently** - 768px is standard mobile/tablet breakpoint
3. **Test on actual devices** - Emulators may not match real device dimensions
4. **Handle orientation changes** - `useWindowDimensions` updates automatically
5. **Avoid user agent when possible** - Can be spoofed and unreliable

## Utilities Available

See `src/utils/deviceDetection.ts` for helper functions:
- `getDeviceType(width)` - Get device type from width
- `isMobileDevice(width)` - Check if mobile
- `isTabletDevice(width)` - Check if tablet  
- `isDesktopDevice(width)` - Check if desktop
- `getDeviceTypeFromDimensions()` - Get from Dimensions API
- `detectDeviceFromUserAgent()` - User agent detection
- `detectDeviceType(width?)` - Combined method

