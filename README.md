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

The latest verified application state passed:

- TypeScript: PASS
- ESLint: PASS
- Build: PASS
- Vitest: **283 tests PASS across 29 test files**
- Playwright: **48 E2E tests PASS** across desktop, tablet, and mobile
- Architecture suites: **85 architecture checks PASS**

Verification evidence is recorded under `docs/agents/evidence/`, including the completed UI compliance, pagination/page-size verification, and root-routing verification.

## AI Collaboration Narrative

I used GenAI as an engineering collaborator rather than as the final authority for the solution.

The workflow separated responsibilities across independent agent roles:

1. A Lead agent analyzed requirements, architecture, assumptions, and task boundaries.
2. Builder agents implemented bounded tasks from explicit task contracts.
3. Fresh Reviewer and Tester sessions independently checked the resulting code and behavior.
4. Findings were routed back through bounded repair tasks instead of allowing the implementation agent to approve its own work.
5. Final compliance passes compared the integrated solution against the System Design, UI System Design, and executable evidence.

The repository acted as the durable source of truth. Important architecture decisions, assumptions, task contracts, verification evidence, and accepted design changes were persisted in Markdown rather than relying on agent conversation history.

I also used GenAI for adversarial verification, not only implementation. Independent browser and accessibility review found issues that normal implementation checks did not initially reveal, including modal focus escaping into the background page, insufficient touch-target sizing, contrast problems, and background scrolling while a modal was open. Those findings were repaired and independently re-verified.

A later independent verification pass also found malformed URL states that could produce invalid pagination output such as `NaN` or `Infinity`. That led to defensive normalization at the router and query boundary, followed by another clean verification pass.

AI-generated code and recommendations were treated as proposals. Workflow state advanced only when repository state plus executable or observable evidence supported the result. Final responsibility for architecture, product behavior, trade-offs, and acceptance criteria remained with me.

## Documentation

- [System Design](docs/system-design/system-design-v1.md)
- [UI System Design](docs/ui-system-design/ui-system-design-v1.md)
- [Completed UI redesign plan](docs/plans/completed/ui-redesign.md)
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
