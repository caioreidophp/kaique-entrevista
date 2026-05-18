# Publication Checklist for Reviewers

Use this checklist before sharing the repository or live application with a university, professor, mentor, or technical reviewer.

## Repository

- README explains the problem, product scope, stack, setup, and quality checks.
- Architecture, security/performance, and case study documents are linked from README.
- The repository does not contain private `.env` values or real credentials.
- Commit history shows steady work and clear messages.
- GitHub Actions are visible and passing on the shared branch.
- License and contribution notes are present.

## Demo

- Live app link works over HTTPS.
- Demo account uses safe sample data.
- Screens do not expose private phone numbers, documents, addresses, or employee information.
- A short backup video exists in case the live app is unavailable.
- The demo focuses on one or two complete workflows instead of every page.

## Technical Evidence

- Tests can be run locally with `php artisan test` or `composer test`.
- Frontend checks can be run with `npm run types`, `npm run lint:check`, and `npm run build`.
- Deployment notes explain how the production environment is maintained.
- Security and performance notes explain current controls and remaining improvements.

## Final Local Checks

```powershell
npm run types
npm run lint:check
npm run build
php artisan test
```

If production assets need to be refreshed for the current server setup:

```powershell
npm run build
php artisan optimize:clear
php artisan optimize
```

## Submission Pack

Prepare these links/files:

- GitHub repository URL.
- Live demo URL.
- Short demo video.
- One-page project summary.
- Optional: architecture diagram or screenshots of core workflows.

## Reviewer Questions to Prepare For

- What problem did the project solve?
- Which parts did you build yourself?
- What was the hardest technical decision?
- How do permissions work?
- How do you prevent duplicate or invalid operational records?
- How would you improve the project with another month?
