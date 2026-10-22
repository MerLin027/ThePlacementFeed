# Refinement Plan — Status Logic, Notifications, Frontend Completeness & UI Polish

> **Status: PLAN — awaiting go-ahead.** Written 2026-10-22 after auditing the code and capturing every page (desktop 1280px + mobile 390px) against a seeded local database.
> **Process:** each phase ends with its checks (lint, build, automated tests, before/after screenshots) → `HISTORY.md` entry → one git commit. Vault notes updated in the last phase.
> **Skills used:** `secure-coding-practices` (server changes), `ui-ux-pro-max` (quick-reference + pro-rules checklists), `taste-skill/redesign-skill` (audit → fix order for an existing project), `genjutsu/design-audit` (motion/a11y/consistency greps), `taste-skill` (restraint: trust-first design read).

---

## 0. Confirmed since the last plan

- **D6 confirmed:** students whose account the admin deleted can sign up again with the same email/roll number (already how it works).
- **Forced reset prompt:** already implemented. Logging in with the temporary password lands on a "Choose a new password" form, and the API blocks everything else until it's done. Phase C makes the wording explicitly *compulsory* and mentions the 72-hour limit.

---

## 1. Audit findings

### 1.1 Drive status & cron (server)

| # | Finding | Severity |
|---|---|---|
| S1 | **Date-order check is skipped on edits.** `deadline ≤ driveDate` lives in a Mongoose `pre('validate')` hook, which `findByIdAndUpdate` (used by `PUT`) never runs. An admin can save a deadline after the drive date; the cron then flags it "anomalous" and stops automating it. | Bug |
| S2 | **Status only moves forward.** If an admin extends a deadline on an automated drive that's already "Ongoing", it never returns to "Upcoming"; the badge is wrong until someone fixes it by hand. | Bug |
| S3 | **Postponed drives keep being automated.** A postponed drive whose old dates pass silently becomes "Completed", which contradicts the postponement. | Logic |
| S4 | **New/edited drives aren't evaluated until the next cron run** (daily, or a Render cold start). A drive created with a past deadline shows "Upcoming". | Logic |
| S5 | A drive with no deadline whose drive date has passed goes Upcoming → Ongoing → Completed in one run and sends **two** "status changed" notifications. | Minor |
| S6 | `/api/cron/trigger` compares the secret with `!==` (not constant-time). | Hardening |
| S7 | Students see **"Apply Now" on external-form drives whose deadline has passed or that are postponed** (e.g. TCS in the screenshots). In-app drives already block this; external ones don't. | Bug (UX) |
| S8 | Cards show **"Multiple Branches"** when a drive has *no* branch restriction; it should say "All branches". | Copy bug |

### 1.2 Notifications (client + server)

| # | Finding | Severity |
|---|---|---|
| N1 | Diagnostic `console.log`s are **still in the polling loop** (`[NotifPoll] tick…`, every 20 s for every visitor), although HISTORY says they were removed. | Cleanup / info leak |
| N2 | **Overlapping polls duplicate notifications.** The initial poll, the 20 s interval and tab-focus polls can run at the same time with the same `lastPollTime`; both responses are merged before state updates. Seen in screenshots: two identical "Welcome!" toasts. | Bug |
| N3 | **First visit invents a "New drive" notification** for whatever drive is newest (even weeks old), plus a "Welcome!" toast. | Misleading |
| N4 | "X status changed" never says **what it changed to**. | UX |
| N5 | Students get **no notice when the admin changes their application status** (Shortlisted, Offered…). The data exists; nothing surfaces it. | Gap |
| N6 | `JSON.parse(localStorage…)` unguarded in three places; corrupt storage breaks polling silently. | Robustness |
| N7 | Toasts use **emoji as icons** (👋 ℹ️ 📝 🔄 🔔) and shouty copy ("postponed!"). | Polish (ui-ux: `no-emoji-icons`) |
| N8 | Bell panel: no Escape to close, no `aria-expanded`, and the **dismiss (×) button is invisible on touch devices** (hover-only). | A11y bug |

### 1.3 Frontend completeness

