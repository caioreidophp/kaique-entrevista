# 2-Minute Demo Script (US Admissions Focus)

Use this script as a concise and credible walkthrough for portfolio reviews, university applications, and recruiter screens.

## Goal

Demonstrate that this is not a toy app, but an operations platform with real engineering depth.

## Demo Setup (before recording/live)

- Open the app in an authenticated session.
- Keep two tabs ready:
  - Main UI dashboard flow
  - API/system endpoints for observability
- Prepare one clean dataset scenario (freight + payroll + vacation records already loaded).

## Timeline Script (120 seconds)

### 0:00 - 0:20 | Problem + Scope

"This platform was built to centralize transport operations in one system: freight execution, payroll, vacations planning, and recruitment onboarding. The key challenge is combining operational speed with reliability and governance."

### 0:20 - 0:50 | Product Walkthrough

- Show Freight dashboard and one operational metric.
- Open freight list or launch screen quickly.
- Show Vacations dashboard and filtered reports by unit.

"Operators can move from daily execution to planning in a few clicks, with dashboards and lists connected to the same backend rules."

### 0:50 - 1:25 | Engineering Depth

- Mention idempotency on critical write endpoints.
- Mention adaptive throttling for sensitive routes.
- Show system observability and queue monitor endpoints.

"Critical operations are protected against duplicates, API abuse is controlled with adaptive limits, and operations has built-in visibility for latency and failed jobs."

### 1:25 - 1:45 | Quality and Delivery

- Mention tests + CI gates (contract and E2E).
- Mention deployment automation (VPS runbook + pipeline).

"The project includes regression/contract/E2E coverage and deployment playbooks so changes can be shipped safely."

### 1:45 - 2:00 | Impact + Next Steps

"This architecture is designed for real usage: fast operational workflows, safer critical actions, and better observability for continuous improvement. Next steps are broader analytics and mobile workflow expansion."

## Optional 30-Second Technical Appendix

If asked for deeper technical details:

- Backend: Laravel 12 + Sanctum + queue workers.
- Frontend: React 19 + TypeScript + Inertia + Vite.
- Reliability: idempotency middleware + route-aware throttling.
- Operations: telemetry/observability endpoints + failed job controls.

## Recording Tips

- Keep the browser zoom at 100%.
- Use large cursor and highlight clicks.
- Avoid typing passwords during recording.
- If production is unavailable, use local and show a short backup clip.
