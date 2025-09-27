# CrewAI Command Center Frontend

## Overview
This package hosts the React single-page application for the CrewAI Command Center. It renders the dashboard, drives crew management workflows, streams logs and telemetry from the FastAPI backend, and provides rich editors for crew configuration and environment files. The UI is built with React 18.3, React Router, Tailwind CSS, Recharts, and Socket.IO for real-time updates.

## Stack highlights
- **React + React Router** for routing between the system dashboard, crew workspace, activity feed, and settings views.
- **axios** for REST calls to the backend `/api` namespace.
- **socket.io-client** for live system statistics, activity events, and log streaming.
- **Monaco editor** integration for YAML/JSON crew definitions and `.env` editing.
- **Recharts** and custom components for visualising latency, error rate, and resource metrics.

## Getting started
```bash
cd frontend

# 1. Copy environment defaults
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start the development server
npm start
```

The dev server runs on [http://localhost:3000](http://localhost:3000) and proxies API calls to the URL defined in `.env` (defaults to `/api`). Socket.IO falls back to the same origin when `REACT_APP_WS_URL` is not set.

## Available scripts
- `npm start` – launch the development server with hot reloading.
- `npm run dev` – alias for `npm start`.
- `npm run build` – produce an optimized production bundle in `build/`.
- `npm test` – execute the Jest test runner (watch mode by default).
- `npm run test -- --watchAll=false` – run the tests once (useful for CI).

## Directory guide
- `src/App.js` – top-level layout, routing, and application state management.
- `src/features/crews/` – crew workspace, template gallery, configuration editor, and run controls.
- `src/features/activity/` – activity feed, filters, and live event stream.
- `src/components/` – shared UI primitives (dialogs, toasts, editors).
- `src/hooks/` – reusable hooks such as `useCrewManager` and `useUserPreferences`.
- `src/utils/` – helpers for formatting payloads and API responses.
- `public/` – static assets served as-is by Create React App.

## Environment variables
The app reads the following keys (see `.env.example` for defaults):

| Variable | Purpose |
|----------|---------|
| `REACT_APP_API_BASE_URL` | REST base URL for backend requests (defaults to `/api`). |
| `REACT_APP_WS_URL` | Socket.IO endpoint. Falls back to the browser origin when unset. |
| `NODE_ENV` | Standard React build flag (`development`, `production`). |
| `PORT` | Port used by `npm start`. |

Ensure these values match the backend host/port, especially when running the frontend separately or deploying behind a proxy.

## Testing & quality checks
Run `npm test` to execute the Jest suite. Accessibility assertions use `@testing-library/react` and `jest-axe` mocks located under `src/__mocks__`. Update or add tests alongside UI changes to keep coverage meaningful.

## Production builds
Generate a production bundle with `npm run build`. The backend can serve the compiled assets by pointing `FRONTEND_BUILD_DIR` to the generated `build/` directory or by using the provided Docker images in the repository root compose files.

Refer to the root [README](../README.md) for full-stack orchestration tips, Docker workflows, and crew dependency setup.
