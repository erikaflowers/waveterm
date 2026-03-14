# Design System

This folder contains your app's visual foundation.

## tokens.css

CSS variables that define colors, spacing, typography, and more.
Import this in your main styles to use them everywhere.

```css
@import '../design-system/tokens.css';

.my-button {
  background: var(--color-accent);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
}
```

## Why tokens?

- Change your entire color scheme in one place
- Consistent spacing throughout your app
- Easy dark mode support with CSS variables
- Claude knows to use these instead of hardcoded values
