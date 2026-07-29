---
name: Hesabyar
colors:
  surface: '#f7faf7'
  surface-dim: '#d8dbd8'
  surface-bright: '#f7faf7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f1'
  surface-container: '#ecefec'
  surface-container-high: '#e6e9e6'
  surface-container-highest: '#e0e3e0'
  on-surface: '#191c1b'
  on-surface-variant: '#3f4945'
  inverse-surface: '#2d3130'
  inverse-on-surface: '#eff1ef'
  outline: '#6f7975'
  outline-variant: '#bec9c4'
  surface-tint: '#1c6a5a'
  primary: '#004c3e'
  on-primary: '#ffffff'
  primary-container: '#156555'
  on-primary-container: '#97dfcb'
  inverse-primary: '#8cd4c0'
  secondary: '#515f74'
  on-secondary: '#ffffff'
  secondary-container: '#d5e3fd'
  on-secondary-container: '#57657b'
  tertiary: '#6a3125'
  on-tertiary: '#ffffff'
  tertiary-container: '#87483a'
  on-tertiary-container: '#ffc3b6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a8f1dc'
  primary-fixed-dim: '#8cd4c0'
  on-primary-fixed: '#00201a'
  on-primary-fixed-variant: '#005143'
  secondary-fixed: '#d5e3fd'
  secondary-fixed-dim: '#b9c7e0'
  on-secondary-fixed: '#0d1c2f'
  on-secondary-fixed-variant: '#3a485c'
  tertiary-fixed: '#ffdad3'
  tertiary-fixed-dim: '#ffb4a4'
  on-tertiary-fixed: '#390c04'
  on-tertiary-fixed-variant: '#703629'
  background: '#f7faf7'
  on-background: '#191c1b'
  surface-variant: '#e0e3e0'
typography:
  headline-xl:
    fontFamily: Vazirmatn
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 48px
  headline-lg:
    fontFamily: Vazirmatn
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Vazirmatn
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Vazirmatn
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Vazirmatn
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Vazirmatn
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Vazirmatn
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  headline-lg-mobile:
    fontFamily: Vazirmatn
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar_width: 280px
  gutter: 1.5rem
  margin_desktop: 2rem
  margin_mobile: 1rem
  container_max_width: 1440px
---

## Brand & Style
The design system is engineered for a sophisticated Persian-centric financial ecosystem. It prioritizes clarity, trust, and professional precision. The brand personality is "The Dependable Advisor"—authoritative yet accessible. 

The aesthetic blends **Modern Corporate** efficiency with **Minimalist** clarity. By utilizing a soft neutral background paired with pure white surfaces, the UI creates a structured environment where financial data remains the primary focus. The visual language is high-integrity, avoiding unnecessary decoration in favor of functional elegance and a calm emotional response.

## Colors
The palette is anchored by a deep, authoritative green (HSL 165 65% 24%), evoking stability and growth. 

- **Primary & Neutral:** The deep green is used for key actions and brand presence. The secondary slate grey provides a professional grounding for secondary UI elements.
- **Background & Surface:** A soft neutral (HSL 220 26% 97%) serves as the canvas, with pure white surfaces creating a clear "Elevated Paper" metaphor for cards and data tables.
- **Financial Semantic Palette:** 
    - **Profit/Loss:** High-contrast greens and reds for immediate fiscal status.
    - **Debt/Credit:** Distinct purple and blue tones to differentiate ledger types from standard status alerts.
- **Status:** Standardized colors for system feedback, ensuring safety and caution are communicated clearly.

## Typography
This design system utilizes **Vazirmatn** for all roles to ensure perfect Persian legibility and a contemporary typographic rhythm. 

- **Alignment:** Native Right-to-Left (RTL) alignment is the default. 
- **Hierarchy:** Large headlines use heavier weights (Bold/700) to anchor pages, while body text maintains a balanced line height (1.5x - 1.75x) for comfortable reading of dense financial reports.
- **Numbers:** Ensure the use of Persian numeral glyphs where appropriate for local accounting contexts, while maintaining tabular lining for financial tables to ensure vertical alignment of digits.

## Layout & Spacing
The layout follows a strict **RTL (Right-to-Left)** structure, optimizing for Persian language flow.

- **Sidebar:** Positioned on the **Right** side of the viewport. On desktop, it is a fixed persistent element; on mobile, it transitions to a right-side drawer.
- **Grid:** A 12-column fluid grid system. Gutters are set to 24px (1.5rem) to provide significant breathing room between data-heavy columns.
- **Rhythm:** Spacing follows a 4px/8px baseline grid. Use 16px for internal component padding and 24px for external layout margins.

## Elevation & Depth
Depth is communicated through **Ambient Shadows** and surface layering rather than high-contrast borders.

- **Level 0 (Background):** Soft neutral (F4F6F8).
- **Level 1 (Cards/Surfaces):** Pure white (FFFFFF) with a subtle, highly diffused shadow (0px 4px 12px rgba(0, 0, 0, 0.05)).
- **Level 2 (Overlays/Modals):** Pure white with a more pronounced shadow (0px 12px 32px rgba(0, 0, 0, 0.1)) to indicate focus.
- **Interactive States:** On hover, buttons and interactive cards should slightly deepen their shadow and transition color subtly.

## Shapes
The design system employs a consistent **12px (0.75rem)** radius for standard UI elements.

- **Components:** Buttons, Input fields, and small containers use the 12px radius.
- **Large Elements:** Cards and Modals may use a 16px (1rem) radius to feel softer and more modern.
- **Consistency:** Avoid mixing sharp corners with rounded elements. All interactive hit areas must maintain the 12px corner radius for brand uniformity.

## Components
- **Buttons:** Primary buttons use the deep green background with white text. Secondary buttons use a slate outline. Height is standardized at 44px for main actions.
- **Inputs:** Fields use a 1px border in a light slate tone, moving to the primary green on focus. Label text is always right-aligned above the field.
- **Cards:** Pure white background, 12px radius, and the subtle ambient shadow. Used for grouping related financial data or individual ledger entries.
- **Sidebar Items:** Right-aligned icons followed by text. Active state uses a soft green tint (5% opacity of primary) with a 4px vertical bar on the right edge.
- **Financial Lists:** High density. Use alternating row stripes (white and background-neutral) for long data tables to maintain tracking across rows.
- **Chips/Badges:** Used for status. Text color should be a darkened version of the status color for accessibility against light-tinted backgrounds.