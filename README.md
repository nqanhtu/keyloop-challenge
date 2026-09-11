# Intelligent Inventory Dashboard

Frontend implementation for **Scenario B — The Intelligent Inventory Dashboard** in the Keyloop technical challenge.

The application provides a responsive inventory dashboard for dealership managers, including inventory discovery, aging visibility, vehicle details, manager actions, action history, loading/error/freshness states, and accessibility-focused responsive behavior.

## Quick Start

### Prerequisites

- Node.js **24.18.1** (see `.nvmrc`)
- npm **11.16.0+**

If you use `nvm`:

```bash
nvm use
```

### Install

```bash
npm ci
```

### Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

No external backend, database, or application environment variables are required for the local challenge demo.

In development, the frontend still talks through its HTTP/API layer. **MSW** intercepts those HTTP requests in the browser and provides the challenge's mock backend behavior.

## Available Commands

```bash
npm run dev        # Start Vite development server on port 3000
npm run build      # Create a production build
npm run typecheck  # TypeScript validation
npm run lint       # ESLint
npm run test       # Vitest unit/integration/architecture tests
npm run test:watch # Vitest watch mode
npm run test:e2e   # Playwright browser tests
```

## End-to-End Tests

Install the Chromium browser once:

```bash
npx playwright install chromium
```

Then run:

```bash
npm run test:e2e
```

Playwright starts/reuses the Vite server automatically and runs the browser suite across:

- Desktop
- Tablet
- Mobile

## Architecture

The implementation deliberately preserves an HTTP boundary between the React application and the mocked backend:

```text
React / TanStack UI
        |
        v
Typed API client
        |
        v
HTTP requests
        |
        v
MSW mock backend
        |
        +--> Inventory read model
        +--> Aging policy
        +--> Manager action service
        +--> Browser-persistent mock action storage
```

Important implementation boundaries:

- React feature code does not access mock repositories or browser persistence directly.
- TanStack Query owns server state.
- Filters, sorting, pagination, and selected vehicle state are URL-driven where designed.
- Inventory aging is derived behind the HTTP boundary.
- Manager actions are append-only and persist across browser reloads in the mock environment.
- Backend errors expose stable error codes used by frontend behavior.

## Scope

This repository implements the challenge frontend and an HTTP-faithful mock backend suitable for local demonstration and automated testing.

The production backend architecture described in the System Design — including Fastify, Prisma, PostgreSQL, synchronization workers, production identity integration, and infrastructure — is **design-only** and intentionally not implemented in this repository.

## Technology

- React
- TypeScript
- Vite
- TanStack Router
- TanStack Query
- TanStack Table
- MSW
- Vitest
- React Testing Library
- Playwright

## Verification

The release candidate was verified with:

- TypeScript: PASS
- ESLint: PASS
- Build: PASS
- Vitest: **239 tests PASS**
- Playwright: **18 tests PASS** across desktop, tablet, and mobile
- Architecture suites: **85 tests PASS**

The completed release compliance record is available at:

- [Release compliance](docs/agents/evidence/release-compliance.md)

## Documentation

- [System Design](docs/system-design/system-design-v1.md)
- [Completed implementation plan](docs/plans/completed/implementation-intelligent-inventory-dashboard.md)
- [Agent/workflow documentation](docs/agents/README.md)

## Project Structure

```text
src/
  api/          Typed HTTP client and frontend-facing API contracts
  app/          Application/router composition
  features/     Inventory, actions, errors, and observability UI logic
  mocks/        MSW mock backend and persistence
  test/         Shared test support and architecture checks

e2e/            Playwright browser tests
docs/           System design, decisions, plans, and evidence
public/         Static assets including the MSW worker
```
