# Admissions Demo Script

This script is for a short college/portfolio walkthrough. The goal is to show a real project clearly, not to explain every menu item.

Use only the demo account and synthetic data. If real names, phone numbers, documents, or private company records appear, stop recording and fix the demo isolation first.

## Recommended Length

2 to 4 minutes.

## Before Recording

- Confirm the demo account logs in.
- Confirm the demo account does not show real company records.
- Open the app at the home page.
- Keep browser zoom at 100%.
- Hide browser bookmarks or unrelated tabs.
- Prepare the repository README in another tab.
- Pick two product workflows and one technical detail to show.

## Suggested Flow

### 0:00 - 0:25 | Context

"I built this project for a real transport operation that needed a better way to organize daily work. Before this, information could be spread across spreadsheets, messages, documents, and repeated manual checks. The system brings those workflows into one authenticated Laravel and React application."

Show: home page or module overview.

### 0:25 - 1:10 | Workflow 1: Freight

Show the freight area because it is visual and operational.

Suggested path:

1. Open Freight Dashboard or Central Analytics.
2. Show filters by period/unit.
3. Point out freight totals, unit comparisons, SPOT freight, and third-party separation.
4. Mention one concrete improvement:

"One issue I had to fix was making sure Kaique freight and third-party freight were not mixed in the dashboard, because that made the numbers misleading."

### 1:10 - 1:55 | Workflow 2: Payroll or Recruitment

Pick one depending on the audience.

Payroll option:

1. Open Payroll.
2. Show payment list or pending daily pay/extras.
3. Explain that payments can be tracked, filtered, exported, and linked to operational notes.

Recruitment option:

1. Open recruitment/interviews.
2. Show candidate status, attachments, notes, and PDF/print workflow.
3. Explain that the PDF/export part matters because the office actually uses documents.

### 1:55 - 2:35 | Engineering Depth

Switch briefly to the repository or explain while staying in the app.

Mention:

- Laravel backend with API validation and policies/permissions.
- React + TypeScript frontend with Inertia.
- File uploads, PDFs, spreadsheet exports.
- Activity logs and operational support screens.
- Manual regression checklist because the app touches real workflows.
- SQLite-to-MySQL migration rehearsal before moving to a 24/7 server.

Keep it simple:

"The hardest part was not just building forms. It was keeping the system safe enough for real use: permissions, duplicate checks, demo-data isolation, backups, and rollback plans."

### 2:35 - 3:00 | Close

"What I am proud of is that this started from an actual operational problem and became a maintained full-stack system. It taught me how software changes when real people depend on it: small bugs matter, data safety matters, and documentation matters."

## Optional Longer Version

If the video can be 4 minutes, add:

- one quick look at the README/case study;
- one screenshot of GitHub Actions or quality checks;
- one example of a regression checklist item;
- one sentence about the next step: staging on Forge/VPS with MySQL/MariaDB.

## Things Not To Say

Avoid overclaiming:

- Do not say it is a finished SaaS product.
- Do not claim public users, revenue, or metrics that are not verified.
- Do not say the live system is already fully migrated to MySQL.
- Do not show real private records to prove that it is used.

Better phrasing:

"This is an internal operations system that is still evolving. The next infrastructure step is a separate staging server with MySQL/MariaDB."
