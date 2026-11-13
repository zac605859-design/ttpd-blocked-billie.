# Stage 21 changes

- Repaired page-specific JavaScript initialization. Admin-only event listeners now use optional DOM checks, and `requireAdmin()` exits on pages without the admin dashboard.
- Public data loaders are selected by the DOM on the current page and isolated with `Promise.allSettled`, so one failed section does not prevent the other sections from loading.
- Members/Admins directory loading now only queries the directory displayed on that page. Count RPC and count elements are optional.
- Voting and announcements loaders tolerate absent page elements.
- Added six consistent inline SVG icons with reference-sized proportions.
- Restored a proper outlined bell and the pinned-news floating ticker.
- Enlarged the logo area, accepts either site-logo.png or site-logo.jpg, and reduced GROUPCHAT heading size.
- Homepage card layout explicitly places Gallery across two rows on desktop and mobile.
- No live website or database changed.
