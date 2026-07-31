# Project History

## July 31, 2026 — Debug Cleanup, Dependency Pruning, README Rewrite

### Debug Instrumentation Removed (`NotificationContext.jsx`)
- Removed all debug `console.group`, `console.log`, and `console.groupEnd` calls that were left in from a previous debugging session (flagged with `// DEBUG INSTRUMENTATION — remove after investigation` comment at L58).
- Removed the debug-only `pollTickRef = useRef(0)` which existed solely to number log groups.
- The logs were printing on every 60 s poll tick and every tab-focus event, including the full API response object (`res.data`) containing company names and drive change data.
- Kept the one genuine `console.error` on fetch failure; rewrote its message since `tickNum` no longer exists.

### Unused Dependencies Removed (`client/package.json`)
- **`sharp`** (`^0.35.3`): Confirmed zero imports anywhere in `client/src/`. Was used once to generate favicon variants (`logo192.png`, `logo512.png`) which already exist in `client/public/`. Removed as dead weight.
- **`playwright`** (`^1.61.1`): Confirmed no test files, no Playwright config, no scripts referencing it anywhere in the repo. All ad-hoc Playwright test scripts from previous audit sessions were already deleted. Removed.
- Ran `npm install` after removal: 9 packages removed, lockfile updated, dev server verified clean.

