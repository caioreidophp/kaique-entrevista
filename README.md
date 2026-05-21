# Kaique Transport Operations Platform

Kaique Transport Operations Platform is a full-stack system for managing daily transport operations: freight records, payroll routines, vacation planning, driver recruitment, onboarding, permissions, and operational monitoring.

The project started from a practical problem: transport teams often depend on spreadsheets, messages, printed documents, and repeated manual checks. This repository turns those workflows into one authenticated web platform with audit trails, permission rules, document handling, and deployment notes.

Live application: <https://app.kaiquetransportes.com.br>

## What This Project Shows

- End-to-end product ownership across backend, frontend, database, deployment, and support workflows.
- A real business domain with many connected modules rather than isolated demo screens.
- Reliability work around duplicate submissions, permissions, rate limits, queues, and exports.
- Documentation written for reviewers who want to understand both the product and the engineering choices.

## Product Scope

The platform is organized around the workflows a transport operation needs during the week:

- Freight management: launch records, list loads, track canceled loads, review timelines, and generate operational reports.
- Payroll: launch payroll cycles, manage adjustments, and report by unit or collaborator.
- Vacations: plan absences, inspect timelines, and review unit-level vacation reports.
- Recruitment: register resumes, schedule driver interviews, track statuses, and prepare next-step documents.
- Onboarding: assign onboarding tasks, upload attachments, and track completion.
- Registry: manage collaborators, roles, permissions, payment types, units, functions, fleet plates, and aviaries.
- Operations support: audit activity, inspect telemetry, monitor queues, and recover failed jobs.

## Technical Stack

- Backend: Laravel 12, PHP 8.2+, Fortify, Sanctum
- Frontend: React 19, TypeScript, Inertia.js, Vite
- Database and files: MySQL-compatible database, Laravel storage, PDF and spreadsheet exports
- Exports: DomPDF and PhpSpreadsheet
- Operations: queue workers, scheduler, deployment scripts, Nginx/Supervisor runbooks
- Quality: PHPUnit feature tests, TypeScript checks, ESLint, Prettier, Pint, GitHub Actions

## Architecture

At a high level, the application uses Laravel for routing, authentication, validation, policies, API controllers, queues, and persistence. React/Inertia pages provide the authenticated transport workspace.

Typical request flow:

1. A user opens a module inside the transport shell.
2. The React page calls an authenticated `/api/*` endpoint.
3. Laravel validates the payload and checks the user's permissions.
4. The controller applies the domain rule, writes to the database, and records relevant activity.
5. Heavy work, such as exports or background delivery, is handled by queues when appropriate.

For more detail, see [documentos/architecture-overview.md](documentos/architecture-overview.md).

## Engineering Decisions Worth Reviewing

- Permission-aware navigation and API access keep users focused on the modules they can use.
- Idempotency and duplicate checks protect critical write flows from accidental repeated submissions.
- Route-sensitive throttling gives heavier or more sensitive endpoints stricter limits.
- Queue monitoring and failed-job recovery make production support part of the app, not an afterthought.
- Dense operational UI prioritizes scanning, comparison, and repeated use over marketing-style layouts.
- Deployment documentation reflects a VPS/Nginx/Supervisor setup instead of assuming a managed platform.

## Local Setup

Requirements:

- PHP 8.2 or newer
- Composer
- Node.js 20 or newer
- npm
- MySQL or another configured database supported by Laravel

Install dependencies and prepare the app:

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
```

Run the local development stack:

```bash
composer dev
```

Build production assets:

```bash
npm run build
```

## Safe Demo Dataset

For portfolio videos or university reviewers, create an isolated demo account with synthetic records:

```bash
php artisan transport:seed-demo --reset
```

Set `TRANSPORT_DEMO_EMAIL`, `TRANSPORT_DEMO_PASSWORD`, and matching `VITE_TRANSPORT_DEMO_*` values in the environment. Keep `TRANSPORT_DEMO_READONLY=true` when the demo account is public so reviewers can explore without changing data.

## Quality Checks

Useful checks before opening a pull request:

```bash
npm run types
npm run lint:check
npm run format:check
composer test
npm run build
```

The GitHub Actions workflows also run build, type checking, formatting, linting, audits, contract tests, E2E-tagged tests, and the full PHPUnit suite.

## API Surface

Selected route groups:

- Auth/profile: `/api/login`, `/api/logout`, `/api/me`
- Freight: `/api/freight/*`
- Payroll: `/api/payroll/*`
- Vacations: `/api/payroll/vacations/*`
- Interviews and resumes: `/api/driver-interviews/*`, `/api/interview-curriculums/*`
- Next steps and onboarding: `/api/next-steps/*`, `/api/onboardings/*`
- Operations: `/api/system/telemetry/*`, `/api/system/observability`, `/api/system/queue/*`
- Async exports: `/api/exports/async/*`

For the full route map, review [routes/api.php](routes/api.php) and [routes/web.php](routes/web.php).

## Documentation

English:

- [Architecture overview](documentos/architecture-overview.md)
- [Security and performance notes](documentos/security-performance-notes.md)
- [Project case study](documentos/project-case-study-en.md)
- [Demo script](documentos/admissions-demo-script-en.md)
- [Publication checklist](documentos/admissions-publish-checklist-en.md)

Portuguese:

- [Resumo do projeto](documentos/resumo-do-projeto-pt.md)
- [Deploy em VPS](documentos/deploy-vps.md)
- [Deploy Forge/produção](DEPLOY_FORGE_PRODUCAO.md)
- [Matriz de permissões](documentos/transport-permissions-matrix.md)

## Current Limitations

- Some workflows still depend on operational data conventions from the current business environment.
- Demo data must be prepared carefully before public walkthroughs so no sensitive information is exposed.
- The mobile driver app is documented separately and is not yet the main production surface.

## Suggested Review Path

If you are reviewing the project quickly:

1. Read this README and the [project case study](documentos/project-case-study-en.md).
2. Open the live app or a short demo recording.
3. Inspect the architecture and security notes.
4. Check the tests and GitHub Actions configuration.
5. Review one complete feature area, such as recruitment or freight.

## License

This project is distributed under the MIT license.
