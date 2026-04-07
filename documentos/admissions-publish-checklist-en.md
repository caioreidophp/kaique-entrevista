# GitHub + Demo Publication Checklist (US Admissions)

Use this checklist before sharing the project with admission committees, professors, or recruiters.

## 1) Repository Presentation

- Project name and short description are clear and professional.
- README is fully in English and problem-oriented.
- Architecture, modules, and engineering decisions are documented.
- Live demo link is visible near the top of README.
- Screenshots or GIFs are added for core workflows.
- License is present and correct.

## 2) Proof of Engineering Quality

- Test strategy is explained (regression, contract, E2E).
- CI status is green on the default branch.
- Security/reliability controls are documented:
  - idempotency
  - rate limiting
  - auth/permissions
  - observability
- Changelog and in-app update log show consistent delivery history.

## 3) Demo Readiness

- A read-only demo account is available.
- Demo data is realistic but non-sensitive.
- 2-minute demo script is rehearsed.
- Fallback video exists in case of temporary outage.

## 4) Production Safety

- Secrets are not committed.
- `.env` values are configured only in server environment.
- Health checks are working.
- Queue worker and scheduler are active.
- HTTPS certificate is valid.

## 5) Final Validation Commands

Run this exact sequence before publishing:

```powershell
npm run build
php artisan migrate
php artisan optimize:clear
php artisan optimize
```

Connectivity smoke check:

```powershell
$local = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -WarningAction SilentlyContinue
$public = Test-NetConnection -ComputerName app.kaiquetransportes.com.br -Port 443 -WarningAction SilentlyContinue
if ($local.TcpTestSucceeded) { 'LOCAL:ONLINE:8000' } else { 'LOCAL:OFFLINE:8000' }
if ($public.TcpTestSucceeded) { 'PUBLIC:ONLINE:443' } else { 'PUBLIC:OFFLINE:443' }
```

## 6) Admissions-Oriented Submission Pack

- GitHub repository link.
- Live demo link.
- 2-minute demo video link.
- 1-page technical summary PDF:
  - problem
  - architecture
  - engineering decisions
  - measurable outcomes
  - roadmap

## 7) Final Self-Check

- If someone opens only README + demo link, can they understand value in under 2 minutes?
- Is the project presented as real engineering ownership, not only UI work?
- Are trade-offs and constraints explained honestly?
