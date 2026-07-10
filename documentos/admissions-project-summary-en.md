# Admissions Project Summary

## Project

Kaique Transport Operations Platform

## One-Sentence Description

I built a Laravel + React internal operations system to help a transport company manage freight records, payroll routines, vacations, recruitment, onboarding documents, permissions, and operational checks in one authenticated web app.

## Why It Matters

The project came from a real problem: important daily work was spread across spreadsheets, messages, documents, and memory. I wanted to turn those repeated workflows into a system that was easier to search, safer to update, and clearer to audit.

## What I Built

- Freight management with records, SPOT freight, canceled loads, displacement records, and analytics.
- Payroll tools for launches, lists, reports, adjustments, and pending daily pay/extras.
- Vacation planning with dashboards, reports, and timeline views.
- Recruitment workflows for resumes, interviews, attachments, statuses, notes, and PDFs.
- Onboarding and collaborator registry workflows.
- Admin tools for users, roles, permissions, units, functions, payment types, plates, and logs.
- Documentation for setup, regression checks, staging, demo safety, and future deployment.

## Technical Stack

- Backend: Laravel 12, PHP, Fortify, Sanctum, Eloquent, queues.
- Frontend: React 19, TypeScript, Inertia.js, Vite.
- Current live/local database: SQLite.
- Staging target: MySQL/MariaDB on a Forge/VPS server.
- Documents: DomPDF and PhpSpreadsheet.
- Quality checks: TypeScript, ESLint, Prettier, PHPUnit, GitHub Actions.

## Hard Parts

- Keeping demo data separate from real company data.
- Handling permissions in both the UI and backend API.
- Preventing duplicate or invalid operational records.
- Generating PDFs and exports that match real office workflows.
- Preparing a safe SQLite-to-MySQL migration path without risking real data.
- Improving the system while it is already being used.

## What This Shows About Me

This project shows that I can find a real problem, build a useful technical solution, keep improving it after feedback, and think about data safety, deployment, and maintenance instead of only building screens.

## Honest Current Status

The system is still an internal company tool, not a finished public SaaS product. It currently runs through a local environment exposed with Cloudflare Tunnel. A separate 24/7 staging environment with MySQL/MariaDB is being prepared carefully before any larger infrastructure change.

## Best Way To Review It

1. Read the README.
2. Read the case study.
3. Watch a short synthetic-data demo video.
4. Review one complete workflow, such as freight analytics, payroll, or recruitment.
5. Check the architecture/security notes and regression checklist.
