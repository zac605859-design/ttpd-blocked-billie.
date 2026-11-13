# Stage 17 — Staging QA plan

## Purpose
This package prepares a controlled test of the website before any production deployment. It does not connect to, modify, or inspect the live Supabase project.

## Safety rules
1. Do not run `schema.sql` against the existing production project.
2. Do not test destructive admin actions on production.
3. Use a separate Supabase staging project and a separate deployment/preview URL.
4. Create a verified database backup before any production schema or data change.
5. Use a test admin account and test member accounts. Do not share passwords or service-role keys.
6. The browser may contain cached state. Test in a private/incognito window as well as a normal session.

## A. Static preflight
- [ ] Extract the ZIP into a new folder.
- [ ] Open `index.html` locally or deploy the folder to a private preview.
- [ ] Confirm all page links open: Voting, Winners, Events, Gallery, Members, Admins, News, About Us, Admin Page.
- [ ] Open browser Developer Tools → Console.
- [ ] Record any JavaScript errors, failed asset requests, or CSP/network errors.
- [ ] Confirm the homepage is `index.html`, not `homepage-preview.html`.

## B. Public page checks
| Page | Test | Expected result |
|---|---|---|
| Home | Load page with database reachable | Homepage content renders; no console exception |
| Home | News bell | News & Updates panel opens and closes |
| Home | Event countdown | Correct event/date; no countdown if no event is configured |
| Voting | Voting closed | Closed status shown; ballot cannot be submitted |
| Voting | Voting open | Active categories and nominees render |
| Voting | Submit valid ballot | One success response; no duplicate success |
| Voting | Submit incomplete ballot | Validation prevents submission |
| Winners | No published editions | Empty-state message, no error |
| Winners | Published editions exist | Season selector changes displayed winners |
| Events | No published events | Empty-state message |
| Events | Multiple events | Expand one event; verify only one is open if that is the intended interaction |
| Gallery | No albums | Empty-state message |
| Gallery | Album with photos | Album opens, images/captions render, back button works |
| Members | More than five visible profiles | First five render; Show More reveals remaining profiles |
| Admins | More than five visible profiles | First five render; Show More reveals remaining profiles |
| News | Published announcements | Newest first; pinned items/ticker behave correctly |
| About | Navigation links | Each link opens the expected page |

## C. Authentication and authorization checks
Use a separate staging project and test accounts.

- [ ] Signed-out visitor cannot see or invoke admin mutations.
- [ ] Ordinary authenticated member cannot read or mutate admin-only data.
- [ ] Admin can access the dashboard after signing in.
- [ ] Sign-out removes admin access immediately.
- [ ] Refreshing the admin page while signed out does not reveal protected data.
- [ ] Direct Supabase requests from a non-admin account are rejected by RLS for admin-only tables/actions.
- [ ] `is_site_admin()` evaluates the intended JWT `app_metadata.role` claim.
- [ ] No service-role key is present in HTML, JavaScript, or other public assets.

**Important:** Hiding admin UI in JavaScript is not authorization. RLS and server-side/database checks must enforce access.

## D. Admin workflow checks
Only use staging test records.

- [ ] Create/edit/deactivate a category.
- [ ] Add/edit/remove nominees.
- [ ] Open and close voting.
- [ ] Create/edit/hide a member profile.
- [ ] Create/edit/hide an admin directory profile.
- [ ] Create/edit/publish/pin/unpin an announcement.
- [ ] Create/edit/publish an event and event winner.
- [ ] Create/publish an award edition and winner entries.
- [ ] Create a gallery album and add/remove image URLs.
- [ ] Set and verify homepage countdown.
- [ ] Confirm created timestamps are not unexpectedly overwritten by edits.

## E. Voting integrity checks
- [ ] Confirm the database/RPC rejects a second ballot from the same authenticated voter under the intended policy.
- [ ] Confirm a closed vote is rejected by the database/RPC, not merely hidden by the page.
- [ ] Confirm invalid nominee/category combinations are rejected.
- [ ] Confirm users cannot change another user's ballot.
- [ ] Confirm pending results are not publicly readable before publication.

A browser ID stored in local storage is not strong identity or duplicate-vote protection by itself.

## F. Record results
Use `TEST-RESULTS-TEMPLATE.md`. For every failure, record the page, exact steps, expected result, actual result, browser console error, and whether it reproduces in a private window.

## Exit criteria
Do not call the site production-ready until:
- All critical public flows pass.
- Admin access is enforced by Supabase RLS/database policies.
- Voting integrity is enforced by the database/RPC.
- No secrets are exposed in public assets.
- A recoverable database backup exists.
- Any failed test has been fixed and rerun.
