# Admissions Publication Checklist

Use this before sharing the repository, screenshots, or demo video with a college, professor, mentor, or reviewer.

## Repository

- README explains the real problem, current status, stack, setup, quality checks, and limitations.
- Case study is linked from README.
- One-page admissions summary is linked from README.
- Demo script and screenshot checklist are linked from README.
- No `.env`, database files, backups, storage folders, private documents, or real credentials are tracked.
- Commit history does not include obvious secrets.
- GitHub Actions or local quality checks are documented.
- License is present.

## Demo Safety

- Demo account logs in successfully.
- Demo data is synthetic.
- Demo account does not show real records.
- Real accounts do not show demo records.
- No real phone numbers, emails, CPF/RG/CNH, documents, addresses, or employee records appear.
- If demo isolation is uncertain, use screenshots/video already reviewed instead of live navigation.

## Video

- Video is 2 to 4 minutes.
- It starts with the problem, not the tech stack.
- It shows one or two complete workflows.
- It mentions one or two hard technical problems honestly.
- It does not claim the project is a finished SaaS product.
- It does not claim the current live system is already fully hosted on MySQL.
- It closes with what you learned.

## Screenshots

- Screenshots use demo data only.
- Screenshots show filled workflows, not empty pages.
- Browser tabs/bookmarks do not expose unrelated private information.
- Screenshots are named clearly.
- Any screenshot with private data is deleted and retaken.

## Technical Checks

Run the safest local checks before publishing a fresh update:

```powershell
npm run types
npm run build
git diff --check
```

Run broader checks when time allows:

```powershell
npm run lint:check
npm run format:check
composer test
```

If broader checks fail because of known existing formatting/lint debt, document that honestly instead of hiding it.

## Submission Pack

Prepare:

- GitHub repository URL.
- Live URL or demo video.
- One-page project summary.
- Case study.
- 5 to 8 screenshots.
- Short explanation of what is real, what is demo, and what is still in progress.

## Questions To Prepare For

- Why did you build this?
- Who uses it or reviews it?
- Which parts did you build yourself?
- What was the hardest bug or product decision?
- How do permissions work?
- How do you prevent demo data from mixing with real data?
- Why is the current database still SQLite?
- What would you improve next?

## Final Rule

Do not prove the project is real by showing private company data. Prove it through the code, documentation, demo dataset, screenshots, and a clear explanation of the real problem.
