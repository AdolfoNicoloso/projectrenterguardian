# Renter Guardian Design Guide

## Table of Contents
1. [Design Tokens](#design-tokens)
2. [Components](#components)
3. [Layout Patterns](#layout-patterns)
4. [Usage Guidelines](#usage-guidelines)

---

## Design Tokens

### Colors

#### Primary Colors
- **Primary**: `#6F00FF` (Purple) - Main brand color, used for primary actions and accents
- **Dark**: `#191414` - Primary text color
- **Light**: `#FFFFFF` - Background and text on dark backgrounds

#### Gray Scale
- `gray.50`: `#F9F9F9` - Lightest background
- `gray.100`: `#F0F0F0` - Light background
- `gray.200`: `#E0E0E0` - Borders, dividers
- `gray.300`: `#C0C0C0` - Input borders
- `gray.400`: `#808080` - Placeholder text
- `gray.500`: `#606060` - Secondary text
- `gray.600`: `#404040` - Body text
- `gray.700`: `#303030` - Dark text
- `gray.800`: `#202020` - Very dark text
- `gray.900`: `#101010` - Darkest text

#### Semantic Colors
- **Error**: `#FF3B30` - Error states, destructive actions
- **Success**: `#34C759` - Success states, confirmations
- **Warning**: `#FF9500` - Warning states, cautions
- **Info**: `#007AFF` - Informational messages

### Typography

#### Font Families
- **Regular**: System default
- **Medium**: System default
- **Bold**: System default

#### Font Sizes
- `xs`: 12px - Small labels, captions
- `sm`: 14px - Secondary text, form labels
- `base`: 16px - Body text, default size
- `lg`: 18px - Emphasized text
- `xl`: 20px - Section headers
- `2xl`: 24px - Page titles
- `3xl`: 30px - Large titles
- `4xl`: 36px - Hero titles

#### Font Weights
- `regular`: 400 - Body text
- `medium`: 500 - Labels, emphasis
- `semibold`: 600 - Headings
- `bold`: 700 - Strong emphasis, titles

#### Line Heights
- `tight`: 1.2 - Headings
- `normal`: 1.5 - Body text
- `relaxed`: 1.75 - Long-form content

### Spacing

Scale-based spacing system (multiples of 4):
- `xs`: 4px - Tight spacing
- `sm`: 8px - Small gaps
- `md`: 16px - Default spacing
- `lg`: 24px - Section spacing
- `xl`: 32px - Large spacing
- `2xl`: 48px - Extra large spacing
- `3xl`: 64px - Maximum spacing

---

## Components

### PRGButton

**Purpose**: Primary interactive element for user actions

**Variants**:
- `primary` (default): Purple background, white text - Primary actions
- `secondary`: Transparent with purple border - Secondary actions
- `ghost`: Transparent, purple text - Tertiary actions

**Props**:
- `title: string` - Button text (required)
- `onPress: () => void` - Click handler (required)
- `variant?: 'primary' | 'secondary' | 'ghost'` - Style variant
- `disabled?: boolean` - Disabled state
- `loading?: boolean` - Loading state with spinner
- `style?: ViewStyle` - Custom styles

**Specifications**:
- Min height: 48px
- Border radius: 8px
- Padding: 16px vertical, 24px horizontal
- Disabled opacity: 0.5
- Active opacity: 0.7

**Usage**:
```tsx
<PRGButton
  title="Sign In"
  onPress={handleLogin}
  variant="primary"
  loading={isLoading}
/>
```

---

### PRGInput

**Purpose**: Text input fields for forms

**Props**:
- `label?: string` - Field label
- `error?: string` - Error message
- `containerStyle?: ViewStyle` - Container styles
- All standard `TextInputProps`

**Specifications**:
- Min height: 48px
- Border radius: 8px
- Border: 1px solid `gray.300`
- Error border: `error` color
- Padding: 8px vertical, 16px horizontal
- Placeholder color: `gray.400`

**Usage**:
```tsx
<PRGInput
  label="Email"
  value={email}
  onChangeText={setEmail}
  keyboardType="email-address"
  error={emailError}
/>
```

---

### PRGCard

**Purpose**: Container for grouped content

**Props**:
- `children: React.ReactNode` - Card content
- `onPress?: () => void` - Makes card tappable
- `style?: ViewStyle` - Custom styles

**Specifications**:
- Background: White
- Border radius: 12px
- Padding: 16px
- Shadow: Subtle elevation (shadowOpacity: 0.1)
- Elevation: 3 (Android)

**Usage**:
```tsx
<PRGCard onPress={handlePress}>
  <Text>Card Content</Text>
</PRGCard>
```

---

### PRGBadge

**Purpose**: Status indicators and labels

**Variants**:
- `default`: Gray background
- `success`: Green background (20% opacity)
- `warning`: Orange background (20% opacity)
- `error`: Red background (20% opacity)

**Props**:
- `label: string` - Badge text (required)
- `variant?: 'default' | 'success' | 'warning' | 'error'`
- `style?: ViewStyle` - Custom styles

**Specifications**:
- Border radius: 12px
- Padding: 4px vertical, 8px horizontal
- Font size: 12px
- Font weight: Medium

**Usage**:
```tsx
<PRGBadge label="Active" variant="success" />
```

---

### PRGEmptyState

**Purpose**: Display when no content is available

**Props**:
- `title: string` - Main message (required)
- `message?: string` - Secondary description
- `icon?: React.ReactNode` - Optional icon
- `actionLabel?: string` - Button text
- `onAction?: () => void` - Action handler

**Specifications**:
- Centered layout
- Title: 20px, semibold
- Message: 16px, gray.600
- Padding: 32px

**Usage**:
```tsx
<PRGEmptyState
  title="No Properties"
  message="Get started by adding your first property"
  actionLabel="Add Property"
  onAction={handleAdd}
/>
```

---

### PRGLoadingOverlay

**Purpose**: Full-screen loading indicator

**Props**:
- `visible: boolean` - Show/hide overlay
- `message?: string` - Optional loading message
- `progress?: number` - Progress percentage (0-100)

**Specifications**:
- Modal overlay with 50% black background
- White container with 12px border radius
- Primary color spinner
- Optional progress bar

**Usage**:
```tsx
<PRGLoadingOverlay
  visible={isLoading}
  message="Loading properties..."
  progress={uploadProgress}
/>
```

---

### PRGToast

**Purpose**: Temporary notification messages

**Types**:
- `success`: Green background
- `error`: Red background
- `info`: Blue background (default)

**Props**:
- `message: string` - Toast message (required)
- `type?: 'success' | 'error' | 'info'`
- `visible: boolean` - Show/hide
- `onHide: () => void` - Hide callback
- `duration?: number` - Display duration (default: 3000ms)

**Specifications**:
- Position: Top of screen (60px from top)
- Border radius: 8px
- Padding: 16px
- Auto-dismiss with fade animation
- White text

**Usage**:
```tsx
<PRGToast
  message="Property saved successfully"
  type="success"
  visible={showToast}
  onHide={() => setShowToast(false)}
/>
```

---

### Additional Components

- **PRGPhotoGrid**: Photo gallery component
- **PRGTabBar**: Tab navigation component
- **PRGDisclaimerBlock**: Legal disclaimer display

---

## Layout Patterns

### Screen Structure

#### Authentication Screens
- Centered content with max-width: 400px
- Title: 36px, bold, centered
- Subtitle: 16px, gray.600, centered
- Form inputs with consistent spacing
- Primary action button
- Divider with "OR" text for alternative actions
- Secondary/ghost buttons for navigation

#### Content Screens
- Full-width layout
- Header section with title and actions
- Scrollable content area
- Card-based content grouping
- Consistent padding: 16px-24px

### Spacing Guidelines

- **Between form fields**: 16px (md)
- **Between sections**: 24px (lg)
- **Screen padding**: 16px-24px (md-lg)
- **Card margins**: 16px bottom (md)
- **Button spacing**: 16px top (md)

### Border Radius

- **Buttons**: 8px
- **Inputs**: 8px
- **Cards**: 12px
- **Badges**: 12px
- **Modals/Overlays**: 12px

### Shadows

- **Cards**: 
  - shadowOpacity: 0.1
  - shadowRadius: 4
  - shadowOffset: { width: 0, height: 2 }
  - elevation: 3 (Android)

---

## Usage Guidelines

### Color Usage

1. **Primary Color** (`#6F00FF`):
   - Primary buttons
   - Active states
   - Links and interactive elements
   - Brand accents

2. **Gray Scale**:
   - `gray.50-100`: Backgrounds
   - `gray.200-300`: Borders, dividers
   - `gray.400-500`: Placeholders, secondary text
   - `gray.600-900`: Body text, headings

3. **Semantic Colors**:
   - Use sparingly for status indicators
   - Error: Only for actual errors
   - Success: Confirmation messages
   - Warning: Important notices

### Typography Hierarchy

1. **Hero/Page Title**: `4xl` (36px), bold
2. **Section Title**: `2xl` (24px), semibold
3. **Card Title**: `lg` (18px), semibold
4. **Body Text**: `base` (16px), regular
5. **Labels**: `sm` (14px), medium
6. **Captions**: `xs` (12px), regular

### Button Usage

- **Primary**: Main action on screen (one per screen)
- **Secondary**: Alternative actions, less important
- **Ghost**: Navigation, cancel actions, tertiary options

### Form Design

- Always include labels for inputs
- Show error messages below inputs
- Use consistent spacing between fields
- Group related fields visually
- Provide clear validation feedback

### Empty States

- Always include a title
- Provide helpful message explaining why it's empty
- Include action button to resolve empty state
- Use appropriate icon if available

### Loading States

- Show loading overlay for full-screen operations
- Use button loading state for inline actions
- Provide progress indicator for long operations
- Never block user without feedback

---

## Accessibility

### Minimum Touch Targets
- Buttons: 48px minimum height
- Inputs: 48px minimum height
- Interactive elements: 44px minimum

### Color Contrast
- Text on primary: White on purple (WCAG AAA)
- Body text: Dark on light (WCAG AA)
- Error text: Red on white (WCAG AA)

### Typography
- Minimum font size: 12px
- Body text: 16px (recommended for readability)
- Line height: 1.5 for body text

---

## Responsive Considerations

### Web
- Max content width: 400px for forms
- Full width for content screens
- Responsive padding based on screen size

### Mobile
- Full-width layouts
- Touch-optimized spacing
- Platform-specific styling where needed

---

## Component Naming Convention

All components use the `PRG` prefix (Project Renter Guardian):
- `PRGButton`
- `PRGInput`
- `PRGCard`
- etc.

This ensures:
- Easy identification of design system components
- Namespace protection
- Consistent naming pattern

---

## Best Practices

1. **Consistency**: Always use design tokens (colors, spacing, typography)
2. **Reusability**: Use components from the design system
3. **Accessibility**: Follow minimum touch targets and contrast ratios
4. **Performance**: Use appropriate loading states
5. **Feedback**: Provide clear error and success states
6. **Simplicity**: Keep designs clean and focused

---

## Future Enhancements

- Dark mode support
- Additional component variants
- Animation guidelines
- Icon system
- Illustration guidelines

