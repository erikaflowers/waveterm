# Core

Pure business logic. No React, no API calls, no side effects.

## What goes here

- Data transformations (formatDate, slugify)
- Validation functions
- Business rules
- State calculations

## What does NOT go here

- API calls → use `services/`
- React hooks → keep in components
- DOM manipulation → use React

## The test

If you can test it without mocking anything, it belongs in core.
If it needs network, browser, or React — it goes elsewhere.