| # | Finding |
|---|---|
| F1 | **No "My applications" page.** `GET /api/applications/my` exists, but students can only see a status by opening each drive. |
| F2 | Forced-reset form copy should state it's **required** and mention the 72 h window; the login page should tell reset students to use the temporary password. |
| F3 | Admin dashboard has a **duplicate Logout** button (the navbar has one too). |
| F4 | Opening a notification for a **deleted drive** shows "Oops! Placement not found". |

Everything else from the student-accounts plan is present: signup/login/profile/change password, apply flow, admin Students page, applicants page and export.

### 1.4 UI audit (skills checklists + screenshots)

**Global**
- No `prefers-reduced-motion` handling (design-audit: *critical*).
- No skip-to-content link; no focus move on route change.
- App shell uses `h-screen` (100vh) → iOS Safari jump (ui-ux: `viewport-units`).
- 9 hand-rolled spinners, no skeletons; the Render cold start (30–50 s) makes this the most-seen state (ui-ux: `progressive-loading`).
- Numbers (CTC, CGPA, dates) aren't tabular; headings in Title Case; "Oops!" copy.
- Small touch targets: postpone chips, the bell's dismiss buttons, admin row icons (~32px).
- Interaction states are uneven: no pressed feedback, transition durations vary.

**Home**
- Completed and postponed drives are mixed in with open ones, sorted by creation date. Students care most about **what's open and closing soon**.
- Every card shows the same generic building icon.
- No deadline urgency ("closes in 2 days").
- Filters default "Min CTC" to `0`.

**Drive detail**
- On mobile, the eligibility section comes *after* the selection process. It should come right after the apply button.
- No countdown to the deadline.

**Timeline**
- No "today" marker; past months look the same as upcoming ones.

**Forms**
- No show/hide toggle on password fields (ui-ux: `password-toggle`).
- No focus on the first invalid field after a failed submit (`focus-management`).
- The admin drive form shows one error banner at the top instead of errors next to fields.

**Admin**
- Dashboard: tables don't adapt on mobile, and there are a few small targets.

---

## 2. Decisions (recommended; say if you want any flipped)

| ID | Decision |
|---|---|
| R1 | Drive status becomes a **pure function of dates** (`computeAutoStatus`) applied in both directions whenever a drive is created, edited, or the cron runs — unless the admin set it manually or the drive is postponed. |
| R2 | **Home shows open drives first, soonest deadline first**; completed drives move to a collapsible "Past drives" section below. Filters and sorting still work as today. |
| R3 | **Remove the fake first-visit notification and the "Welcome!" toast**; first visit just starts tracking from now. |
| R4 | **Students get notifications when their application status changes** (bell + toast), checked every 60 s while logged in. Admin notes are never exposed. |
| R5 | Keep the current visual identity (Material Design 3 tokens, Geist headings + Inter body, brand blue). This is a polish pass, not a redesign — design read: *trust-first institutional portal* (VARIANCE 4 / MOTION 3 / DENSITY 5). |
| R6 | No new UI libraries. Skeletons, motion and toggles use Tailwind + CSS only. |

---

## 3. Phases

### Phase A — Drive status & cron logic (server + apply visibility)
1. `server/utils/driveStatus.js`: `computeAutoStatus(drive, today)` using whole IST days. Deadline passed → Ongoing; drive date passed → Completed; otherwise Upcoming.
2. Cron: one pass, sets the computed status in either direction, skips `statusManuallySet` and `isPostponed`, logs exactly one `statusChange` per real change. Store the new status on the change entry (feeds N4).
3. Create/`PUT`: compute status on save when not manual (S4). Re-check `deadline ≤ driveDate` in `express-validator` and the `PUT` handler (S1).
4. Constant-time secret compare on `/api/cron/trigger` (S6).
5. Client `applyState`: external links also respect deadline and postponement (S7); "All branches" copy (S8).

**Checks:** truth-table test for `computeAutoStatus` (every date combination, postponed, manual, IST edges); API tests for create/edit/backwards correction/date-order rejection; cron run against seeded drives; full regression (308 checks).

