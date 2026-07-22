# Project History

## July 22, 2026 — Minor UI Label Update

### Task 1 — Rename "View Results" Button Label
- Renamed the "View Results" button label to "View Details" on placement cards with a "Completed" status in `PlacementCard.jsx` to improve clarity.

### Task 2 — Fix "Apply Now" Fallback Logic
- Updated `PlacementCard.jsx` to show "Apply Now" (with primary styling) only if `formUrl` exists, regardless of status.
- If `formUrl` is missing, the card now falls back to "View Details" (with secondary styling appropriate for the status) even for "Upcoming" drives.

### Task 3 — Placement Detail Layout Fix
- Fixed an issue in `PlacementDetail.jsx` where the footer was pushed off-screen and content failed to center properly.
- Removed `flex-grow` from the page wrapper and nested the grid inside a standard block container. This allows the parent `<main className="flex-1">` in `App.jsx` to correctly handle pushing the footer to the bottom of the viewport for short content, while preventing the grid rows from stretching vertically.

## July 22, 2026 — Design Polish Batch 1: Accessibility & Quick Fixes

### Task 1 — Navbar Logo Alignment (`Navbar.jsx`)
- Removed `max-w-container-max mx-auto` from the Navbar's inner container. The header now spans the full width of the screen, ensuring the logo sits flush against the extreme left edge of the viewport (while still respecting the standard `px-sm md:px-lg` padding), rather than being artificially centered on wide displays.

### Task 2 — Footer Logo Sizing (`Footer.jsx`)
- Restructured the footer logo display by giving both the CHARUSAT and CDPC logos consistent fixed-width container slots (`w-32`).
- Adjusted heights independently: scaled CHARUSAT down to `h-6` (as its wordmark is horizontally long) and scaled CDPC up to `h-9` (as it is more square).
- Added a subtle vertical divider (`h-6 w-px bg-outline-variant mx-md`) between the two logos so they are visually anchored and read as peers.

### Task 4 — Home page vertical rhythm adjustments (`Home.jsx`)
- Reduced the top padding of the main container from `md:py-xl` to `md:pt-lg md:pb-xl` to tighten the gap between the Navbar and the "Active Drives" heading.
- Adjusted vertical spacing between stacked elements for a consistent rhythm:
  - Heading → Subtitle: `mb-sm` (16px) → `mb-xs` (8px) for tighter grouping.
  - Subtitle → FilterBar: `mb-lg` (40px) → `mb-md` (24px) to match other gaps.
  - Results Summary text: `mb-sm` (16px) → `mb-md` (24px).
  - Empty State card: `py-xl` (64px) → `py-lg` (40px) to prevent it from feeling disproportionately large.
- Overall vertical flow is now tightly coupled for related elements (8px) and evenly spaced for distinct sections (24px/40px).

