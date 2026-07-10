# Project Case Study

## Short Version

Kaique Transport Operations Platform is an internal web system I built to help a transport operation move daily work out of scattered spreadsheets, messages, folders, and repeated manual checks.

The project is not a classroom mockup. It grew from real operational needs: freight records, payroll routines, vacation planning, recruitment, onboarding documents, permissions, PDFs, exports, and support screens. Because the current data is real, the public-facing work around this project has to be careful: demo data must stay synthetic, sensitive records must stay private, and infrastructure changes need backup and rollback plans.

## The Problem I Was Trying To Solve

The company had many workflows that changed every day. A single piece of information could be in a spreadsheet, a message thread, a scanned document, or someone's memory. That creates practical problems:

- people need to ask around before trusting a status;
- repeated forms can create duplicate records;
- private documents are hard to organize consistently;
- payment and freight information needs checking before decisions are made;
- it is hard to know who changed what after the fact.

I wanted to build something useful for the actual operation, not just a polished demo screen.

## What I Built

The system is a Laravel + React/Inertia application organized into operational modules:

- Freight management for launches, lists, canceled loads, SPOT freight, displacement records, and analytics.
- Payroll for launches, lists, collaborator reports, unit reports, adjustments, and pending daily pay/extras.
- Vacations for planning, dashboards, reports, and timeline views.
- Recruitment for resumes, interviews, statuses, attachments, notes, and PDFs.
- Onboarding and next steps for moving candidates into collaborator records.
- Registry screens for collaborators, users, roles, units, functions, payment types, plates, aviaries, and infractions.
- Support tools for logs, telemetry, queues, settings, permissions, and operational recovery.

The current live company environment still runs through a local machine exposed by Cloudflare Tunnel. A safer Forge/VPS staging environment with MySQL or MariaDB is being prepared separately, because the current database is SQLite and contains real operational data.

## My Role

I worked across the full stack:

- database tables, migrations, and model relationships;
- Laravel API controllers, validation, permissions, and business rules;
- React/TypeScript pages for dense internal workflows;
- PDF and spreadsheet exports;
- file upload handling for public and private attachments;
- demo-data safety checks;
- deployment notes, backup notes, and regression checklists.

The hardest part has been keeping the system useful while it is already being used. A small bug can affect a real workflow, so I learned to slow down before risky changes, make backups, test targeted flows, and keep rollback paths visible.

## Technical Decisions That Matter

### Demo and Real Data Must Stay Separate

The project has a demo account for public walkthroughs, but demo data is not allowed to leak into real accounts, and real company records should never appear in the demo. That rule sounds simple until the app has many modules, filters, dashboards, and reports. It became one of the most important safety boundaries in the project.

### Permissions Are Backend Rules, Not Just Sidebar Visibility

The sidebar changes based on the user's profile, but the API still has to enforce access rules. This matters because hidden buttons do not protect data by themselves.

### The UI Is Dense On Purpose

This is an internal operations tool. The users are not visiting a marketing site; they are checking records, comparing units, launching payments, updating statuses, and downloading documents. I chose tables, filters, compact cards, status chips, and direct actions because repeated use matters more than visual decoration.

### Infrastructure Changes Need Rehearsal

The current system uses SQLite locally. Moving to MySQL/MariaDB is the right direction for a 24/7 hosted environment, but doing that directly on real data would be careless. I added migration/audit/compare tooling and documented a staged path before switching the active environment.

### PDFs and Attachments Are Part of the Product

Recruitment and payroll workflows often end in documents. If a PDF has wrong dates, missing comments, broken attachments, or duplicated pages, the feature is not complete. I learned that "export" is not a side feature when people rely on it operationally.

## Examples Of Problems I Had To Fix

- A dashboard was counting third-party freight together with Kaique freight, which made operational totals misleading.
- A demo setup accidentally risked mixing synthetic data with real views, so demo isolation became a higher priority.
- Some encrypted fields needed more database storage before a future MySQL migration to avoid truncation risk.
- A new table was deployed in code before the local SQLite migration had run, causing a missing-table error until the migration was applied.
- Percentage displays in freight analytics were rounding too aggressively for operational review, so they were changed to two decimal places where needed.

These are not glamorous problems, but they are the kind of problems real systems create.

## What I Learned

This project taught me more than isolated assignments because the work connects product, code, data, and operations.

I learned that:

- building the first version is easier than maintaining trust in the system;
- demo data is a security problem, not only a presentation problem;
- permissions need to be checked in more than one place;
- backups and rollback notes are part of responsible development;
- small UI details matter when people use a screen every day;
- documentation should explain decisions, not just list commands.

## Current Status

The system is actively developed and used as an internal operations platform. It is not presented as a finished SaaS product. The current public URL points to the existing local/Cloudflare Tunnel setup, while a proper staging environment is being planned for Forge/VPS with MySQL or MariaDB.

For admissions or portfolio review, the safest way to evaluate the project is through:

- this repository;
- a synthetic-data demo account;
- screenshots or a short recording;
- the architecture and security notes;
- the manual regression checklist.

## Next Steps

- Make the demo dataset more reliable and easier to validate before recordings.
- Finish the 24/7 staging environment with MySQL/MariaDB.
- Add a short walkthrough video using synthetic data only.
- Add screenshots for the main workflows in the README or a dedicated portfolio page.
- Turn the manual demo validation plan into an Artisan command.
- Add more automated tests around demo isolation and high-risk financial flows.
