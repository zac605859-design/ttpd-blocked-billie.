# TTPD BLOCKED BILLIE — Community Hub

A static community website with four public areas:

1. **Voting** — multiple award categories on one page; one ballot per browser ID.
2. **Results / previous winners** — only award editions marked as published are public.
3. **Member directory** — profiles are created and maintained by admins only.
4. **Website newsletter** — an announcement archive on the website; no email collection or email delivery.

The admin dashboard also lets admins add categories, nominees, members and announcements, and open/close voting.

## Free setup

- **Supabase Free**: database, authentication and row-level security.
- **Cloudflare Pages Free** (or GitHub Pages): static website hosting.
- No custom backend server and no paid newsletter service are required for the website-announcement version.

Free-plan limits and terms can change; check the providers' current plan pages before launch.

## 1. Create Supabase project

1. Create a project at https://supabase.com.
2. Open **SQL Editor**, create a query, paste all of `supabase/schema.sql`, and run it.
3. Go to **Project Settings → API**. Copy the Project URL and anon/public key.
4. Open `app.js` and replace:
   - `YOUR_SUPABASE_PROJECT_URL`
   - `YOUR_SUPABASE_ANON_KEY`
5. Never put a `service_role` key in browser code.

## 2. Create the admin account

1. In Supabase, open **Authentication → Users** and create an admin user (or sign up through an enabled auth method).
2. Set that user's `app_metadata` role to `admin` using the Supabase dashboard or a trusted server-side admin tool. The role must be in **app_metadata**, not user-editable `user_metadata`.
3. Sign in through the Admin section of the website.

The browser client cannot grant itself admin access. Do not expose the Supabase service-role key to the website.

## 3. Add the site content

1. Sign in to Admin.
2. Add categories, then add nominees to each category.
3. Add member profiles. Profiles are admin-managed; there is no public profile registration.
4. Publish announcements. They appear in the website newsletter section.
5. Turn voting on when the ballot is ready; turn it off when voting ends.

## 4. Publish previous winners

The admin dashboard creates a draft edition. To attach winners, use Supabase **SQL Editor** while signed in as the project owner. Replace the sample values with the edition UUID and winners:

```sql
-- Find the draft edition ID:
select id, title, year from public.award_editions order by created_at desc;

-- Add winners (replace the edition UUID and sample names):
insert into public.winner_entries (edition_id, category_name, nominee_name)
values
('PASTE-EDITION-UUID-HERE', 'Best Admin', '@winner'),
('PASTE-EDITION-UUID-HERE', 'Best New Member', '@winner');

-- Publish only after checking all winner entries:
update public.award_editions
set published = true
where id = 'PASTE-EDITION-UUID-HERE';
```

To correct a published edition, update its winner entries in SQL and keep `published=true`. Unpublish it first if you want to hide it while editing.

## 5. Deploy for free

### Cloudflare Pages (simple option)
1. Put the files in a GitHub repository.
2. In Cloudflare, create a Pages project and connect the repository.
3. Framework preset: **None**. Build command: leave blank. Output directory: `/` (repository root).
4. Deploy. Your site will receive a `*.pages.dev` address.

You can also use GitHub Pages for this static site.

## Security and limitations — read before launch

- **One ballot per browser is not strong identity verification.** The browser ID is stored in local storage. Clearing site data, using private browsing, or using another device can create another ID. This starter is suitable for informal community voting, not high-stakes or fraud-resistant elections.
- Results are not shown as live vote counts. Ballots and votes are private under row-level security; only admins can query them. Public visitors see only editions and winners explicitly published by an admin.
- Member profiles are admin-only. Do not publish private contact details, real names or information members have not consented to share.
- Website newsletter means an on-site announcements feed. It does not send email. Email subscriptions and automated email delivery are deliberately excluded to keep this version free and avoid collecting email addresses.
- Use HTTPS hosting. Keep admin credentials private. Never publish the Supabase service-role key.
- The Supabase `anon` key is designed to be public in a browser app; row-level security is what protects the database.

## Files

- `index.html` — page structure and sections
- `styles.css` — visual design and responsive layout
- `app.js` — Supabase connection, public loading, voting and admin actions
- `supabase/schema.sql` — tables, policies and ballot submission function
