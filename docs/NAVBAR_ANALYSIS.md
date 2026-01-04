# Navigation Bar Setup Analysis

## Current Configuration

### Tab Bar Style (`tabBarStyle`)
```typescript
{
  backgroundColor: themeColors.background,
//   borderTopColor: themeColors.border,
  borderTopWidth: 1,
  height: 60 + insets.bottom,     // Total height: 60px + safe area
  paddingBottom: insets.bottom,   // Bottom padding = safe area
  paddingTop: 8,                  // Top padding: 8px
  elevation: 0,
  shadowOpacity: 0,
}
```

**Available space for icons:**
- Total height: `60 + insets.bottom`
- After paddingTop (8px): `52 + insets.bottom` available
- After paddingBottom (`insets.bottom`): `52px` of usable space for icons

### Tab Bar Item Style (`tabBarItemStyle`)
```typescript
{
  paddingVertical: 0,              // No vertical padding
  justifyContent: 'center',        // Center vertically
  alignItems: 'center',            // Center horizontally
}
```

### Icon Sizing
```typescript
const iconSize = Math.max(26, Math.min(32, width * 0.075));
// Icons range from 26px to 32px
```

## Hypotheses for Icon Clipping on Web (but not iOS)

### 1. **Safe Area Insets Difference** ⚠️ MOST LIKELY
**Issue:** On web, `insets.bottom` is typically `0`, while on iOS it's the home indicator height (usually 34px on modern iPhones).

**Impact:**
- **iOS**: Total height = 60 + 34 = 94px, usable space = 52px (plenty for 26-32px icons)
- **Web**: Total height = 60 + 0 = 60px, usable space = 52px (same, but...)

**But wait:** The real issue might be that `paddingBottom: insets.bottom` on web means `paddingBottom: 0`, so the bottom padding doesn't exist, but the `height` calculation might cause issues.

### 2. **SVG Rendering Differences** ⚠️ LIKELY
**Issue:** SVG rendering on web via `react-native-svg` might:
- Have different default `viewBox` behavior
- Apply different default margins/padding
- Render with different box-sizing (content-box vs border-box)
- Have stroke-width that extends beyond the viewBox

**Impact:** A 32px SVG icon might actually render as 34-36px due to stroke/padding, causing clipping.

### 3. **Tab Bar Item Container Constraints** ⚠️ POSSIBLE
**Issue:** On web, the tab bar item container might:
- Have implicit padding/margins
- Not respect `justifyContent: 'center'` the same way
- Have different overflow behavior (clip vs visible)

**Impact:** Icons might be clipped even if they "fit" in the calculated space.

### 4. **PaddingTop Reducing Space** ⚠️ POSSIBLE
**Issue:** The `paddingTop: 8px` reduces available space from 60px to 52px.

**Impact:** With 32px icons, there's only 20px of vertical padding (10px top, 10px bottom if centered), which might be too tight on web.

### 5. **Icon Size Calculation** ⚠️ UNLIKELY BUT POSSIBLE
**Issue:** `width * 0.075` might calculate differently on web vs iOS:
- On mobile browser, viewport width might be different
- This could result in larger icons (approaching 32px max) more often on web

**Impact:** Larger icons (30-32px) have less margin, increasing clipping risk.

## Recommended Fixes

### Fix 1: Increase Available Vertical Space
Reduce or remove `paddingTop` to give more room:

```typescript
tabBarStyle: {
  // ... other styles
  paddingTop: Platform.OS === 'web' ? 4 : 8,  // Less padding on web
  // OR
  paddingTop: 0,  // Remove padding entirely if not needed
}
```

### Fix 2: Add Explicit Icon Container Constraints
Wrap SVGIcon in a View with explicit dimensions:

```typescript
tabBarIcon: ({ focused }) => {
  const IconComponent = getNavIcon('properties', focused, theme);
  return (
    <View style={{ width: iconSize, height: iconSize, justifyContent: 'center', alignItems: 'center' }}>
      <SVGIcon source={IconComponent} size={iconSize} />
    </View>
  );
}
```

### Fix 3: Reduce Icon Size Slightly
Ensure icons are smaller than available space:

```typescript
// Reserve 12px total padding (6px top + 6px bottom)
const maxIconSize = Platform.OS === 'web' ? 40 : 32;  // 60 - 8 - 12 = 40px available
const iconSize = Math.max(24, Math.min(maxIconSize, width * 0.075));
```

### Fix 4: Add Overflow Handling
Ensure container doesn't clip:

```typescript
tabBarItemStyle: {
  paddingVertical: 0,
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'visible',  // Ensure icons aren't clipped
  minHeight: iconSize + 16,  // Ensure minimum space
}
```

### Fix 5: Platform-Specific Tab Bar Height
Adjust height calculation for web:

```typescript
tabBarStyle: {
  // ... other styles
  height: Platform.OS === 'web' 
    ? 64  // Fixed height on web (more space)
    : 60 + insets.bottom,  // Dynamic on iOS
  paddingTop: Platform.OS === 'web' ? 8 : 8,
}
```

