# FitTrack Test Suite

## How to Run
1. Install dependencies:
```bash
npm install vitest jsdom @testing-library/dom
```

2. Run tests:
```bash
npx vitest
```

## Test Coverage
- **`app.test.js`**: Unit and integration tests for frontend functionality:
  - Authentication flow (sign in, sign up, sign out)
  - Workout form submission and validation
  - Dashboard stat rendering (workout count, duration, streak)
  - Realtime update handling
  - Error state display
  - DOM interactions and accessibility

- **`api.test.js`**: Backend API and security tests:
  - JWT authentication middleware
  - RLS enforcement via parameterized queries
  - Workout CRUD operations
  - Input validation
  - Error handling for 400/401/403/500 cases
  - Database query correctness

All tests mock external dependencies (Supabase, PostgreSQL) to ensure isolation and speed.