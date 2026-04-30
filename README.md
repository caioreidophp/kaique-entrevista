# Kaique Transport Operations Platform

A full-stack operations platform built to manage real transport workflows end-to-end: freight launches, payroll cycles, vacations planning, recruitment funnel, onboarding, and auditability.

This repository represents practical software engineering in a production-like environment, with a focus on reliability, performance, and operational UX.

## Live Demo

- App URL: https://app.kaiquetransportes.com.br
- Deployment runbook: [documentos/deploy-vps.md](documentos/deploy-vps.md)

## Why This Project Matters

Most portfolio projects stop at CRUD. This system goes further:

- Multi-module domain platform with operational dashboards
- Reliability hardening for critical writes with idempotency
- Adaptive API rate limiting by route sensitivity/profile
- Observability APIs for latency and runtime diagnostics
- Queue operations endpoints for failed-job recovery
- Role-permission management with granular visibility controls
- Contract/E2E test gates in CI

## Core Modules

- Freight management: launch, list, timeline, spot entries, canceled loads, operational reports
- Payroll management: launch batch, adjustments, reports by unit/collaborator
- Vacation management: dashboard, timeline, reports, launch/list, collaborator history
- Recruitment: driver interviews, next-step documents, hiring status workflow
- Onboarding: assignment, completion, item tracking, attachments
- Registry: collaborators, roles/permissions, payment types, fleet plates, aviaries
- Operations and governance: activity log, telemetry, observability, queue monitor

## Architecture Overview

- Backend: Laravel 12, PHP 8.2+, Sanctum auth, Fortify
- Frontend: React 19 + TypeScript + Inertia + Vite
- Data and exports: MySQL + PhpSpreadsheet + DomPDF
- Security and audit: throttling, idempotency middleware, activity logging
- Runtime operations: queue workers, scheduler, deploy scripts for VPS + Nginx + Supervisor

High-level flow:

1. React/Inertia pages call authenticated API endpoints.
2. Laravel controllers enforce policy/permission and validation.
3. Critical writes use idempotency and adaptive throttling.
4. Long-running exports/jobs are processed asynchronously via queue.
5. Activity and telemetry endpoints expose operational visibility.

## Engineering Highlights

- Idempotency for critical POST operations to prevent duplicate side effects.
- Adaptive route throttling for sensitive/heavy endpoints.
- API telemetry and system observability endpoints.
- Queue monitor endpoints to inspect, retry, forget, and flush failed jobs.
- Async exports with status and download endpoints.
- Permission-aware navigation and API access controls.
- Admin shell language switch (Portuguese/English) with persistent preference.
- First-visit Demo shortcut on transport login for faster product walkthroughs.
- Phase 6 UX layer: global search (`Ctrl+K`), pinned quick-access shortcuts, and record comments with mentions.
- Regression, contract, and E2E test coverage integrated in CI.

## Phase 6 Completion (Search, Collaboration, Navigation)

Implemented and production-ready:

- Global search API and UI command palette (`Ctrl+K`) with permission-aware results.
- User quick-access persistence (pin/unpin shortcuts) stored in database.
- Record comments with mentions (`@name` / `@email`) and delete controls.
- Onboarding guided wizard mode with step-by-step flow and review stage.
- Comments panel already integrated in interviews, onboarding, and operations hub.

New API routes:

- `GET /api/search/global`
- `GET|POST|PUT|DELETE /api/quick-accesses`
- `GET|POST|DELETE /api/record-comments`

New migrations:

- `create_user_quick_accesses_table`
- `create_record_comments_table`

## Local Setup

### Prerequisites

- PHP 8.2+
- Composer
- Node.js 20+
- npm
- MySQL (or compatible database configured in `.env`)

### Install

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
```

### Run in development

```bash
composer dev
```

This starts app server, queue listener, logs, and Vite together.

### Build and quality checks

```bash
npm run build
php artisan test
php artisan migrate
php artisan optimize:clear
php artisan optimize
```

## API Surface (selected)

- Authentication and profile: `/api/login`, `/api/logout`, `/api/me`
- Freight: `/api/freight/*`
- Payroll: `/api/payroll/*`
- Vacations: `/api/payroll/vacations/*`
- Interviews / next steps / onboarding: `/api/driver-interviews/*`, `/api/next-steps/*`, `/api/onboardings/*`
- System ops: `/api/system/telemetry/latency`, `/api/system/observability`, `/api/system/queue/*`
- Async exports: `/api/exports/async/*`

For full route details, check [routes/api.php](routes/api.php) and [routes/web.php](routes/web.php).

## Testing and CI

- Backend tests: PHPUnit feature tests under `tests/Feature`
- Contract tests: API payload stability checks
- E2E critical flow tests
- CI pipeline: staged gates before full suite execution

Run locally:

```bash
php artisan test
```

## Documentation for Presentation

- 2-minute demo script: [documentos/admissions-demo-script-en.md](documentos/admissions-demo-script-en.md)
- GitHub/deploy publication checklist: [documentos/admissions-publish-checklist-en.md](documentos/admissions-publish-checklist-en.md)
- Architecture overview: [documentos/architecture-overview.md](documentos/architecture-overview.md)
- Security and performance notes: [documentos/security-performance-notes.md](documentos/security-performance-notes.md)
- VPS deployment guide: [documentos/deploy-vps.md](documentos/deploy-vps.md)
- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)

## UX / UI Direction

- Operational workspace focused on scanning, urgency detection, and low-friction navigation
- Shared transport shell with permission-aware menus, keyboard shortcuts, and compact dashboards
- Enterprise visual treatment with consistent card hierarchy, executive summaries, and alert framing

## Security and Performance Posture

- Environment-aware Content Security Policy with stronger production defaults
- Hardened browser headers and attachment delivery protections
- API retries, timeout handling, and lightweight GET caching on stable reference endpoints
- Queue-backed exports and bulk operations for heavy workflows
- Route-sensitive throttling and idempotency for critical write paths

## Review and Revert Flow

The current upgrade pass is designed to be easy to evaluate and undo:

```bash
git checkout codex-professional-upgrade
git diff main...codex-professional-upgrade
git checkout main
```

If you do not want to keep the changes later, you can stay on `main` or simply delete the branch.

## Suggested Demo Narrative

1. Show a real business problem and explain why this platform exists.
2. Walk through one end-to-end flow (freight launch to dashboard impact).
3. Show reliability/observability features that prove engineering maturity.
4. Close with measurable impact and clear roadmap.

## License

This project is distributed under the MIT license.
