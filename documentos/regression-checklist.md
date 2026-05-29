# Manual Regression Checklist

Use this checklist before deployments, public demos, staging data imports, or any change that touches permissions, dashboards, documents, imports, exports, or the demo account.

The goal is not to test every pixel. The goal is to catch the failures that matter most to a real transport operation: wrong data visibility, broken login, incorrect totals, missing documents, failed exports, and regressions in daily workflows.

## Safety Rules

- Do not run destructive database commands during this checklist.
- Do not run `migrate:fresh`, `db:wipe`, `migrate:reset`, `migrate:refresh`, or seeders against real data.
- Do not expose `.env`, `APP_KEY`, passwords, CPF/RG/CNH, or private attachments in screenshots or videos.
- If a real account sees demo data, stop and fix isolation before continuing.
- If a demo account sees real data, stop and fix isolation before continuing.

## Pre-Check

- `git status --short` is clean or only expected documentation/code files are changed.
- The current branch is known.
- The app loads without a blank page.
- `php artisan about` works.
- `npm run types` passes when frontend files changed.
- `npm run build` passes before deploying or using the Cloudflare Tunnel for a demo.
- `php artisan optimize` has been run after production build changes when using the local tunnel.

## Authentication

- Real account login works.
- Demo account login works.
- Logout works from both accounts.
- Invalid credentials show a clear error.
- Demo account remains read-only: try one harmless write action and confirm it returns a blocked/forbidden response.

## Demo Isolation

Real account:

- Collaborators list does not show names starting with `Demo`.
- Units list does not show `Demo Amparo` or `Demo Itapetininga`.
- Freight dashboard does not show demo units.
- Payroll dashboard/list does not include demo payment rows or demo payment types.
- Vacations dashboard/list does not show demo collaborators or demo units.
- Plates and aviaries do not show `DMO` demo plates.
- Home cards and super-dashboard do not include demo units or demo totals.

Demo account:

- Collaborators list shows only demo collaborators.
- Freight dashboard shows demo freight data.
- Payroll pages show demo payroll data.
- Vacations dashboard shows demo vacations and current active vacations.
- Interviews/curriculums show demo candidates.
- Sensitive admin pages, logs, backups, and user management remain blocked if intended for demo.

## Sidebar And Permissions

- Sidebar loads for the current module.
- Module navigation respects the logged-in user's permissions.
- `Acesso geral` opens by click and stays open after the mouse leaves.
- Demo account does not show sensitive links such as users, activity logs, or backups.
- Active menu state matches the current page.
- Mobile menu opens and closes correctly.

## Home

- Home cards load without console/API errors.
- Registry active collaborator count looks plausible.
- Freight current-month totals match the freight module for the same period.
- Payroll current-month total matches the payroll module.
- Vacations cards do not include demo data for real users.
- Programming and fines cards load for users with permission.

## Registry

- Collaborators list loads with search, filters, pagination, and actions.
- Birthdays section does not include demo data for real users.
- Create/edit collaborator validation works.
- Duplicate name/phone warnings still appear.
- Attachments can be viewed/downloaded when present.
- Units, functions, payment types, plates/aviaries, and infractions load for permitted users.

## Interviews And Curriculums

- Interviews list loads.
- Create interview opens all steps, including final evaluation.
- Editing an existing interview works.
- Final score/note appears in the interview table when available.
- Curriculums page shows tabs for all/pendentes/convocados/descartados.
- Candidate list remains available in the expected navigation.
- Duplicate name/phone alerts consider curriculums and interviews.
- View interview page loads attachments and comments.

## PDFs And Documents

- Interview print works.
- Interview PDF download works.
- Dates appear in Brazilian display format where expected.
- Comments appear in print/PDF where expected.
- Optional attachments behavior is clear.
- Checklist document is readable, compact, and printable.
- Race/ethnicity document does not duplicate pages.

## Freight

- Dashboard loads for the selected month.
- Unit filter works.
- Sem spot/com spot behavior is clear.
- Kaique totals do not include third-party-only values incorrectly.
- List page filters and pagination work.
- Launch page saves valid freight records.
- Spot freight pages work for permitted users.
- Canceled loads page loads.
- Exports/import previews work when enabled.

## Payroll

- Dashboard loads for the selected competence.
- Payment launch works for a safe test row in staging/demo only.
- Payment list filters by competence and collaborator.
- Adjustments page loads.
- Reports by unit and collaborator load.
- Export buttons return a file or an async export status.

## Vacations

- Dashboard KPIs load.
- Timeline is readable with many entries.
- Current active vacations are visible when expected.
- Launch vacation form validates dates and days.
- List filters and edit modal work.
- Reports by period load.

## Fines

- Dashboard loads.
- Launch fine and launch notification pages load.
- List filters work.
- Registry data for infractions and agencies remains available.

## Programming

- Dashboard loads.
- Imported/programmed trips appear by date.
- Available drivers/trucks counts look plausible.
- Assignment flow respects availability and permissions.

## Operations

- Operations hub loads.
- Activity log loads for permitted users.
- Settings loads for permitted users.
- Backup download is blocked for unauthorized users.
- System telemetry/observability pages do not expose secrets.

## Storage

- Public uploaded files open through expected routes.
- Private documents download through authenticated routes only.
- Missing files show a controlled error, not a blank page.

## Final Approval

Mark the change as ready only if:

- Real/demo data isolation passes.
- Login/logout passes.
- Home, freight, payroll, vacations, registry, and interviews pass smoke checks.
- No blank page appears.
- No sensitive file or data was committed.
- Build/type checks passed when relevant.

