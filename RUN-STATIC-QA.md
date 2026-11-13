# Stage 18 — Repeatable static QA

## Run the check
From the extracted website folder, run:

```bash
python3 qa_check.py
```

On Windows, if `python3` is unavailable, use:

```powershell
py qa_check.py
```

The script checks:
- Every HTML page has no duplicate element IDs.
- Every local CSS and JavaScript file referenced by HTML exists.
- Every local page link points to an existing file.

A successful result means these static checks passed. It does **not** mean the website works end-to-end.

## Not covered
- Browser rendering or responsive layout.
- JavaScript runtime behavior and console errors.
- Supabase connectivity, Auth, RLS, RPCs or database constraints.
- Voting security or duplicate-vote enforcement.
- Admin permissions or data mutations.
- Accessibility, performance or SEO.

Run this after each future ZIP update. For browser and database tests, follow `STAGING-TEST-PLAN.md` using a separate staging project.
