[README.md](https://github.com/user-attachments/files/34820035/README.md)
# TTPD BLOCKED BILLIE — Stage 14 cross-page JavaScript compatibility fix

This stage addresses a major integration issue discovered during static QA: every page loads the same `app.js`, but the previous script assumed that voting, winners, directory, news and admin elements existed on every page.

## Fixes
- `loadPublic()` now initializes only the data loaders whose target elements exist on the current page.
- Voting and winners loaders check their required page elements before manipulating them.
- Directory count labels are optional, so the Members and Admins pages can share the same directory loader.
- News ticker is optional on pages that show announcements without a ticker.
- `requireAdmin()` returns safely on public pages without admin login/dashboard elements.
- Top-level page-specific event listeners use optional DOM checks so missing controls on other pages do not stop script initialization.
- Setup messaging now checks whether the voting status element exists.

## Validation performed
- JavaScript syntax checked with Node.js (`node --check`).
- All existing page files and database logic retained, apart from the DOM compatibility guards above.

## Still needs browser / database testing
Static checks cannot verify Supabase RLS policies, real authentication, RPC behavior, or actual browser interactions. Test in a staging copy before production.

## Preview
Extract the ZIP and open `index.html`. Supabase-backed sections require internet access.

## Production caution
No live website or database was changed. Do not run the old `schema.sql` against production. Verify RLS and make a verified database backup before any migration or deployment.


## Stage 16 additions
- Hardened the shared gallery-back, mobile-menu and sign-out handlers against missing page elements or an unconfigured database.
- Added `HTML-INTEGRATION-AUDIT.md` covering duplicate IDs, missing local CSS/JS assets and broken local page links.
- These are static checks only; browser rendering and Supabase workflows remain unverified.


## Stage 17 — Staging QA pack
This stage adds a detailed manual test plan and a results template. No browser session, Supabase account, or live database was available for an end-to-end test in this step. The documents distinguish tests to perform from checks already completed; do not interpret the checklist as passed.


## Stage 18 — Repeatable QA script
Run `python3 qa_check.py` from the extracted folder to repeat the static HTML checks. See `RUN-STATIC-QA.md` for scope and limitations. A passing static check is not an end-to-end or security sign-off.


## Stage 19 — Homepage and Winners corrections
- Added a dedicated SVG TBB crest to the shared top header.
- Styled Admins and Members as bordered pill buttons.
- Replaced the decorative Memories / Community / Together strip with the main community countdown. When no date is configured, the page clearly says so rather than showing fake zeroes.
- Rebuilt the six homepage navigation cards into the intended layout: Voting full width; Winners and Events side by side; Gallery tall on the left; About Us and Admin Page stacked on the right.
- Changed Winners into a two-choice hub: Previous Winners and Dashboard. Added individual `previous-winners.html` and `winners-dashboard.html` pages.
- Fixed countdown rendering to target the actual `eventCountdownClock` element.

No live website or database was changed. The countdown requires an admin-configured `homepage_event` record. Browser and Supabase workflows still require staging tests.


## Stage 20 — palette, layout, logo slot and data-loader resilience
- Updated the homepage palette to match the olive/khaki metallic countdown treatment and burgundy/blue navigation cards in the supplied reference.
- Fixed grid placement with explicit named areas and reset the old grid-column/grid-row rules that were overriding Gallery's two-row position.
- Removed the generated emblem from the header. Add your own `site-logo.png` as described in `ADD-YOUR-LOGO.md`.
- Public data loading now runs only loaders relevant to elements on the current page; optional DOM elements are guarded and individual loader failures no longer abort all other page data.
- Added a notice when opened through `file://` and instructions for running a local web server in `OPEN-LOCAL-WITH-DATA.md`.

No live site or database was changed. Supabase data still requires a working connection, valid policies and a browser-served preview; the local server does not guarantee database authorization.
