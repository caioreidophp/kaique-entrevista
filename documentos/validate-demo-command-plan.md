# Technical Plan: `transport:validate-demo`

This is a design document only. The command should be implemented after staging is stable and the team is ready to add automated demo/real isolation checks.

## Purpose

`php artisan transport:validate-demo` should verify that the public demo is safe, useful, and isolated from real company data.

The command should not create, update, seed, delete, or repair data by default. Its first version should be read-only.

## Goals

- Confirm the demo account exists and is configured.
- Confirm the demo account remains read-only.
- Confirm the demo account has enough synthetic data for a walkthrough.
- Confirm real accounts do not see demo records.
- Confirm the demo account does not see real records in critical modules.
- Produce a clear pass/fail report that can be saved in CI, staging, or pre-demo checks.

## Non-Goals

- Do not seed demo data.
- Do not delete demo data.
- Do not change permissions.
- Do not alter `.env`.
- Do not repair broken records automatically.
- Do not run against a production database unless explicitly intended by the operator.

## Proposed Signature

```bash
php artisan transport:validate-demo
    {--demo-email= : Override configured demo email}
    {--real-user-email= : Optional real account to test real-side visibility}
    {--json : Output machine-readable JSON}
    {--fail-on-warning : Return failure when warnings exist}
```

## Checks

### Configuration

- `TRANSPORT_DEMO_ENABLED` or equivalent config is enabled.
- Demo email is configured.
- Demo read-only flag is enabled.
- No secret values are printed.

### Demo Account

- Demo user exists.
- Demo user email matches config.
- Demo user is recognized by `User::isDemoAccount()`.
- Demo user has expected module permissions for demo walkthrough.
- Demo user does not have sensitive permissions for users, backups, activity logs, or real-data visibility.

### Demo Dataset

Minimum suggested thresholds:

- Demo units: at least 2.
- Demo collaborators: at least 50.
- Demo freight entries: at least 6.
- Demo payroll entries: at least 100.
- Demo vacation entries: at least 24.
- Current active demo vacations: at least 1.
- Demo interviews/curriculums: at least 3.
- Demo fleet plates: at least 2.

### Real Account Isolation

When authenticated as a real account:

- `Colaborador::where('nome', 'like', 'Demo %')->count()` returns 0.
- `Unidade::where('slug', 'like', 'demo-%')->count()` returns 0.
- Demo freight entries are not visible.
- Demo payroll entries are not visible.
- Demo vacations are not visible.
- Demo plates are not visible.
- Home payload does not include `Demo Amparo`, `Demo Itapetininga`, or demo collaborator names.

### Demo Account Isolation

When authenticated as demo:

- Collaborator list contains only demo collaborators.
- Demo units are visible.
- Demo freight/payroll/vacation data is visible.
- Real collaborator names are not visible in demo-scoped endpoints.
- Write endpoints are blocked by read-only middleware.

## Suggested Output

Human-readable:

```text
Demo validation
---------------
Configuration: PASS
Demo account: PASS
Demo dataset: PASS
Real account isolation: PASS
Demo account isolation: PASS
Read-only enforcement: PASS

Verdict: PASS
```

JSON:

```json
{
  "verdict": "pass",
  "checks": [
    {"name": "demo_account_exists", "status": "pass"},
    {"name": "real_account_hides_demo_units", "status": "pass"}
  ],
  "warnings": []
}
```

## Failure Levels

- `PASS`: safe to use demo.
- `WARNING`: demo is safe but weak for presentation, such as too little synthetic data.
- `FAIL`: unsafe or broken, such as demo seeing real data or real account seeing demo data.

## Safe Rollback Strategy

The command should be introduced in one commit. If it behaves incorrectly:

```bash
git revert <commit>
composer dump-autoload
php artisan optimize
```

Because the first version is read-only, rollback should not require database restoration.

## Future Extensions

- Add a `--report=path` option to write Markdown reports.
- Add CI/staging integration.
- Add endpoint-level validation through HTTP requests instead of only model queries.
- Add optional `--repair-suggestions` that prints suggested commands without running them.