### Task 5 — Focus-visible states on nav links (`Navbar.jsx`)
- Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm` to all desktop nav `<Link>` elements (Home, Timeline, Login/Dashboard)
- Added same ring with `ring-offset-1` to all mobile menu `<Link>` elements
- Keyboard users tabbing through the Navbar now see a clear blue focus ring on every link

### Task 2 — Secondary text contrast fix (all files)
- Replaced `text-secondary` (#505f76) with `text-on-surface-variant` (#434655) on all footnote, subtitle, role, and supporting body text throughout the app
- Files changed: `Navbar.jsx`, `Footer.jsx`, `Home.jsx`, `Timeline.jsx`, `PlacementDetail.jsx`, `PlacementCard.jsx`, `AdminLogin.jsx`, `AdminDashboard.jsx`, `ColdStartLoader.jsx`, `ConfirmDialog.jsx`
- Did **not** change primary headings, interactive element text colors, or decorative icon colors (`material-symbols-outlined text-secondary` icon tints were left intentionally)

### Task 3 — Navbar logo/text weight balance (`Navbar.jsx`)
- Changed site name `font-bold` (700) to `font-semibold` (600) to match the `font-headline-md` token weight declaration, balancing visual weight against the logo icon

### Task 4 — CTC/Apply button divider on Placement Detail (`PlacementDetail.jsx`)
- Wrapped the `Apply Now` `<a>` button in a `<div className="border-t border-surface-variant mt-sm pt-sm">` container
- Divider is conditional (only renders when `placement.formUrl` exists) — no orphan border when Apply Now is absent

### Task 5 — Status badge contrast: Upcoming (`StatusBadge.jsx`)
- Replaced `bg-primary/10 text-primary` (very faint blue, ~1.1:1 tint) with `bg-primary-fixed text-on-primary-fixed` (#dbe1ff / #00174b) for a clearly legible badge
- Applied consistently across all components that use `<StatusBadge>`: `PlacementCard`, `Timeline`, `PlacementDetail`, `AdminDashboard`

### Task 6 — Back navigation on Placement Detail (`PlacementDetail.jsx`)
- Added a "← Back to Drives" button at the top-left of the page content using `navigate(-1)` (browser history back)
- Styled with `text-on-surface-variant hover:text-primary` and a focus-visible ring, matching the rest of the page's styling
- Uses `arrow_back` Material Symbol icon for clear affordance

### Task 7 — Footer mobile spacing (`Footer.jsx`)
- Added `mt-xs md:mt-0` to the logo container `<div>`, adding 8px top margin when stacked on mobile
- On `md+` (side-by-side flex row), `md:mt-0` resets the margin so the existing `gap-sm` spacing handles the layout

---

## July 22, 2026 — Navbar Login Link Cleanup

- Removed the blue "Login"/"Dashboard" button from the right side of the Navbar entirely
- Restored the auth-aware admin link back into the desktop nav link group: shows **"Login"** (→ `/admin/login`) when logged out, **"Dashboard"** (→ `/admin/dashboard`) when admin is authenticated
- Renamed label from "Admin Login" to just **"Login"** for brevity
- Fixed nav centering: restructured the header from a 2-zone `justify-between` layout to a **3-zone flex layout** — left zone (`flex-1`, logo), center zone (nav links, auto-width), right zone (`flex-1 justify-end`, hamburger) — so the nav links are always geometrically centered in the header regardless of viewport width
- Mobile hamburger menu mirrors desktop exactly: Home → Timeline → Login/Dashboard, no separate button element
- Extracted `adminTo` / `adminLabel` variables to eliminate duplicate conditional logic

---

## July 22, 2026 — Logo Integration, Footer/Header Consistency, Scrollbar Fixes, Navbar Cleanup & Design Audit

### Task 1 — Main site logo
- Cropped `logo/screen.png` programmatically (Python/Pillow) to extract just the blue icon mark with transparent background padding removed
- Saved as `client/src/assets/logo.png`
- Replaced the `material-symbols-outlined` briefcase/work icon in `Navbar.jsx` with `<img src={logo} className="h-9 w-auto object-contain" />` — renders sharply at navbar icon size, background-agnostic (no fragile color dependency)

### Task 2 — CHARUSAT and CDPC footer logos
- Copied `logo/charusat logo.png` to `client/src/assets/charusat-logo.png` (wide/landscape, already clean)
- Cropped the orange decorative border from `logo/cdpc logo.jpg` using row/column edge detection, saved as `client/src/assets/cdpc-logo.png` (square, border-free)
- Replaced both dashed-border text placeholders in `Footer.jsx` with actual `<img>` tags
- Both logos sized to `h-10` (40px height) with `w-auto object-contain` so they sit as visual peers regardless of aspect ratio
- Reduced footer horizontal gap between logos from `gap-md` to `gap-sm` for tighter visual composition

### Task 3 — Header and footer sizing consistency
- Reduced `Footer.jsx` vertical padding from `py-lg` (40px each side = 80px total) to `py-sm` (16px each side = 32px total + ~20px content ≈ ~52px total height), much closer to the navbar's 64px
- Footer now feels proportionally balanced with the header across all pages

### Task 4 — Removed duplicate Admin Login entry in Navbar
- Removed the `{isAdmin ? <Dashboard link> : <Admin Login link>}` block from the desktop nav link group
- Nav link group now only contains: Home, Timeline (+ Dashboard when admin is logged in)
- Kept the right-side blue Login/Dashboard button as the sole entry point — no changes to its auth-state toggle logic
- Updated mobile hamburger menu to mirror desktop exactly: Home, Timeline, then Login/Dashboard as a styled link (no separate "Admin Login" entry)

### Task 5 — Removed scrollbar on Admin Login page
- Changed `AdminLogin.jsx` root wrapper from `min-h-[80vh]` to `flex-1 flex items-center justify-center py-lg px-sm`
- Changed `App.jsx` `<main>` from `flex-1` to `flex-1 flex flex-col` so pages can correctly use `flex-1` to fill available viewport space without overflowing

### Task 6 — Scrollbar behavior on Placement Detail page
- Confirmed no artificial scroll issue — the `flex-grow` on PlacementDetail's root correctly fills the flex column without setting a fixed height
- The `flex flex-col` change to `<main>` in App.jsx makes flex-grow work correctly: page scrolls only when actual content overflows

### Task 7 — Design consistency audit & fixes
- **PlacementDetail.jsx**: Fixed outer padding from `px-md` → `px-sm md:px-lg` (matching Home, Timeline, AdminDashboard); `Apply Now` button changed from raw inline Tailwind to `btn-primary` class
- **AdminLogin.jsx**: Changed restricted-area footnote from `text-outline` → `text-secondary` (correct token for supporting body text)
- **Timeline.jsx**: Added `w-full` to both the loading-state wrapper and main page wrapper (matching other pages)
- **PlacementCard.jsx**: Replaced raw inline Tailwind button class strings with `btn-primary` (Upcoming) and `btn-secondary` (Ongoing/Completed) for full button consistency; removed redundant `+ ' text-center'` concatenation

## July 22, 2026 — Full App-Wide Visual Redesign (Material Design 3)

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
- **Home.jsx**: Full JSX replacement — MD3 hero section ("Active Drives"), restyled empty/loading states with Material Symbols icons
- **PlacementDetail.jsx**: Full JSX replacement — 2-column layout (4/8 grid), company info card, eligibility criteria with `verified_user` icon, markdown JD rendering, selection process timeline, conditional "Apply Now" button
- **Timeline.jsx**: Restyled with MD3 tokens, primary-container month badges, surface-container-lowest cards
- **AdminDashboard.jsx**: Full table/search/action button restyle, Material Symbols icons for edit/delete
- **AdminLogin.jsx**: Consistency pass — MD3 card styling, Material Symbols lock icon, error-container alerts

### Shared Components (all restyled app-wide)
- **StatusBadge.jsx**: Pill-shaped badges with `primary/10` (Upcoming), `amber-100` (Ongoing), `emerald-100` (Completed), removed dot indicator
- **PlacementCard.jsx**: MD3 card design — logo placeholder, Material Symbols icons (payments, event, engineering, group), status-dependent action buttons
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