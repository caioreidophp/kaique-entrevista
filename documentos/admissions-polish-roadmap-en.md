# Admissions Polish Roadmap

This roadmap keeps the project presentation work separate from risky product changes.

## Phase 1: Documentation Pack

Risk: low.

Goal: make the repository understandable without a live explanation.

Status:

- README explains the project in a more personal and honest voice.
- Case study explains the real problem, technical decisions, and current status.
- One-page admissions summary is available.
- Demo video script is available.
- Screenshot checklist is available.
- Publication checklist is available.

Do not change business logic in this phase.

## Phase 2: Demo Safety

Risk: medium.

Goal: make sure public walkthroughs use only synthetic data.

Recommended work:

- Verify that the demo account logs in.
- Verify that demo users cannot see real records.
- Verify that real users do not see demo records.
- Create or improve a `transport:validate-demo` command.
- Add tests for demo/real visibility boundaries.
- Build a believable synthetic dataset for freight, payroll, vacations, recruitment, and registry screens.

Do not run demo seed commands against real data without a fresh backup and a rollback plan.

## Phase 3: Visual Presentation

Risk: low to medium.

Goal: make the project easier to understand quickly.

Recommended work:

- Capture 5 to 8 screenshots using demo data.
- Add screenshots to README or a dedicated portfolio page.
- Record a 2 to 4 minute walkthrough video.
- Keep the video focused on two workflows and one technical explanation.
- Fix visible encoding/accent issues before screenshots.

Do not use real employee, applicant, document, or financial data in screenshots.

## Phase 4: Reliability Evidence

Risk: medium.

Goal: show that the project is maintained responsibly.

Recommended work:

- Keep the manual regression checklist current.
- Add automated tests around high-risk flows.
- Document known lint/format debt honestly if broad checks are not clean yet.
- Finish staging on Forge/VPS with MySQL/MariaDB before claiming 24/7 hosting.

Do not claim the app is fully migrated to MySQL until the active environment actually is.

## Phase 5: Future Product Direction

Risk: high if implemented too early.

Goal: describe future direction without overbuilding.

Possible future work:

- Staging environment.
- Better demo validation.
- Receipt generator for payments.
- More automated tests.
- Mobile driver workflow.
- Possible SaaS/white-label architecture research.

Do not implement SaaS, company IDs, or white-label changes until the current system is stable and backed up.

## Best Next Step

The safest next step is to stabilize the demo environment, then capture screenshots and record the short walkthrough. That will improve admissions presentation more than adding another feature.