### README Rewrite (`README.md`)
- Replaced the old README entirely with a verified, audited version.
- Tech stack table now has real version numbers pulled from both `package.json` files; `react-hot-toast` added (was missing); `Node.js` and `Express` split into separate rows (previously conflated with Express's version shown as the Node version).
- Node.js version note: "no version pinned in repo" — consistent between the stack table and the Local Setup section.
- Features section updated to include: selection process steps (`selectionRounds`), Apply Now link (`formUrl`), and the notification polling endpoint (`GET /api/placements/changes`) explicitly called out.
- Project structure tree corrected: `hooks/`, `context/NotificationContext`, and `components/Notifications/` were all missing from the old tree and are now included.
- Env var tables verified against actual `process.env.*` grep of the codebase — all 8 server vars and 1 client var confirmed accurate.
- `resetAdmin.js` reference confirmed real (file exists at `server/scripts/resetAdmin.js`).
- Modified the logo reference in `README.md` to point to `client/public/logo512.png` since `client/public/logo.png` was deleted.

## July 27, 2026 — Project Audit: Checkpoint 2 (Frontend) Finalized

### Dependency Upgrades
- **React Router**: Upgraded `react-router` to v7 (7.18.1). Migrated all `react-router-dom` imports to `react-router` across the client codebase for consistency, as `react-router-dom` is a deprecated re-export in v7. Verified 0 vulnerabilities via `npm audit`.

### Frontend Component Audit (3-Loop Pass: Bugs, Redundancy, Consistency)
- **`Navbar.jsx` & `Footer.jsx`**: Audited and confirmed bug-free auth-aware link toggling (`isAdmin ? '/admin/dashboard' : '/admin/login'`), removed unused imports, and confirmed MD3 design consistency. Mobile hamburger menu perfectly mirrors desktop navigation. Footer logo dimensions correctly applied.
- **`AdminDashboard.jsx`**: Validated table row action payloads (`PATCH /postpone`, `PUT` status changes) dynamically. Confirmed UI strictly relies on server response (`res.data.data`) to update, preventing optimistic rendering bugs.
- **`PlacementForm.jsx`**: Validated `statusManuallySet` logic. Changing the status dropdown explicitly appends `statusManuallySet: true` to the payload, whereas leaving it unchanged correctly omits the flag to allow Mongoose `$set` preservation. Confirmed Selection Rounds addition/removal triggers no overflow issues within the Modal.
- **`NotificationContext.jsx`**: Verified existence and styling of the `react-hot-toast` integration specifically targeting `postponed` drive alerts (red accent `#ef4444`).

### Dynamic Testing & Cleanup
- Written and executed custom, real headless Playwright scripts (`test_frontend.cjs`, etc.) to intercept and verify network requests dispatched by the frontend without relying on backend database state.
- Purged all scratch testing scripts and verified pristine Git history cleanly untouched by test files or secrets.

## July 26, 2026 â€” UI Fix: Notification Panel Controls

- **Notification Panel Header**: Added a visible close ("X") button next to the "Clear all" action to explicitly close the panel without clearing notifications.
- **Dismiss Button Shape**: Fixed the individual notification dismiss button to render as a perfect circle regardless of content by replacing padding-based sizing with explicit width/height and flexbox centering.

---
## July 26, 2026 â€” Notification System for Placement Drives

### Backend Updates
- Added a capped `recentChanges` array to the `Placement` schema to log `new`, `edit`, `postponed`, `unpostponed`, and `statusChange` mutations for notifications.
- Added `GET /api/placements/changes?since=<timestamp>` endpoint to retrieve all recent changes.
- Updated `POST /`, `PUT /:id`, `PATCH /:id/postpone`, `PATCH /:id/reset-status-automation`, and the background cron job to actively push their changes to the array.

### Frontend Updates
- Added `react-hot-toast` for global application toast alerts.
- Created `NotificationContext` that polls the backend every 60 seconds using the `lastPollTime` boundary, persisting unseen changes to `localStorage` across reloads to ensure no missed updates.
- Built a `NotificationBell` navbar component that displays an unread count badge. Contains a dropdown menu tracking the recent 15 updates, marking them as read upon open and allowing dismissal individually or all at once.
- Postponed alerts are uniquely elevated by triggering a prominent red toast from `react-hot-toast` directly onto the screen.

---

## July 26, 2026 â€” Automate Placement Status Transitions

### Automation & Background Jobs
- **Backend:** Added `statusManuallySet` (Boolean, default `false`) to the `Placement` schema to control whether the automation script is allowed to alter the placement status.
- **Backend:** Installed `node-cron` and created `server/jobs/statusCron.js`, which runs daily at 00:05 IST to auto-transition statuses (`Upcoming` â†’ `Ongoing` via `deadline`/`driveDate`, and `Ongoing` â†’ `Completed` via `driveDate`). 
- **Backend:** Built timezone-aware logic (`Asia/Kolkata`) that executes strictly via UTC midnight cutoff comparisons directly matching `<input type="date">` MongoDB serialization to prevent drift.

### Manual Overrides & UI
- **Backend:** Exposed a new lightweight toggle route `PATCH /api/placements/:id/reset-status-automation` backed by custom validation to let administrators restore automation control on manually overriden items.
- **Frontend (Admin):** Added logic in `PlacementForm.jsx` to dynamically mark `statusManuallySet: true` in the API payload whenever an administrator explicitly alters the status dropdown from its initial value.
- **Frontend (Admin):** Upgraded `AdminDashboard.jsx`'s table column to conditionally display a "Reset Auto Status" button below the postpone controls when a placement's status has been manually set. Features spinner integration and asynchronous state handling mirroring existing hooks.

---

## July 26, 2026 â€” Feature: "Postponed" Status Override

### Added `isPostponed` Display Override
- **Backend:** Added `isPostponed` (Boolean, default `false`) to the `Placement` schema.
- **Backend:** Added a dedicated `PATCH /api/placements/:id/postpone` endpoint for lightweight toggling, backed by a minimal `postponeValidationRules` array (auth and CSRF protected).
- **Frontend (Admin):** Added a "Mark as Postponed" checkbox in `PlacementForm.jsx` (saved via the standard full form PUT).
- **Frontend (Admin):** Added a dedicated "POSTPONE" column in the `AdminDashboard.jsx` table (visible on medium+ screens) featuring a quick-toggle button that instantly flags/unflags drives without full form edits. Includes a loading spinner and handles error display.
- **Frontend (Admin/UI):** Fixed double scrollbar and clipping issues in `Modal.jsx` (used for Add/Edit Placement) by shifting from a global scrolling container with a sticky header to a `flex-col` layout with a fixed header and a dedicated `flex-1 overflow-y-auto` scrolling body.
- **Frontend (Display):** Updated `StatusBadge.jsx` to intercept the `isPostponed` prop. When true, it completely replaces the regular status visual with a new red `POSTPONED` badge (`bg-red-100 text-red-700`).
- **Frontend (Integration):** Passed the `isPostponed` field to `StatusBadge` on all public surfaces (`Home.jsx` via `PlacementCard.jsx`, `PlacementDetail.jsx`, `Timeline.jsx`) and inside the Admin Dashboard table. 
- **Frontend (Styling):** Updated `PlacementCard.jsx` to style the "View Details" button with a red accent (`text-red-700 border-red-200 bg-red-50`) when `isPostponed` is true, matching the urgency of the badge. Preserved all original button display logic for non-postponed cards, as well as the priority of the "Apply Now" button if a `formUrl` is present.

---

## July 25, 2026 â€” Selection Process Step Indicator Color Fix

### Bug Fix: Consistent Step Circle Colors (`PlacementDetail.jsx`)
- Removed the `index === 0` conditional that gave the first selection round circle a different color (`bg-primary-container`) than all subsequent ones (`bg-surface-container-high`).
- All step indicator circles now uniformly use `bg-primary-container text-on-primary-container` (the site's primary accent blue) regardless of position.
- Connecting line (`bg-surface-variant`), round name, and description text styling are unchanged.

### UI: Timestamp Relocated into Company Info Card (`PlacementDetail.jsx`)
- The "Added [date] Â· Updated [date]" line was previously a standalone element at the very bottom of the page grid (full-width, right-aligned).
- Moved it inside the Company Info Card, below the Apply Now button, as a quiet footnote.
- Uses the same `border-t border-surface-variant mt-xs pt-xs` divider pattern already used above the Apply Now button in the same card.
- Styled with `text-outline` (muted, non-competing) and `font-label-sm` â€” matching the rest of the card's secondary text scale.
- Removed the standalone bottom-of-page timestamp block entirely; timestamp now appears in exactly one place.

---

## July 24, 2026 â€” Phase 6: Security Hardening Pass

### Schema Bounds Tightened (Task 3)
- `jdDescription` maxlength reduced from 50000 â†’ 10000 in both Mongoose schema and express-validator.
- `formUrl` now enforces HTTPS-only via `new URL()` protocol check in schema and `isURL({ protocols: ['https'], require_protocol: true })` in validator. Maxlength 500 added.

### API Rate Limiting (Task 5)
- Added `apiLimiter` (100 req/15min/IP) to both `GET /api/placements` and `GET /api/placements/:id` to prevent scraping/abuse.

### XSS Sanitizer Fix (Task 10)
- Removed fragile regex-based `stripRawHtml` function from `PlacementDetail.jsx`. `react-markdown` without `rehype-raw` already safely ignores raw HTML â€” the regex was cosmetic and bypassable.

### Dependency Audit (Task 11)
- `npm audit` returned 0 vulnerabilities in both `client/` and `server/`.

### Verified (No Changes Needed)
- CSRF: `csrfCheck` middleware confirmed on all mutating routes.
- Regex escaping: `escapeRegex` covers all 12 special chars.
- JWT/Cookies: `SameSite=None` in prod, `Lax` in dev, `httpOnly` always, 3h expiry, generic login errors.
- Query param validation: already enforced in `placements.js`.
- Helmet/CORS: already correctly configured.
- Error handler: never leaks stack traces.
- Access control: `auth` middleware on all mutating routes.

## July 23, 2026 â€” Full Functional QA Pass Across Entire Site

- Conducted a comprehensive code-level QA pass across all main site workflows (Navigation, Home page, Placement Detail page, Timeline page, Admin Login, Admin Dashboard).
- Verified filter debouncing, form state logic, empty state handling, pagination, dynamic route rendering, markdown parsing, and admin interactions.
- **Bug Fix**: Fixed the "Back to Drives" link in `PlacementDetail.jsx`. It was incorrectly using `navigate(-1)` (which would return the user to their previous history state, which could be the Timeline or an external site). Updated to `navigate('/')` to explicitly route back to the Home page as per the requirements.
- **Bug Fix**: Fixed a bug in `PlacementForm.jsx` where clearing an optional field (like `formUrl`, `driveDate`, or `cgpa`) and saving would not actually remove the data from the database. The form was sending `undefined` for empty fields, which gets stripped out during JSON serialization, causing Mongoose's `$set` logic to ignore the field. Updated to explicitly send `""` (for strings) or `null` (for dates/numbers) so the database properly unsets them.

## July 23, 2026 â€” Fix Broken Markdown Rendering on Job Description

### Root Cause Analysis
Three compounding bugs were causing the Job Description section to render as unstyled, raw text:
1. **Wrong CSS class**: The container used `prose prose-sm max-w-none` (Tailwind Typography plugin classes), but `@tailwindcss/typography` was **not installed** (`plugins: []` in `tailwind.config.js`). The correct typography styles were already fully written in `index.css` under `.markdown-body`, but pointed at the wrong class name.
2. **Raw HTML showing as visible text**: `react-markdown` v9 does not render raw HTML by default (no `rehype-raw` plugin). Tags like `<div align="center">` were being passed through as text nodes and rendered verbatim. Required a pre-processing step to strip them.
3. **`remark-gfm` was already wired correctly** â€” the import and plugin array were correct; this was not the issue.

### Changes â€” `PlacementDetail.jsx`
- Added `stripRawHtml()` helper function (top-level, outside the component) that uses a regex to remove all raw HTML tags from the markdown source string before passing it to `ReactMarkdown`. This ensures tags like `<div align="center">` are silently dropped rather than displayed as visible characters.
- Changed the markdown container class from `prose prose-sm max-w-none font-body-md text-body-md text-on-surface-variant` â†’ `markdown-body`. This wires up the complete typography stylesheet already defined in `index.css` covering: headings (h1â€“h4 with size hierarchy), paragraphs, unordered/ordered lists with indentation and markers, tables with borders and header row, bold/strong, links (primary color, new tab target), blockquotes, inline code, code blocks, images, and horizontal rules.
- No new packages were installed â€” `remark-gfm` (already a dependency) provides GFM table, strikethrough, and task list support.

### Verified element types
- **Headings**: h1 (2xl bold), h2 (xl bold), h3 (lg semibold), h4 (label-md) â€” clear size hierarchy
- **Tables**: bordered via `border-collapse`, header row has `bg-surface-container-low` + `font-semibold`, rows separated by `border-b border-surface-variant`
- **Bullet lists**: `list-disc list-outside ml-5 space-y-1.5`
- **Bold**: `font-bold text-on-surface`
- **Links**: `text-primary hover:underline`, open in new tab via `target="_blank"`
- **Raw HTML stripping**: `<div align="center">`, `</div>` and similar tags are removed before parsing
- **Paragraphs**: `mb-4` spacing, `text-on-surface-variant` color

---

## July 23, 2026 â€” Compact Placement Detail Layout (Eliminate Scroll on Short Entries)


- **`PlacementDetail.jsx`**: Surgical compaction to ensure short entries require zero scrolling, without sacrificing readability of primary content.
  - **Page wrapper**: `py-lg` (40px Ã— 2) â†’ `py-sm` (16px Ã— 2). Saves 48px of vertical whitespace.
  - **Outer grid gap**: `gap-md md:gap-lg` â†’ `gap-xs md:gap-sm`. Tighter row gap between breadcrumb and columns, and column gap between left/right.
  - **Column card gap**: `gap-md` â†’ `gap-xs` in both left and right columns. Cards sit closer together.
  - **Card internal padding**: All cards changed from `p-md` (24px) to `p-sm` (16px). Consistent inset reduction across Company Info, Important Dates, and Eligibility cards.
  - **Eligibility sub-cards**: Internal padding from `p-sm` (16px) â†’ `p-xs` (8px); label margin from `mb-base` â†’ `mb-[3px]`.
  - **Row padding in Important Dates**: `py-xs` (8px) â†’ `py-[6px]` for a tighter date row height.
  - **Section header margin**: `mb-sm` â†’ `mb-xs` throughout all section headings.
  - **Secondary labels** (`ACADEMIC REQUIREMENT`, `ELIGIBLE BRANCHES`, `IMPORTANT DATES`): downgraded from `font-label-md text-label-md` (14px) to `font-label-sm text-label-sm` (12px). Primary content values unchanged.
  - **Timestamps line**: downgraded from `font-body-sm text-body-sm` (14px) to `font-label-sm text-label-sm` (12px) with `font-normal tracking-normal` override to maintain readability.
  - **Logo icon**: 48Ã—48 â†’ 40Ã—40, icon size 28px â†’ 24px.
  - **Primary content unchanged**: company name (`display-lg`), role (`headline-sm`), CTC (`headline-md`), eligibility values (`body-md`), section headings (`headline-sm`).
  - Long entries with Job Descriptions / Selection Process steps still scroll normally â€” `<main>` scroll container in `App.jsx` is untouched.

---

## July 23, 2026 â€” Eliminate Native Window Scrollbar
- **`index.css`**: Added `html { height: 100%; overflow: hidden; }` and `overflow: hidden` to `body`. The React root `<div>` already had `h-screen overflow-hidden`, but `<html>` and `<body>` were unconstrained, allowing the browser to still render a native window-level scrollbar. Locking both to `h-full overflow-hidden` ensures the ONLY scrollable element is `<main id="main-content">` with its custom thin styled scrollbar.

## July 23, 2026 â€” Font Loading & Image Compression (Performance)

### Task 1 â€” Move Google Fonts from CSS @import to HTML link tags
- **`index.html`**: Added `<link rel="preconnect">` hints for `fonts.googleapis.com` and `fonts.gstatic.com` (with `crossorigin`), then declared all three font stylesheets (Inter, Geist, Material Symbols) as `<link rel="stylesheet">` tags directly in `<head>`. This eliminates the cascading delay where the browser had to parse `index.css` before it could even discover the font URLs.
- **`index.css`**: Removed all three `@import url(...)` font declarations â€” fonts are now loaded via HTML, not CSS.
- All font URLs retain `&display=swap` so text renders immediately in a system fallback font and swaps in once the custom font arrives (no invisible text while loading).

### Task 2 â€” Logo Image Compression (Sharp)
Compressed all logo PNG assets using `sharp` (max PNG compression + palette quantization + resize to max display width):

| File | Before | After | Reduction |
|---|---|---|---|
| `src/assets/cdpc-logo.png` | 3,843 KB | 23 KB | **-99%** |
| `src/assets/charusat-logo.png` | 256 KB | 18 KB | **-93%** |
| `src/assets/logo.png` | 80 KB | 24 KB | **-70%** |
| `public/logo.png` | 597 KB | 25 KB | **-96%** |

The CDPC logo was the most egregious â€” a 2752Ã—1536 px source image for a 36px-tall footer logo. Resized to 300px wide (still 8Ã— retina), saving 3.8 MB per page load.

### Note on Render Cold Starts
Backend API cold-start delay (Render free tier sleeping) is a known, separate issue and not addressed here. Asset loading and API latency are independent.

## July 23, 2026 â€” Fixed Navbar/Footer Layout + Custom Scrollbar

### Task 1 â€” Fixed Navbar/Footer with Scrollable Content Area
- **`App.jsx`**: Changed the root wrapper from `flex flex-col min-h-screen` to `h-screen overflow-hidden flex flex-col`. The `<main>` element is now `flex-1 min-h-0 overflow-y-auto content-scrollbar` â€” the only scrollable region on every page. Added `id="main-content"` to `<main>` so pages can programmatically scroll it.
- **`Footer.jsx`**: Removed `mt-auto` (no longer needed since footer is the last flex child of the fixed-height container) and added `flex-shrink-0` to ensure it never collapses.
- **`Home.jsx`**: Updated `handlePageChange` to call `document.getElementById('main-content')?.scrollTo(...)` instead of `window.scrollTo(...)`, since the window is no longer the scroll source.
- **`AdminLogin.jsx`**: Changed the page wrapper from `flex-1 flex items-center` to `min-h-full flex items-center` so the login card remains vertically centered inside the new `overflow-y-auto` main container.

### Task 2 â€” Custom Scrollbar Styling
- **`index.css`**: Added `.content-scrollbar` component class with cross-browser custom scrollbar styling:
  - Firefox: `scrollbar-width: thin` + `scrollbar-color` with muted slate thumb on transparent track.
  - Chromium/WebKit: 6px wide scrollbar, transparent track, rounded-full slate thumb (`rgba(100,116,139,0.35)`), darker on hover (`rgba(100,116,139,0.6)`). Uses `background-clip: content-box` with a 2px transparent border for visual breathing room.

## July 22, 2026 â€” Minor UI Label Update

### Task 1 â€” Rename "View Results" Button Label
- Renamed the "View Results" button label to "View Details" on placement cards with a "Completed" status in `PlacementCard.jsx` to improve clarity.

### Task 2 â€” Fix "Apply Now" Fallback Logic
- Updated `PlacementCard.jsx` to show "Apply Now" (with primary styling) only if `formUrl` exists, regardless of status.
- If `formUrl` is missing, the card now falls back to "View Details" (with secondary styling appropriate for the status) even for "Upcoming" drives.

### Task 3 â€” Placement Detail Layout Fix
- Fixed an issue in `PlacementDetail.jsx` where the footer was pushed off-screen and content failed to center properly.
- Removed `flex-grow` from the page wrapper and nested the grid inside a standard block container. This allows the parent `<main className="flex-1">` in `App.jsx` to correctly handle pushing the footer to the bottom of the viewport for short content, while preventing the grid rows from stretching vertically.

### Task 4 â€” Placement Detail Scrollbar Fix
- Added `items-start` to the main grid container (`grid-cols-1 md:grid-cols-12`) in `PlacementDetail.jsx` to override the default CSS Grid behavior (`align-items: stretch`). 
- This prevents the right column (Eligibility Criteria, etc.) from artificially stretching to match the height of the left column (Company Info) when its actual content is short.
- Confirmed there are no stray `min-h-screen` or fixed heights applied to the main content area or its columns.

## July 22, 2026 â€” Design Polish Batch 1: Accessibility & Quick Fixes

### Task 1 â€” Navbar Logo Alignment (`Navbar.jsx`)
- Removed `max-w-container-max mx-auto` from the Navbar's inner container. The header now spans the full width of the screen, ensuring the logo sits flush against the extreme left edge of the viewport (while still respecting the standard `px-sm md:px-lg` padding), rather than being artificially centered on wide displays.

### Task 2 â€” Footer Logo Sizing (`Footer.jsx`)
- Restructured the footer logo display by giving both the CHARUSAT and CDPC logos consistent fixed-width container slots (`w-32`).
- Adjusted heights independently: scaled CHARUSAT down to `h-6` (as its wordmark is horizontally long) and scaled CDPC up to `h-9` (as it is more square).
- Added a subtle vertical divider (`h-6 w-px bg-outline-variant mx-md`) between the two logos so they are visually anchored and read as peers.

### Task 4 â€” Home page vertical rhythm adjustments (`Home.jsx`)
- Reduced the top padding of the main container from `md:py-xl` to `md:pt-lg md:pb-xl` to tighten the gap between the Navbar and the "Active Drives" heading.
- Adjusted vertical spacing between stacked elements for a consistent rhythm:
  - Heading â†’ Subtitle: `mb-sm` (16px) â†’ `mb-xs` (8px) for tighter grouping.
  - Subtitle â†’ FilterBar: `mb-lg` (40px) â†’ `mb-md` (24px) to match other gaps.
  - Results Summary text: `mb-sm` (16px) â†’ `mb-md` (24px).
  - Empty State card: `py-xl` (64px) â†’ `py-lg` (40px) to prevent it from feeling disproportionately large.
- Overall vertical flow is now tightly coupled for related elements (8px) and evenly spaced for distinct sections (24px/40px).

### Task 5 â€” Focus-visible states on nav links (`Navbar.jsx`)
- Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm` to all desktop nav `<Link>` elements (Home, Timeline, Login/Dashboard)
- Added same ring with `ring-offset-1` to all mobile menu `<Link>` elements
- Keyboard users tabbing through the Navbar now see a clear blue focus ring on every link

### Task 2 â€” Secondary text contrast fix (all files)
- Replaced `text-secondary` (#505f76) with `text-on-surface-variant` (#434655) on all footnote, subtitle, role, and supporting body text throughout the app
- Files changed: `Navbar.jsx`, `Footer.jsx`, `Home.jsx`, `Timeline.jsx`, `PlacementDetail.jsx`, `PlacementCard.jsx`, `AdminLogin.jsx`, `AdminDashboard.jsx`, `ColdStartLoader.jsx`, `ConfirmDialog.jsx`
- Did **not** change primary headings, interactive element text colors, or decorative icon colors (`material-symbols-outlined text-secondary` icon tints were left intentionally)

### Task 3 â€” Navbar logo/text weight balance (`Navbar.jsx`)
- Changed site name `font-bold` (700) to `font-semibold` (600) to match the `font-headline-md` token weight declaration, balancing visual weight against the logo icon

### Task 4 â€” CTC/Apply button divider on Placement Detail (`PlacementDetail.jsx`)
- Wrapped the `Apply Now` `<a>` button in a `<div className="border-t border-surface-variant mt-sm pt-sm">` container
- Divider is conditional (only renders when `placement.formUrl` exists) â€” no orphan border when Apply Now is absent

### Task 5 â€” Status badge contrast: Upcoming (`StatusBadge.jsx`)
- Replaced `bg-primary/10 text-primary` (very faint blue, ~1.1:1 tint) with `bg-primary-fixed text-on-primary-fixed` (#dbe1ff / #00174b) for a clearly legible badge
- Applied consistently across all components that use `<StatusBadge>`: `PlacementCard`, `Timeline`, `PlacementDetail`, `AdminDashboard`

### Task 6 â€” Back navigation on Placement Detail (`PlacementDetail.jsx`)
- Added a "â†� Back to Drives" button at the top-left of the page content using `navigate(-1)` (browser history back)
- Styled with `text-on-surface-variant hover:text-primary` and a focus-visible ring, matching the rest of the page's styling
- Uses `arrow_back` Material Symbol icon for clear affordance

### Task 7 â€” Footer mobile spacing (`Footer.jsx`)
- Added `mt-xs md:mt-0` to the logo container `<div>`, adding 8px top margin when stacked on mobile
- On `md+` (side-by-side flex row), `md:mt-0` resets the margin so the existing `gap-sm` spacing handles the layout

---

## July 22, 2026 â€” Navbar Login Link Cleanup

- Removed the blue "Login"/"Dashboard" button from the right side of the Navbar entirely
- Restored the auth-aware admin link back into the desktop nav link group: shows **"Login"** (â†’ `/admin/login`) when logged out, **"Dashboard"** (â†’ `/admin/dashboard`) when admin is authenticated
- Renamed label from "Admin Login" to just **"Login"** for brevity
- Fixed nav centering: restructured the header from a 2-zone `justify-between` layout to a **3-zone flex layout** â€” left zone (`flex-1`, logo), center zone (nav links, auto-width), right zone (`flex-1 justify-end`, hamburger) â€” so the nav links are always geometrically centered in the header regardless of viewport width
- Mobile hamburger menu mirrors desktop exactly: Home â†’ Timeline â†’ Login/Dashboard, no separate button element
- Extracted `adminTo` / `adminLabel` variables to eliminate duplicate conditional logic

---

## July 22, 2026 â€” Logo Integration, Footer/Header Consistency, Scrollbar Fixes, Navbar Cleanup & Design Audit

### Task 1 â€” Main site logo
- Cropped `logo/screen.png` programmatically (Python/Pillow) to extract just the blue icon mark with transparent background padding removed
- Saved as `client/src/assets/logo.png`
- Replaced the `material-symbols-outlined` briefcase/work icon in `Navbar.jsx` with `<img src={logo} className="h-9 w-auto object-contain" />` â€” renders sharply at navbar icon size, background-agnostic (no fragile color dependency)

### Task 2 â€” CHARUSAT and CDPC footer logos
- Copied `logo/charusat logo.png` to `client/src/assets/charusat-logo.png` (wide/landscape, already clean)
- Cropped the orange decorative border from `logo/cdpc logo.jpg` using row/column edge detection, saved as `client/src/assets/cdpc-logo.png` (square, border-free)
- Replaced both dashed-border text placeholders in `Footer.jsx` with actual `<img>` tags
- Both logos sized to `h-10` (40px height) with `w-auto object-contain` so they sit as visual peers regardless of aspect ratio
- Reduced footer horizontal gap between logos from `gap-md` to `gap-sm` for tighter visual composition

### Task 3 â€” Header and footer sizing consistency
- Reduced `Footer.jsx` vertical padding from `py-lg` (40px each side = 80px total) to `py-sm` (16px each side = 32px total + ~20px content â‰ˆ ~52px total height), much closer to the navbar's 64px
- Footer now feels proportionally balanced with the header across all pages

### Task 4 â€” Removed duplicate Admin Login entry in Navbar
- Removed the `{isAdmin ? <Dashboard link> : <Admin Login link>}` block from the desktop nav link group
- Nav link group now only contains: Home, Timeline (+ Dashboard when admin is logged in)
- Kept the right-side blue Login/Dashboard button as the sole entry point â€” no changes to its auth-state toggle logic
- Updated mobile hamburger menu to mirror desktop exactly: Home, Timeline, then Login/Dashboard as a styled link (no separate "Admin Login" entry)

### Task 5 â€” Removed scrollbar on Admin Login page
- Changed `AdminLogin.jsx` root wrapper from `min-h-[80vh]` to `flex-1 flex items-center justify-center py-lg px-sm`
- Changed `App.jsx` `<main>` from `flex-1` to `flex-1 flex flex-col` so pages can correctly use `flex-1` to fill available viewport space without overflowing

### Task 6 â€” Scrollbar behavior on Placement Detail page
- Confirmed no artificial scroll issue â€” the `flex-grow` on PlacementDetail's root correctly fills the flex column without setting a fixed height
- The `flex flex-col` change to `<main>` in App.jsx makes flex-grow work correctly: page scrolls only when actual content overflows

### Task 7 â€” Design consistency audit & fixes
- **PlacementDetail.jsx**: Fixed outer padding from `px-md` â†’ `px-sm md:px-lg` (matching Home, Timeline, AdminDashboard); `Apply Now` button changed from raw inline Tailwind to `btn-primary` class
- **AdminLogin.jsx**: Changed restricted-area footnote from `text-outline` â†’ `text-secondary` (correct token for supporting body text)
- **Timeline.jsx**: Added `w-full` to both the loading-state wrapper and main page wrapper (matching other pages)
- **PlacementCard.jsx**: Replaced raw inline Tailwind button class strings with `btn-primary` (Upcoming) and `btn-secondary` (Ongoing/Completed) for full button consistency; removed redundant `+ ' text-center'` concatenation

## July 22, 2026 â€” Full App-Wide Visual Redesign (Material Design 3)

### Design System (`tailwind.config.js`)
- Added ~40 MD3 color tokens as the default theme (`primary`, `on-surface`, `surface-container-lowest`, `outline-variant`, etc.)
- Added custom typography system: Geist (headings/labels) and Inter (body text) with 9 named text styles (`display-lg`, `headline-md`, `body-sm`, `label-md`, etc.)
- Added custom spacing tokens (`base`=4px, `xs`=8px, `sm`=16px, `md`=24px, `lg`=40px, `xl`=64px, `container-max`=1280px)
- Added custom border-radius tokens matching the MD3 spec
- Preserved existing `brand` color scale for backward compatibility

### Global Styles (`index.css`)
- Added Google Font imports for Geist and Material Symbols Outlined icon font
- Rewrote all component classes (`btn-primary`, `btn-secondary`, `input-field`, `select-field`, `card`, `markdown-body`) to use MD3 tokens
- Updated base body styles to use `bg-background text-on-background`

### Page Components
- **Home.jsx**: Full JSX replacement â€” MD3 hero section ("Active Drives"), restyled empty/loading states with Material Symbols icons
- **PlacementDetail.jsx**: Full JSX replacement â€” 2-column layout (4/8 grid), company info card, eligibility criteria with `verified_user` icon, markdown JD rendering, selection process timeline, conditional "Apply Now" button
- **Timeline.jsx**: Restyled with MD3 tokens, primary-container month badges, surface-container-lowest cards
- **AdminDashboard.jsx**: Full table/search/action button restyle, Material Symbols icons for edit/delete
- **AdminLogin.jsx**: Consistency pass â€” MD3 card styling, Material Symbols lock icon, error-container alerts

### Shared Components (all restyled app-wide)
- **StatusBadge.jsx**: Pill-shaped badges with `primary/10` (Upcoming), `amber-100` (Ongoing), `emerald-100` (Completed), removed dot indicator
- **PlacementCard.jsx**: MD3 card design â€” logo placeholder, Material Symbols icons (payments, event, engineering, group), status-dependent action buttons
- **FilterBar.jsx**: Kept full functionality (search, status, branch, CTC range, sort), restyled with MD3 tokens and Material Symbols icons
- **Pagination.jsx**: Rounded-lg buttons with Material Symbols chevron icons, primary-container active state
- **ColdStartLoader.jsx**: MD3 spinner colors and typography
- **Navbar.jsx**: Sticky header with surface background, primary active indicators, Material Symbols icons for logo/hamburger
- **Footer.jsx**: surface-container-low background, dashed-border logo placeholders
- **Modal.jsx**, **ConfirmDialog.jsx**, **BranchSelect.jsx**, **TagInput.jsx**, **PlacementForm.jsx**, **ProtectedRoute.jsx**: All updated for MD3 token consistency

## July 21, 2026 - Comprehensive Codebase Audit & Feature Additions

### Feature Additions
- **Google Form URL Integration (`formUrl`)**: Added `formUrl` to the `Placement` MongoDB schema as an optional string. Updated frontend components (`PlacementForm`, `PlacementCard`, `PlacementDetail`) and backend routes to handle and display an external application link ("Apply Now" button) securely.
- **Markdown Job Descriptions**: Replaced plain-text JD rendering in `PlacementDetail` with `react-markdown` and `remark-gfm` to support formatted text (headings, lists, bold/italics) while neutralizing raw HTML input to prevent XSS.

### Bug Fixes
- **Backend Startup Crash**: Fixed a critical validation error causing the Node.js server to crash immediately on startup due to deprecated `express-validator` v7 syntax. Replaced `.optional({ checkFalsy: true })` with `.optional({ values: 'falsy' })`.
- **Destructive Update Logic**: Refactored `server/routes/placements.js` POST and PUT handlers to use `req.body` directly instead of manually destructuring and passing `undefined` fields. This prevents Mongoose from accidentally wiping out optional fields when they are omitted from an update payload.

### Performance & Resilience Improvements
- **Frontend Race Conditions**: Identified missing request cancellation logic in React components fetching data. Added `AbortController` implementation to `Home.jsx`, `AdminDashboard.jsx`, `Timeline.jsx`, and `PlacementDetail.jsx` to prevent memory leaks and state updates on unmounted components.
- **Search Debounce Optimization**: Improved debounced search logic in `Home.jsx` and `AdminDashboard.jsx` to work seamlessly with the newly added AbortControllers.
- **API Performance**: Confirmed paginated reads in `placements.js` use Mongoose `.lean()` to speed up JSON serialization and reduce memory usage.

### Aesthetic & UI Polish
- **Global Visual Hierarchy**: Enhanced buttons, inputs, and cards globally via `index.css`. Added smooth transitions, focus rings, and drop-shadows on hover for a more responsive and premium feel.
- **Markdown Typography**: Overhauled `.markdown-body` styles to improve line-height, heading margins, list indentation, and blockquote styling, ensuring job descriptions are highly readable.
- **Component-Level Polish**: 
  - Integrated "Apply Now" buttons seamlessly into `PlacementCard.jsx` and `PlacementDetail.jsx` with prominent hover effects.
  - Softened empty state visuals in `Home.jsx`.
  - Refined the "Job Description" input in `PlacementForm.jsx` to clearly indicate markdown support via a monospace font.

 
 

## July 27, 2026 — React 18 StrictMode Race Condition Fixes
- **PlacementDetail.jsx, Timeline.jsx, Home.jsx, AdminDashboard.jsx**: Fixed a critical race condition where \setLoading(false)\ was being called unconditionally in a \inally\ block after an aborted fetch. In React 18 StrictMode, this caused the component to crash or briefly display an empty state on the second mount. The fix involved moving the state update out of the \inally\ block and handling it appropriately within the \	ry\ block (on success) and the \catch\ block (on non-canceled errors).

## July 27, 2026 — Security Audit and API Hardening
- **Auth Timing Attack Fix**: Fixed a timing attack vulnerability in \POST /api/auth/login\ by running a dummy \crypt.compare()\ when an unknown username is provided, equalizing response times.
- **Changes Endpoint DoS Fix**: Implemented a strict 7-day maximum lookback window on \GET /api/placements/changes\ to prevent malicious clients from loading the entire database into memory by passing an excessively old \since\ timestamp.
- **Dynamic Verification**: Verified the API timing attack fix, DELETE placement cleanup, and 7-day changes cap via automated dynamic testing scripts against the live environment.

## [2026-07-27] UI Sizing Fix
- Converted all pixel-based spacing and ontSize custom values in 	ailwind.config.js to em to allow them to scale relative to the root font size.
- Set html { font-size: 90%; } in client/src/index.css to globally reduce the UI scale by ~10%, effectively making 100% browser zoom look like the previous 90% zoom, ensuring better proportions for headings, cards, and spacing without hand-adjusting individual components.

## [2026-07-27] Auth API Hardening
- Added csrfCheck middleware to POST /api/auth/logout endpoint to prevent Logout CSRF attacks, ensuring parity with other state-mutating endpoints.

## [2026-07-27] Refactored Placements Fetch Logic & Dead Code Cleanup
- Deleted unused script \server/get_id.js\ 
- Removed redundant export for \unStatusTransitionJob\ from \server/jobs/statusCron.js\`n- Extracted \usePlacementsFetch\ custom hook in client to eliminate duplicate abort controller and cold-start loader logic across Home, Timeline, and AdminDashboard pages.

### Refactored dead code and duplicate logic
- Removed unused useRef and api imports from Timeline.jsx, Home.jsx, AdminDashboard.jsx.
- Deleted unused test-hook.cjs file.
- Refactored server/jobs/statusCron.js to use a shared transitionPlacement helper for Upcoming->Ongoing and Ongoing->Completed transitions.
- Refactored server/routes/placements.js to use a shared updatePlacementWithLog helper for /postpone and /reset-status-automation PATCH endpoints.
- Removed unused default export from client/src/context/AuthContext.jsx.
- Fixed /reset-status-automation to log type=automationReset instead of statusChange.
- Added explicit display label for automationReset notification type in NotificationBell.jsx.

## [2026-07-28] Verifications and Code Audits
- Conducted logic audits for the cron automated state machine to verify status transitions and idempotency for past-due placements.
- Dynamically verified XSS markdown sanitization (`rehype-sanitize`) against real payloads using headless Chromium on the live DOM.
- Removed all temporary test scripts utilized during verification tasks.
 
 # #   2 0 2 6 - 0 7 - 2 9 :   L o g o   &   B r a n d i n g   U p d a t e  
 -   E x t r a c t e d   a n d   u p d a t e d   t h e   p r i m a r y   l o g o   i m a g e   f r o m   u s e r - p r o v i d e d   s u i t e   ( s r c / a s s e t s / l o g o . p n g ) .  
 -   E x t r a c t e d   a n d   g e n e r a t e d   a   c o m p l e t e   s e t   o f   f a v i c o n s   f r o m   t h e   r o u n d e d   s q u a r e   a p p - i c o n   v a r i a n t   ( i n c l u d i n g    a v i c o n . i c o ,   P N G   v a r i a n t s ,   a n d    p p l e - t o u c h - i c o n . p n g ) ,   u p d a t i n g   i n d e x . h t m l   r e f e r e n c e s .  
 -   S a m p l e d   c o l o r s   f r o m   t h e   n e w   l o g o   a n d   a d d e d   t h e m   t o   	 a i l w i n d . c o n f i g . j s   a s    r a n d - n a v y   ( # 0 3 1 5 3 6 )   a n d    r a n d - b l u e   ( # 0 0 5 a f d ) .  
- Removed all temporary test scripts utilized during verification tasks.
 
## 2026-07-29: Logo & Branding Update
- Extracted and updated the primary logo image from user-provided suite (src/assets/logo.png).
- Extracted and generated a complete set of favicons from the rounded square app-icon variant (including favicon.ico, PNG variants, and apple-touch-icon.png), updating index.html references.
- Sampled colors from the new logo and added them to tailwind.config.js as brand-navy (#031536) and brand-blue (#005afd).
- Applied the new two-tone coloring to the site wordmark 'The Placement Feed' across Navbar.jsx and Footer.jsx.
- Verified visual integration dynamically via Playwright, ensuring layout didn't break and mobile hamburger views and footer logos render correctly.
 
## 2026-07-29: Cleanup & Refinements
- Removed temporary Playwright test files and logo crop artifacts.
- Synced theme-color meta tag in index.html to #005afd to perfectly match the new brand-blue.
 
## [2026-07-29] Admin Credential Rotation Script
- Created `server/scripts/resetAdmin.js` as a standalone CLI script to allow administrators to rotate their credentials without modifying `.env` or relying on the initial seed logic.
- Updated `server/index.js` and `server/config/seed.js` to make `ADMIN_USERNAME` and `ADMIN_PASSWORD` optional after the initial database seed, preventing crashes if they are removed.
- Updated `README.md` to document the new `resetAdmin.js` script and clarify that `.env` credentials can be safely removed post-setup.

## [2026-07-29] Notification System UI Polish
- **Removed Redundant Close Button**: Removed the standalone 'X' close button from the `NotificationBell` dropdown header, as clicking outside the modal handles dismissal cleanly.
- **Global Notification Toasts**: Updated `NotificationContext` so that *all* incoming events (`statusChange`, `new`, `edit`, `automationReset`) trigger an on-screen toast, rather than just `postponed`/`unpostponed` events. The existing red urgent styling for postponed drives remains unchanged.# # #   N o t i f i c a t i o n   P o l l i n g   R a c e   C o n d i t i o n   F i x 
 
 -   * * I n v e s t i g a t i o n * * :   P e r f o r m e d   a   f u l l   e n d - t o - e n d   t r a c e   o f   t h e   n o t i f i c a t i o n   p o l l i n g   m e c h a n i s m .   D i s c o v e r e d   t h a t   t h e   d e l a y   w a s   N O T   c a u s e d   b y   b r o w s e r   c a c h i n g   o r   s t a l e   c l o s u r e s ,   b u t   b y   a   s u b t l e   t i m e s t a m p   r a c e   c o n d i t i o n   i n   t h e   b a c k e n d .   
 -   * * C a u s e * * :   D a t a b a s e   w r i t e s   u s i n g   \ c h a n g e d A t :   n e w   D a t e ( ) \   g e n e r a t e   t i m e s t a m p s   * b e f o r e *   t h e   t r a n s a c t i o n   c o m m i t s .   I f   t h e   c l i e n t   p o l l s   * d u r i n g *   t h e   c o m m i t   w i n d o w ,   i t   r e c e i v e s   a n   e m p t y   r e s u l t   a n d   d o e s   n o t   a d v a n c e   \ l a s t P o l l T i m e \ .   O n c e   t h e   c o m m i t   f i n i s h e s ,   i t s   t i m e s t a m p   i s   o l d e r   t h a n   t h e   t i m e   o f   t h e   p o l l .   O n   t h e   n e x t   t i c k   ( 6 0   s e c o n d s   l a t e r ) ,   t h e   c l i e n t   f i n a l l y   f e t c h e s   i t ,   r e s u l t i n g   i n   a n   u n e x p e c t e d   6 0 - s e c o n d   d e l a y   f o r   t h e   n o t i f i c a t i o n   t o   a p p e a r . 
 -   * * F i x * * :   S u b t r a c t e d   a   1 0 - s e c o n d   o v e r l a p   b u f f e r   f r o m   \ e f f e c t i v e S i n c e D a t e \   i n   \ s e r v e r / r o u t e s / p l a c e m e n t s . j s \ .   T h i s   a l l o w s   t h e   s e r v e r   t o   l o o k   s l i g h t l y   i n t o   t h e   p a s t   t o   c a t c h   a n y   d e l a y e d   c o m m i t s .   T h e   f r o n t e n d ' s   e x i s t i n g   \ e x i s t i n g I d s \   l o g i c   p e r f e c t l y   d e d u p l i c a t e s   t h e   o v e r l a p p i n g   r e s u l t s .  
 