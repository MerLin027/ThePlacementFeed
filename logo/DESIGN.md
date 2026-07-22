---
name: The Placement Feed
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#434655'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#784b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#996100'
  on-tertiary-container: '#ffeedd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  container-max: 1280px
  gutter: 20px
---

## Brand & Style
The design system is engineered for clarity, efficiency, and high legibility, catering specifically to students navigating the high-pressure environment of placement drives. The aesthetic follows a **Modern Corporate** approach with a focus on functional minimalism. 

The UI evokes a sense of reliability and organization. It utilizes a spacious layout with a "data-first" hierarchy, ensuring that critical information—such as deadlines, company names, and application statuses—is immediately scannable. The style relies on clean lines, subtle structural borders, and a disciplined use of color to guide the user's attention without causing cognitive fatigue.

## Colors
The palette is rooted in a professional "University Blue" that signals trust and authority. 

- **Primary (#2563eb):** Used for primary actions, active navigation states, and the "Upcoming" status.
- **Secondary (#64748b):** Dedicated to metadata, captions, and supporting text to maintain a clear visual hierarchy.
- **Surface (#f9fafb):** The primary background color to reduce eye strain compared to pure white.
- **Status Tones:** 
  - **Amber (#f59e0b):** Indicates "Ongoing" drives, demanding attention without signaling an error.
  - **Muted Green (#10b981):** Provides a calm, low-priority signal for "Completed" tasks.
- **Borders (#e2e8f0):** Soft structural lines used to define cards and input fields.

## Typography
This design system utilizes a dual-font strategy. **Geist** is employed for headings and labels to provide a technical, modern edge suitable for engineering students. **Inter** is used for all body text to ensure maximum readability during long browsing sessions.

Weight is used strategically: Semi-bold and Bold for company names and primary titles, while Regular weight is reserved for descriptions and administrative details. Secondary text should always use the Slate-Gray color token to differentiate from primary content.

## Layout & Spacing
The layout follows a **Fixed Grid** model on desktop (centered 1280px container) and a fluid 4-column model on mobile. 

- **Grid:** 12 columns with a 24px gutter for desktop.
- **Margins:** 16px lateral margins for mobile, scaling to 40px for tablet.
- **Rhythm:** All spacing (padding and margins) must be increments of 4px. Use `24px` (md) for the standard gap between cards and `16px` (sm) for internal card padding.
- **Verticality:** Use generous whitespace between different drive categories to allow the eye to rest.

## Elevation & Depth
The design system avoids heavy shadows, favoring **Tonal Layers** and **Low-contrast outlines**. 

- **Surface Level:** The main background is the Neutral token (#f9fafb).
- **Raised Level:** Cards and modals use a pure white background (#ffffff) with a 1px solid border (#e2e8f0).
- **Active State:** On hover, cards may transition to a subtle ambient shadow (0px 4px 12px rgba(0,0,0,0.05)) to indicate interactivity, but the border remains the primary structural element.

## Shapes
The shape language is "Soft-Modern." All primary containers, including drive cards and input fields, use a standard 8px-12px corner radius. 

- **Standard Elements:** 8px (e.g., Input fields, small buttons).
- **Featured Elements:** 12px (e.g., Company drive cards, large CTA buttons).
- **Status Badges:** Use the "Pill" style (Full radius) to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Solid Blue (#2563eb) with white text. 8px radius.
- **Secondary:** White background with 1px border (#e2e8f0) and Blue text.

### Status Badges
All badges are pill-shaped with `label-sm` typography, uppercase.
- **Upcoming:** Blue background (10% opacity) with Blue text.
- **Ongoing:** Amber background (10% opacity) with Amber text.
- **Completed:** Green background (10% opacity) with Green text.

### Cards (Drive Tracker)
White background, 12px radius, 1px border. Internal padding of 24px. Company logos should be placed in a 48x48px bordered slot (1px solid #e2e8f0, 8px radius) at the top left.

### Logo Placeholders
For CHARUSAT and CDPC logos, use 120x40px containers with 1px dashed borders in the header or footer to indicate reserved branding space.

### Input Fields
1px solid border (#e2e8f0), 8px radius, height of 44px. Use Inter (body-md) for placeholder text in Slate-Gray.

### Lists
For table views or lists, use 1px horizontal dividers (#e2e8f0) only, removing vertical borders to maintain a clean, breathable interface.