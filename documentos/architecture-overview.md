# Architecture Overview

## Product Shape

Kaique Transport Operations Platform is a multi-module internal system for transport operations. It centralizes workflows that are usually fragmented across spreadsheets, chat threads, paper documents, and manual follow-up.

Primary modules:

- Freight management
- Payroll and deductions
- Vacation planning
- Driver interviews and hiring pipeline
- Onboarding execution
- Registry and permissions
- Operational observability and governance

## Technical Stack

- Backend: Laravel 12 + PHP 8.2
- Frontend: React 19 + TypeScript + Inertia.js + Vite
- Auth: Fortify + Sanctum
- Data exports: DomPDF + PhpSpreadsheet
- Auditability: activity logs, security incidents, queue visibility

## Runtime Model

1. Inertia routes render module pages inside a shared transport shell.
2. React pages call authenticated `/api/*` endpoints through a small API client layer.
3. Laravel controllers enforce validation, authorization, throttling, and business rules.
4. Critical writes use idempotency or route-sensitive throttling where duplicate effects would be dangerous.
5. Heavy exports and webhook deliveries run asynchronously through the queue.

## Design Intent

The application is intentionally structured as an operations workspace rather than a generic admin panel.

- Dense information, but grouped into decision-oriented panels
- Shared shell for navigation consistency
- Fast access to high-frequency actions
- Clear visual distinction between neutral metrics and urgent states

## Reliability Building Blocks

- Idempotency middleware on sensitive POST operations
- Adaptive throttling profiles for login, imports, uploads, and heavy endpoints
- Queue monitoring and failed-job recovery endpoints
- Structured validation requests for write operations
- Attachment handling with download restrictions and security headers

## Why This Matters for Reviewers

For engineering reviewers or admissions readers, the interesting part is not only the number of CRUD screens. The deeper story is that the project addresses real operational risk:

- duplicated writes
- permission-sensitive workflows
- document generation
- import pipelines
- observability for support and maintenance

That is the difference between a demo app and a production-shaped system.
