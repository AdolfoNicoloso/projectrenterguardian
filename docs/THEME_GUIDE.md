# Theme System Documentation

## Overview

The app uses a comprehensive dark mode theme system that supports both light and dark modes, with automatic system theme detection. All colors are theme-aware and automatically adapt based on the user's preference or system setting.

## Quick Start

```tsx
import { useTheme } from '../theme/useTheme';

function MyComponent() {
  const { colors, theme, isDark } = useTheme();
  
  return (
    <View style={{ backgroundColor: colors.background }}>
      <Text style={{ color: colors.text }}>Hello</Text>
    </View>
  );
}
```

## Available Theme Colors

### Background Colors
- `colors.background` - Primary background (#FFFFFF light, **#191414 dark**)
- `colors.backgroundSecondary` - Secondary background (#F9F9F9 light, #1F1A1A dark)
- `colors.backgroundTertiary` - Tertiary background (#F0F0F0 light, #241F1F dark)
- `colors.card` - Card background (#FFFFFF light, #1C1C1E dark)
- `colors.cardSecondary` - Secondary card (#F9F9F9 light, #2C2C2E dark)

### Text Colors
- `colors.text` - Primary text (#191414 light, #FFFFFF dark)
- `colors.textSecondary` - Secondary text (#404040 light, #EBEBF5 dark)
- `colors.textTertiary` - Tertiary text (muted, for dates, hints)
- `colors.textInverse` - Inverse text (#FFFFFF light, #191414 dark)

### Interactive Colors
- `colors.primary` - Primary accent (**#6F00FF** - stays consistent in both themes)
- `colors.primaryLight` - Lighter primary variant
- `colors.primaryDark` - Darker primary variant

### Semantic Colors
- `colors.error` - Error states (adapts for dark mode)
- `colors.success` - Success states (adapts for dark mode)
- `colors.warning` - Warning states (adapts for dark mode)
- `colors.info` - Info states (adapts for dark mode)

### UI Colors
- `colors.border` - Border color (subtle in dark mode)
- `colors.borderSecondary` - Secondary border
- `colors.inputBackground` - Input background
- `colors.inputBorder` - Input border
- `colors.inputPlaceholder` - Placeholder text
- `colors.overlay` - Modal overlay (darker in dark mode)

## Theme Hook API

```tsx
const {
  theme,        // 'light' | 'dark' - current effective theme
  colors,       // Theme-aware color palette (object)
  isDark,       // boolean - true if dark mode active
  preference,   // 'light' | 'dark' | 'auto' | null - user preference
  isLoading,    // boolean - true while loading preferences
  setPreference // (preference: 'light' | 'dark' | 'auto') => Promise<void>
} = useTheme();
```

## Migration Guide

### Step-by-Step Migration

1. **Import the hook:**
   ```tsx
   import { useTheme } from '../theme/useTheme';
   ```

2. **Add to component:**
   ```tsx
   const { colors } = useTheme();
   ```

3. **Replace hardcoded colors:**
   - `colors.dark` → `colors.text`
   - `colors.light` → `colors.background` or `colors.card`
   - `colors.gray[600]` → `colors.textSecondary`
   - `colors.gray[300]` → `colors.border`
   - `#FFFFFF` → `colors.background` or `colors.card`
   - `#000000` → `colors.text`

4. **Update StyleSheet:**
   ```tsx
   // Before
   const styles = StyleSheet.create({
     container: {
       backgroundColor: colors.light,
       color: colors.dark,
     },
   });
   
   // After - use inline styles with theme
   <View style={[styles.container, { backgroundColor: colors.background, color: colors.text }]} />
   ```

## Best Practices

1. ✅ **Always use theme tokens** - Never hardcode colors like `#FFFFFF`, `#000000`
2. ✅ **Use semantic names** - Prefer `colors.text` over `colors.dark`
3. ✅ **Test in both themes** - Verify components in light and dark mode
4. ✅ **Maintain contrast** - Ensure text is readable (especially in dark mode)
5. ✅ **Purple stays purple** - Primary color (#6F00FF) is consistent in both themes

## Brand Colors

- **Primary/Accent**: **#6F00FF** (purple - consistent in both themes)
- **Dark Background**: **#191414** (dark mode background)
- **Light Background**: **#FFFFFF** (light mode background)

## Common Patterns

### Cards
```tsx
<View style={[{ backgroundColor: colors.card }, styles.card]}>
  <Text style={{ color: colors.text }}>Card Content</Text>
</View>
```

### Inputs
```tsx
<TextInput
  style={{
    backgroundColor: colors.inputBackground,
    borderColor: colors.inputBorder,
    color: colors.text,
  }}
  placeholderTextColor={colors.inputPlaceholder}
/>
```

### Section Headers
```tsx
<View style={{ backgroundColor: colors.backgroundSecondary }}>
  <Text style={{ color: colors.textSecondary }}>Section</Text>
</View>
```

### Error Messages
```tsx
<View style={{ backgroundColor: colors.error + '20' }}>
  <Text style={{ color: colors.error }}>Error message</Text>
</View>
```

## Implementation Status

✅ Core theme system implemented  
✅ All components migrated (PRGButton, PRGCard, PRGInput, etc.)  
✅ Auth screens migrated (login, signup)  
✅ Properties list screen migrated  
⏳ Remaining screens being migrated (see TODOs)

## Notes

- Dark mode uses **#191414** as the primary background (brand color)
- Cards use slightly lighter backgrounds (#1F1A1A, #1C1C1E) for elevation
- Text uses high contrast (#FFFFFF, #EBEBF5) for readability in dark mode
- Borders are subtle in dark mode (#38383A, #48484A)

