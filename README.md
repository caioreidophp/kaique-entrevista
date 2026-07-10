# Kaique Transport Operations Platform

This is a Laravel + React system I built for Kaique Transportes to organize daily transport work that was getting spread across spreadsheets, messages, files, and repeated manual checks.

The app currently runs for the company through a local environment exposed with a Cloudflare Tunnel at:

<https://app.kaiquetransportes.com.br>

The next infrastructure step is a separate staging server on Forge/VPS with MySQL or MariaDB. That work is being prepared carefully because the current data is real, the local database is SQLite, and some fields are encrypted.

Demo access is meant for public walkthroughs only. It uses synthetic data and has isolation rules so demo records do not appear for real accounts, and real company records do not appear in the demo account.

## Why I Built It

I started this project because the operation needed a more reliable way to manage information that changes every day: freight records, payroll routines, vacations, recruitment, documents, and internal approvals.

The important part for me was not just making forms. I worked on the parts that make a system usable in real life:

- permissions by module and user profile;
- searchable tables and dashboards for repeated daily work;
- file uploads, PDFs, and spreadsheet exports;
- duplicate checks and validation for important records;
- activity logs and support screens;
- a demo environment that can be shown without exposing private data;
- documentation for deployment, regression checks, and future staging.

## Main Modules

- Freight: launch freight records, review lists, track canceled loads, compare units, and export operational information.
- Payroll: manage payment cycles, adjustments, collaborators, units, and reports.
- Vacations: plan and review employee vacations with dashboard and timeline views.
- Recruitment: manage resumes, driver interviews, statuses, attachments, and printed/PDF interview records.
- Onboarding: follow next steps after interviews and keep related documents organized.
- Registry: manage collaborators, users, roles, units, functions, payment types, fleet plates, and aviaries.
- Operations support: inspect logs, telemetry, queues, failed jobs, and system activity.

## Technical Stack

- Backend: Laravel 12, PHP 8.2+, Fortify, Sanctum
- Frontend: React 19, TypeScript, Inertia.js, Vite
- Current local database: SQLite
- Staging target: MySQL/MariaDB on Forge/VPS
- Files: Laravel storage for public and private attachments
- Documents: DomPDF and PhpSpreadsheet
- Operations: queues, scheduler, deployment scripts, Nginx/Supervisor documentation
- Quality: PHPUnit, TypeScript checks, ESLint, Prettier, Pint, GitHub Actions

## Architecture

Laravel handles authentication, routing, validation, policies, API controllers, queues, database access, file storage, and exports. React/Inertia provides the authenticated screens used by the transport, HR, payroll, and admin workflows.

Typical request flow:

1. A user opens a module inside the transport shell.
2. The React page calls an authenticated `/api/*` endpoint.
3. Laravel validates the payload and checks permissions.
4. The controller applies the business rule and reads or writes data.
5. Activity is logged where it matters.
6. Heavier work, such as exports, can be handled through queues.

For more detail, see [documentos/architecture-overview.md](documentos/architecture-overview.md).

## Decisions I Care About

- Real and demo data are treated as separate worlds. If that boundary breaks, it is a serious bug.
- Sensitive identity fields such as CPF/RG/CNH require care because some are encrypted.
- SQLite is still the current local database, so the MySQL move is being rehearsed before any staging or production switch.
- The UI is dense on purpose. This is an internal operations tool, so scanning and repeated use matter more than a landing-page style interface.
- Permissions are checked in the backend, not only hidden in the sidebar.
- PDFs, imports, exports, and attachments are part of the workflow, not extra decoration.
- Rollback and manual regression checks are documented before risky infrastructure changes.

## Local Setup

Requirements:

- PHP 8.2 or newer
- Composer
- Node.js 20 or newer
- npm
- SQLite for local development, or another Laravel-supported database if configured

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

## Quality Checks

Useful checks before opening a pull request or deploying:

```bash
npm run types
npm run lint:check
npm run format:check
composer test
npm run build
```

The project also has GitHub Actions for build, type checking, formatting, linting, audits, contract tests, E2E-tagged tests, and PHPUnit.

For manual smoke testing, use the [manual regression checklist](documentos/regression-checklist.md). It covers login, demo isolation, permissions, dashboards, PDFs, imports, exports, storage, and the main module workflows.

## MySQL/Staging Status

The current company environment is still SQLite through the local/Cloudflare Tunnel setup.

I have been preparing the project for a safer MySQL/MariaDB staging move. The migration rehearsal already covered the important risk areas: encrypted fields, unique collisions, table counts, and SQLite-to-MySQL comparison. The intended staging target is Forge/VPS with a separate database, separate domain, copied storage, and no change to the current local system until staging is approved.

Related documents:

- [Deploy em VPS](documentos/deploy-vps.md)
- [Deploy Forge/produção](DEPLOY_FORGE_PRODUCAO.md)
- [Manual regression checklist](documentos/regression-checklist.md)
- [Demo validation command plan](documentos/validate-demo-command-plan.md)

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
- [Admissions project summary](documentos/admissions-project-summary-en.md)
- [Demo script](documentos/admissions-demo-script-en.md)
- [Screenshot checklist](documentos/admissions-screenshot-checklist-en.md)
- [Publication checklist](documentos/admissions-publish-checklist-en.md)
- [Admissions polish roadmap](documentos/admissions-polish-roadmap-en.md)
- [Manual regression checklist](documentos/regression-checklist.md)
- [Demo validation command plan](documentos/validate-demo-command-plan.md)

Portuguese:

- [Resumo do projeto](documentos/resumo-do-projeto-pt.md)
- [Deploy em VPS](documentos/deploy-vps.md)
- [Deploy Forge/produção](DEPLOY_FORGE_PRODUCAO.md)
- [Matriz de permissões](documentos/transport-permissions-matrix.md)

## Current Limitations

- The active environment still depends on the local machine and Cloudflare Tunnel.
- A separate 24/7 staging environment is not live yet.
- The current operational database is SQLite; MySQL/MariaDB is the staging target, not the current live database.
- Some workflows still reflect Kaique Transportes' internal data conventions.
- Demo data must be checked before public walkthroughs so no private information is shown.
- The mobile driver app is documented separately and is not yet the main production surface.

## Suggested Review Path

If you are reviewing the project quickly:

1. Read this README and the [project case study](documentos/project-case-study-en.md).
2. Read the [one-page admissions summary](documentos/admissions-project-summary-en.md).
3. Watch a short synthetic-data demo recording or use the demo account if available.
4. Review the architecture and security notes.
5. Check the regression checklist to see what can break in real use.
6. Inspect one complete feature area, such as recruitment, freight, or payroll.

## License

This project is distributed under the MIT license.
