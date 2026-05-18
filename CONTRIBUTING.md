# Contributing Guide

This project is maintained as a real transport operations system and as a public engineering portfolio. Changes should be easy to review, easy to explain, and safe for operational workflows.

## Principles

- Keep changes focused on one problem at a time.
- Preserve auditability for business-critical actions.
- Prefer explicit validation and permission checks over hidden UI-only rules.
- Keep the interface practical for repeated operations work.
- Update documentation when behavior, setup, deployment, or reviewer-facing context changes.

## Local Workflow

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
composer dev
```

## Quality Checks

Run the relevant checks before pushing:

```bash
npm run types
npm run lint:check
npm run format:check
php artisan test
npm run build
```

For backend style checks:

```bash
composer test:lint
```

## Branches and Commits

- Use short branch names that describe the work.
- Keep unrelated fixes in separate commits.
- Write commit messages around intent, for example:
  - `docs: improve reviewer-facing project overview`
  - `fix: prevent duplicate curriculum phone numbers`
  - `feat: add interview final score column`

## Pull Requests

Every pull request should answer:

- What user or operator problem changed?
- Which modules or APIs were touched?
- What risk could regress?
- How was it verified?
- Are screenshots or recordings needed?

## Documentation Standards

- Keep the README clear enough for someone seeing the project for the first time.
- Use English for reviewer-facing technical documentation.
- Use Portuguese where it helps local operators or deployment/support readers.
- Avoid vague claims. Prefer concrete workflows, files, commands, and trade-offs.

## Reverting

If a branch is still under review, prefer deleting the branch or opening a small corrective commit. If a change has already been merged, use a normal revert commit so history remains understandable.
