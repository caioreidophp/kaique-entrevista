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
- Duplicate prevention and idempotency on critical write flows.
- Queue-backed exports and failed-job recovery surfaces.
- PDF and spreadsheet generation for business documents.
- GitHub Actions for build, type checking, linting, audits, and tests.
- VPS deployment documentation with Nginx, PHP-FPM, Supervisor, queues, and scheduler.

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

The platform is active as a production-style project with a public application URL and ongoing development. The documentation has been organized so a reviewer can understand the problem, architecture, setup, quality checks, and deployment model from the repository itself.

## Next Steps

- Add a short demo video to the README.
- Add screenshots for the main modules.
- Expand automated authorization tests.
- Continue improving the mobile driver workflow.
- Add more operational metrics around exports, queues, and page performance.
