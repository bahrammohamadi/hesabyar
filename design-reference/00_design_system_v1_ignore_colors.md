---
name: Hesabyar Design System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#404947'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#707977'
  outline-variant: '#bfc8c6'
  surface-tint: '#316761'
  primary: '#003631'
  on-primary: '#ffffff'
  primary-container: '#134e48'
  on-primary-container: '#87beb6'
  inverse-primary: '#9ad1c9'
  secondary: '#712ae2'
  on-secondary: '#ffffff'
  secondary-container: '#8a4cfc'
  on-secondary-container: '#fffbff'
  tertiary: '#003442'
  on-tertiary: '#ffffff'
  tertiary-container: '#004c5f'
  on-tertiary-container: '#56c0e2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b5ede5'
  primary-fixed-dim: '#9ad1c9'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#154f49'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#b7eaff'
  tertiary-fixed-dim: '#6cd3f7'
  on-tertiary-fixed: '#001f28'
  on-tertiary-fixed-variant: '#004e61'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Vazirmatn
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 52px
  headline-md:
    fontFamily: Vazirmatn
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 36px
  headline-sm:
    fontFamily: Vazirmatn
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Vazirmatn
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Vazirmatn
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Vazirmatn
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-numeric:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  headline-md-mobile:
    fontFamily: Vazirmatn
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 30px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar_width: 260px
  gutter: 1.5rem
  margin_page: 2rem
  card_padding: 1.25rem
  stack_gap: 1rem
---

## Brand & Style
This design system is engineered specifically for the Persian-speaking retail market, focusing on the intersection of professional accounting rigor and the vibrant, fast-paced nature of the clothing industry. The brand personality is **dependable, organized, and approachable**. It aims to reduce the cognitive load of financial management through a clean, airy interface that feels more like a modern lifestyle app than a traditional ledger.

The visual style is **Corporate / Modern with a Soft Minimalist touch**. It leverages high-quality Persian typography, generous white space, and a pastel-informed color palette to create a sense of calm efficiency. The interface is strictly RTL-first, ensuring that spatial logic and visual hierarchy feel natural to native Farsi speakers.

## Colors
The palette is rooted in a deep "Financial Green" primary color to establish trust and authority. This is balanced by a secondary palette of soft pastels used for background surfaces of cards and KPI modules to differentiate data categories without overwhelming the user.

- **Primary & Financial:** A deep, saturated forest green used for navigation states, primary buttons, and critical financial headers.
- **Secondary/Tertiary:** Vibrant purple and cyan are used for secondary insights and interactive accents.
- **Neutral:** The background uses an off-white/very light gray to reduce screen glare during long accounting sessions.
- **Surface Tints:** Pastel Blue (Inventory), Pastel Purple (Sales), and Pastel Green (Revenue) are used to color-code dashboard modules.

## Typography
The system utilizes **Vazirmatn** as the primary typeface for all Persian text due to its exceptional legibility and modern aesthetic. For financial figures and data-heavy tables, **Work Sans** is used as a secondary font to ensure that numerals are clear, distinct, and professionally aligned.

Key typographic rules:
- All text is right-aligned by default.
- Line heights are slightly increased compared to Latin standards to accommodate Persian descenders and ascenders comfortably.
- Numeric data in reports should use tabular figures (monospaced numbers) to ensure columns align perfectly in transaction tables.

## Layout & Spacing
This design system follows a **Fixed-Fluid Hybrid** layout. The sidebar is fixed to the right side of the viewport, while the main content area utilizes a fluid 12-column grid.

- **RTL Orientation:** The sidebar is positioned on the far right. Content flows from right to left.
- **Breakpoints:**
  - **Desktop (1280px+):** 12 columns, 24px gutters, 32px page margins.
  - **Tablet (768px - 1279px):** Sidebar collapses to icons only, 16px gutters.
  - **Mobile (<767px):** Single column stack, sidebar moves to a bottom navigation bar or a right-side drawer.
- **Density:** Generous padding is applied to containers to maintain the "clean and modern" feel, avoiding the cramped look typical of legacy ERP systems.

## Elevation & Depth
Hierarchy is established through **Tonal Layering** and **Ambient Shadows**. 

- **Surface 0 (Background):** Light neutral `#F8FAFC`, flat.
- **Surface 1 (Cards/Sidebar):** Pure white `#FFFFFF` with a very soft, diffused shadow (Offset: 0 4px, Blur: 20px, Opacity: 4% Black).
- **Surface 2 (Active States/Popovers):** Higher elevation with a more pronounced shadow to indicate interactivity.
- **Interactive Tints:** Low-opacity primary color overlays are used for hover states on white surfaces rather than dark shadows.

## Shapes
The shape language is consistently **Rounded**, reflecting the "friendly" aspect of the brand.
- **Standard UI Elements:** (Inputs, Small Buttons) use `0.5rem` (8px).
- **Dashboard Cards:** Use `rounded-lg` (1rem / 16px) to create a soft, containerized look for financial data.
- **KPI Badges:** Use `rounded-xl` (1.5rem / 24px) or full pill shapes for a modern, approachable feel.

## Components
### Sidebar (Right-Aligned)
The primary navigation sits on the right. Active states use the Primary Dark Green as a solid background with white text/icons. Icons are mirrored where directionality matters (e.g., arrows, logout).

### KPI Cards
Card backgrounds use the pastel palette (Blue, Purple, Green). They feature a large numeric value (Work Sans) and a small trend indicator (percentage with a mini sparkline).

### Data Tables
Tables utilize a white background with a dark financial-green header row (as seen in the reference). Row borders are extremely light (`#E2E8F0`). Text alignment is strictly right for descriptions and left/centered for currency and status badges.

### Status Badges
Utilize high-contrast background tints:
- **Success:** Light green background with dark green text.
- **Pending:** Light orange background with dark brown text.
- **Failed/Alert:** Light red background with dark red text.

### Circular Expenditure Charts
Use a donut-style chart with a thick stroke. Labels should be placed on the left side of the chart (the "end" of the RTL flow) with clear color-coded keys.

### Input Fields
Inputs are outlined with a soft 1px border. The label is floated to the top-right of the input field. Error states use a soft red border and a small icon on the left side of the input.