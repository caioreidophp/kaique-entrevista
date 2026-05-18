# Demo Script for Reviewers

Use this as a short, natural walkthrough for university applications, portfolio reviews, or technical conversations.

## Goal

Show that the project solves a real operational problem and that the engineering work goes beyond building isolated screens.

## Before Recording

- Use a demo account with no private data.
- Keep the app open at the transport home page.
- Prepare one clean workflow to show, such as resume intake to interview status or freight launch to report.
- Keep the repository README open in another tab in case the reviewer wants technical context.

## Two-Minute Walkthrough

### 0:00 - 0:20 | Problem

"This project was built to centralize transport operations that are often split across spreadsheets, messages, and paper documents. The goal is to make daily work faster while keeping permissions, audit history, and data quality under control."

### 0:20 - 0:55 | Product Flow

Show one complete workflow. Good options:

- open the recruitment/resume area, filter candidates, and show how interview status is tracked;
- open freight records, show filtering/reporting, and connect it to operational dashboards;
- open vacation planning and show how unit-level planning is reviewed.

Keep this part visual and concrete. Avoid explaining every menu item.

### 0:55 - 1:30 | Engineering Depth

Mention the parts that are not obvious from the UI:

- Laravel backend with React/TypeScript frontend;
- permission-aware navigation and API checks;
- duplicate prevention and validation on critical forms;
- queues for heavier jobs and exports;
- activity logs and observability endpoints;
- automated checks in GitHub Actions.

### 1:30 - 1:50 | Documentation and Deployment

"The repository includes setup instructions, architecture notes, security/performance notes, and deployment runbooks for a VPS-style environment using Nginx, PHP-FPM, queues, and scheduled tasks."

### 1:50 - 2:00 | Close

"What I wanted to show with this project is end-to-end ownership: understanding a business problem, designing workflows, building the full stack, documenting decisions, and keeping the system maintainable."

## Optional Technical Appendix

If the reviewer asks for details:

- Backend: Laravel 12, Fortify, Sanctum, Eloquent, queues.
- Frontend: React 19, TypeScript, Inertia.js, Vite.
- Quality: PHPUnit, TypeScript, ESLint, Prettier, Pint, GitHub Actions.
- Operations: VPS deployment, Nginx, PHP-FPM, Supervisor, scheduler.

## Recording Tips

- Keep browser zoom at 100%.
- Use a clean demo dataset.
- Do not show real phone numbers, documents, or personal data.
- Keep the video under three minutes unless a longer technical walkthrough is requested.
