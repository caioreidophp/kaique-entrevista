# Project Case Study

## Summary

Kaique Transport Operations Platform is a web application built for the daily work of a transport operation. It brings together freight records, payroll, vacation planning, recruitment, onboarding, permissions, and support tooling in one authenticated system.

The goal was not only to build screens, but to reduce operational friction: fewer spreadsheet handoffs, fewer duplicate records, clearer status tracking, and a better audit trail for decisions.

## Problem

Before a system like this, transport workflows are easy to scatter across many places:

- load and payroll information in spreadsheets;
- interview and onboarding information in messages or paper notes;
- documents saved without a consistent workflow;
- status updates depending on individual memory;
- limited visibility into who changed what.

That kind of setup can work for a small volume, but it becomes hard to audit and hard to scale.

## Solution

The platform provides a shared workspace for transport operations. Each module focuses on a specific workflow, while shared infrastructure handles authentication, permissions, attachments, activity logging, exports, and operational monitoring.

Examples:

- Freight teams can launch and review operational records.
- Payroll users can manage cycles and adjustments.
- HR users can track resumes, interviews, and onboarding.
- Administrators can manage users, permissions, registries, and support tools.

## My Role

This project represents end-to-end engineering work:

- designing the data model and migrations;
- building Laravel API controllers, validation, and business rules;
- creating React/TypeScript module screens;
- wiring authentication and permissions;
- documenting deployment and support workflows;
- adding tests and CI checks;
- maintaining the project through real feature requests and bug fixes.

## Technical Highlights

- Laravel 12 backend with Fortify/Sanctum authentication.
- React 19 + TypeScript frontend through Inertia.js.
- Permission-aware navigation and backend access checks.
- Demo/real data isolation so public walkthrough data does not leak into real operational accounts.
- Duplicate prevention and idempotency on critical write flows.
- Queue-backed exports and failed-job recovery surfaces.
- PDF and spreadsheet generation for business documents.
- SQLite-to-MySQL rehearsal tooling for safer staging migration.
- GitHub Actions for build, type checking, linting, audits, and tests.
- VPS deployment documentation with Nginx, PHP-FPM, Supervisor, queues, and scheduler.

## Reliability and Data Safety

The project is used around real operational data, so reliability work became part of the product itself. Recent work focused on separating public demo data from real company records, protecting sensitive identity fields, and preparing a controlled SQLite-to-MySQL migration path before any 24/7 staging rollout.

That reliability work matters because the system is not a toy demo. A broken dashboard, leaked demo record, failed PDF, or wrong permission can affect trust in the tool. The roadmap therefore prioritizes regression checklists, staging validation, and read-only safety checks before larger product changes.

The current approach is deliberately incremental: document the risk, rehearse the database move in isolation, keep rollback paths simple, and only automate checks after the staging environment is stable.

## Recent Document Workflow Improvements

The recruitment workflow now treats printed/PDF interview records as part of the product, not as a secondary export. Interview PDFs can be downloaded reliably, include internal comments for audit context, and optionally include an attachment appendix. The candidate interview screen also formats dates in the Brazilian `dd/mm/yyyy` pattern so printed records match operator expectations.

The admission checklist and race/ethnicity declaration templates were also cleaned up for a more professional handoff: the checklist now uses a clearer fillable layout, and the race/ethnicity document renders as one copy instead of duplicated pages.

## Recent Freight Analytics Improvements

The freight dashboard was corrected to separate Kaique-owned operation metrics from third-party freight. KPIs, per-unit comparisons, and daily trend cards now use the `Kaique Geral` grouped values as the source of truth, with legacy fallback logic for older records.

This change matters because operational dashboards should not reward or penalize the company for freight that belongs to third parties. A regression test now covers that rule by creating a mixed Kaique/third-party freight record and verifying that the dashboard only reports the Kaique portion.

## Product Decisions

The interface is intentionally practical. It favors dense tables, filters, status chips, and direct actions because the target user repeats the same workflows often and needs to scan data quickly.

The architecture also keeps many workflows close to their module boundaries. That makes it easier to trace a business rule from the screen to the API endpoint, validation, model, and database table.

## What I Learned

This project strengthened several skills that are hard to show in small assignments:

- modeling a domain with connected workflows;
- handling permissions beyond a simple admin/user split;
- protecting write operations from duplicate or inconsistent records;
- documenting deployment and maintenance, not only local development;
- balancing UI polish with operational speed;
- writing code that another reviewer can understand without needing a live explanation.

## Current Status

The platform is active as a production-style project with a public application URL and ongoing development. The documentation has been organized so a reviewer can understand the problem, architecture, setup, quality checks, deployment model, and reliability roadmap from the repository itself.

## Next Steps

- Complete the Forge/VPS staging environment with MySQL or MariaDB.
- Turn the manual regression checklist into automated coverage for the safest flows.
- Implement the planned read-only `transport:validate-demo` command after staging is stable.
- Add a short demo video and screenshots for the main modules.
- Continue improving the mobile driver workflow.
- Add more operational metrics around exports, queues, and page performance.
