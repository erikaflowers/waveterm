# Services

External integrations and side effects live here.

## api.js

A fetch wrapper for making API calls. Use it like this:

```jsx
import { get, post } from '../services/api';

// Fetch data
const users = await get('/users');

// Create data
const newUser = await post('/users', { name: 'Alice' });
```

## Adding more services

Create new files for each integration:

- `auth.js` — Authentication (Supabase, Firebase, Auth0)
- `storage.js` — File uploads (S3, Cloudinary)
- `analytics.js` — Event tracking

## The rule

If it talks to the outside world, it's a service.
