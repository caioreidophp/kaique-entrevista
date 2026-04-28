# Contributing Guide

This repository is used both as a production-like transport platform and as a portfolio artifact. Contributions should preserve reliability, readability, and explainability.

## Working Principles

- Prefer narrow, reviewable changes over wide refactors.
- Preserve auditability on critical operational flows.
- Keep UX dense but readable; this is an operations tool, not a marketing site.
- Document business-facing changes in pull requests and markdown docs when behavior changes.

## Local Workflow

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
composer dev
```

## Quality Gates

Before opening a pull request:

```bash
npm run build
npm run lint:check
php artisan test
```

## Branching

- Use short, descriptive branch names.
- Keep one concern per branch whenever possible.
- If the change is exploratory, use a dedicated branch so it can be dropped cleanly.

## Commit Style

Use commit messages that explain intent, not only the file touched.

Examples:

- `feat: redesign transport home for command-center overview`
- `security: tighten browser security headers by environment`
- `docs: add architecture and presentation notes`

## Pull Requests

Every PR should answer:

- What problem changed for the user or operator?
- What technical risk was introduced or reduced?
- How was it verified?
- What screenshots or recordings demonstrate the UX change?

## Reverting Changes

This project intentionally supports reversible review flows.

```bash
git checkout main
git branch -D your-review-branch
```

If a branch has already been merged, revert using a normal Git revert commit instead of rewriting history.