### Phase B — Notification system
1. Remove diagnostic logs (N1). Single-flight polling: skip a tick while one is in flight, and merge with functional state updates so duplicates can't appear (N2).
2. First visit seeds `lastPollTime` silently (R3 / N3).
3. Status-change copy includes the new status ("Infosys is now Ongoing"), with a fallback for old entries (N4).
4. Student application-status notifications (R4 / N5): `GET /api/applications/my/summary` returns `statusUpdatedAt`; a stored per-student snapshot detects changes.
5. Safe storage helpers (N6). Replace emoji with Material Symbols icons; calm copy (N7).
6. Bell: Escape closes and returns focus, `aria-expanded`/`aria-controls`, always-visible 44px dismiss button on touch, time-ago labels (N8).

**Checks:** browser tests with fake timers/forced concurrent polls (no duplicates), first visit creates nothing, status text, student gets notified once per change (not on reload), dismiss on touch emulation, keyboard Escape; regression.

### Phase C — Frontend completeness
1. **My applications page** (`/applications`, student nav link): list with drive, role, applied date, status pill, link to the drive; empty state with "Browse drives" (F1).
2. Forced reset: title "Set a new password to continue", clear "required" wording, 72 h note; login page hint for reset students (F2).
3. Remove the duplicate admin Logout (F3); friendly "This drive is no longer available" page for deleted drives (F4).
4. Route/feature matrix check: every API capability has a UI entry point, every page reachable from navigation.

**Checks:** browser tests for the new page, reset copy, 404 drive; route matrix script; regression.

### Phase D — UI foundation (shared, global)
1. `prefers-reduced-motion` global handling; motion tokens (150 / 200 / 300 ms, ease-out in, ease-in out); pressed feedback (`active:scale-[.98]`) on buttons and cards; `cursor-pointer`.
2. Skip-to-content link; focus `<main>` on route change; `min-h-dvh` shell.
3. Shared components: `Spinner`, `Skeleton` (card / detail / table variants), `EmptyState`, `Badge`. Replace the 9 ad-hoc spinners.
4. Typography: `tabular-nums` for CTC/CGPA/dates, `text-wrap: balance` on headings, sentence-case headings, remove "Oops!"/exclamation copy.
5. Forms: password show/hide toggle; focus the first invalid field on failed submit; ≥44px targets everywhere (z-index scale documented).

**Checks:** design-audit greps (reduced motion, clickable divs, outline-without-focus-visible, durations), axe-core accessibility scan via Playwright on every page (no serious/critical issues), contrast spot checks, before/after screenshots, regression.

### Phase E — Student-facing pages
1. **Home:** open drives first by soonest deadline with a "Past drives" section (R2); company monogram tiles instead of the generic icon; deadline urgency chip ("Closes today / in 3 days"); skeleton cards during cold start; filter panel polish (no `0` default); result count announced politely.
2. **Drive detail:** mobile order apply → eligibility → dates → process → JD; deadline countdown; consistent section styling.
3. **Timeline:** "Today" marker, past months muted, compact month headers.
4. **Auth / profile / apply modal / my applications:** consistent spacing, password toggles, modal enter/exit motion (reduced-motion aware).
5. **Navbar / footer / 404:** animated mobile menu with focus handling, active states, refreshed 404.

**Checks:** screenshots at 390 / 768 / 1280; axe scan; keyboard-only walkthrough of signup → apply; regression.

### Phase F — Admin pages
1. Dashboard: card layout on mobile, 44px row actions, clearer postpone/automation controls, empty state.
2. Drive form: grouped fieldsets, required markers, errors next to fields + focus first invalid.
3. Applicants & Students: shared skeleton/empty/badge components, mobile layout check.

**Checks:** screenshots, axe scan, admin regression suites (Phases 3–5 browser).

### Phase G — Final audit & docs
Full design-audit + accessibility pass, full regression (all suites incl. new ones), README/HISTORY updates, vault notes (status logic decision, notification gotchas), final screenshots before/after for you to review.

---

## 4. Out of scope (unless you want them)

Dark mode, Tailwind 4 migration (would clear the remaining build-time npm advisories), push/email notifications, server-side rendering.
