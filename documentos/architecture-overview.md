# Architecture Overview

## Product Context

Kaique Transport Operations Platform is an internal operations system for a transport business. It connects workflows that are commonly split across spreadsheets, messaging apps, paper forms, and manual follow-up.

The main design constraint is practical: operators need to move quickly, but the system still has to protect data quality, permissions, attachments, and audit history.

## Main Domains

- Freight operations: launch records, load lists, spot entries, canceled loads, reports, and timelines.
- Payroll: payroll cycles, adjustments, collaborator reports, and unit reports.
- Vacation planning: calendars, timelines, reports, and collaborator history.
- Recruitment: resume intake, interview scheduling, interview records, final review, and status tracking.
- Onboarding: onboarding assignments, item completion, attachments, and event history.
- Registry: collaborators, units, functions, payment types, fleet plates, aviaries, users, roles, and permissions.
- Operations support: activity logs, telemetry, queue monitoring, observability, and async exports.

## Stack

- Laravel 12 handles routing, controllers, validation, policies, queues, middleware, and persistence.
- React 19 and TypeScript handle the module pages and interactive workflows.
- Inertia.js connects Laravel routes to React pages without a separate SPA router.
- Vite builds the frontend assets.
- Fortify and Sanctum provide authentication/session and API access.
- DomPDF and PhpSpreadsheet generate business documents and spreadsheets.
- Spatie Activitylog records important operational activity.

## Runtime Flow

1. A user accesses a protected route in the transport workspace.
2. Laravel resolves the Inertia page and shares authenticated user/permission context.
3. The React page loads module data through authenticated API calls.
4. Controllers validate the request and check visibility or role permissions.
5. Domain changes are persisted through Eloquent models and transactions where needed.
6. Attachments are stored through Laravel storage and served through controlled routes.
7. Long-running work, such as exports or delivery attempts, can run through the queue.
8. Operators can inspect telemetry, activity logs, and failed jobs from support screens.

## Frontend Organization

Most user-facing code lives under `resources/js`.

- `pages/transport`: transport workspace modules.
- `components`: shared UI building blocks.
- `components/transport`: layout and transport-specific shell components.
- `lib`: API client, formatting helpers, permissions, and shared utilities.
- `types`: TypeScript types used across module pages.

The UI is intentionally dense. It is meant for repeated operational work, so tables, filters, status controls, and compact dashboards are preferred over large presentation sections.

## Backend Organization

Most application logic lives under `app`.

- `Http/Controllers/Api`: authenticated API endpoints for module workflows.
- `Http/Requests`: validation rules for write operations.
- `Models`: Eloquent models for business entities.
- `Policies` and permission checks: access control and visibility rules.
- `Services`: reusable business or infrastructure logic where a controller would become too large.
- `Jobs`: queued or background work.

Routes are split between:

- `routes/web.php` for Inertia pages and browser routes.
- `routes/api.php` for JSON endpoints used by the React UI and integrations.

## Reliability Patterns

Several patterns are used to reduce operational mistakes:

- Request validation objects for forms and API writes.
- Transactions around multi-step writes.
- Duplicate protection for critical submissions.
- Idempotency for selected operations that should not create repeated side effects.
- Route-aware throttling for sensitive or heavy endpoints.
- Permission-aware filtering so users do not see records outside their scope.
- Queue monitor endpoints for failed-job inspection and recovery.
- Dashboard calculations prefer domain-specific grouped fields over broad spreadsheet totals when both exist, for example using `Kaique Geral` freight values instead of combined Kaique plus third-party totals.

## Data and Attachments

The database stores the workflow state and relationships. Uploaded documents, resume attachments, onboarding files, and exported business files are handled through Laravel storage paths and controlled download routes.

Files are treated as part of the business workflow, not just static uploads. That matters for recruitment, onboarding, payroll documents, and operational exports.

## Deployment Model

The production setup is documented around a VPS-style deployment:

- Nginx serves the Laravel public directory.
- PHP-FPM runs the application.
- Supervisor manages queue workers.
- The Laravel scheduler is configured through cron.
- Vite assets are built into `public/build`.
- Environment values stay in server-side `.env` files.

See [deploy-vps.md](deploy-vps.md) for the runbook.

## Trade-Offs

- Inertia keeps the stack simpler than a separate API-only backend plus standalone SPA, which fits the size of this project.
- Some controllers are intentionally close to the module workflow so business rules are easy to trace.
- The UI favors operational density over visual minimalism.
- The app is built for one business domain first, so some names and flows are still domain-specific.

## Review Notes

For reviewers, the most interesting parts are not only the number of pages. The stronger signal is how the project handles real operational concerns: permissions, duplicate prevention, document handling, queues, deployment, auditability, and maintainable workflows.
