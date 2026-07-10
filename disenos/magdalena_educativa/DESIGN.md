---
name: Magdalena Educativa
colors:
  surface: '#fbf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae8e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#434750'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#747781'
  outline-variant: '#c4c6d2'
  surface-tint: '#3c5d9c'
  primary: '#001b44'
  on-primary: '#ffffff'
  primary-container: '#002f6c'
  on-primary-container: '#7999dc'
  inverse-primary: '#aec6ff'
  secondary: '#006492'
  on-secondary: '#ffffff'
  secondary-container: '#45baff'
  on-secondary-container: '#00486a'
  tertiary: '#1b1d1d'
  on-tertiary: '#ffffff'
  tertiary-container: '#303232'
  on-tertiary-container: '#999a9a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#aec6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#224583'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#8bceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004b6f'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  headline-xl:
    fontFamily: Work Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Work Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Work Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Work Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system is engineered for the **Secretaría de Educación del Magdalena**, prioritizing institutional authority, transparency, and accessibility for a diverse citizenry. The brand personality is **reliable, professional, and civic-minded**, reflecting the dignity of a government entity while maintaining the approachability required for educational services.

The design style follows a **Corporate / Modern** aesthetic, heavily influenced by contemporary government standards. It utilizes a structured, clean layout with ample whitespace to reduce cognitive load for users navigating complex administrative procedures. Visual cues are clear and unambiguous, ensuring that the interface remains functional across all age groups and digital literacy levels within the department of Magdalena.

## Colors
The palette is rooted in the "Navy Blue" primary color, symbolizing stability and institutional trust. 

- **Primary (#002F6C):** Used for headers, primary buttons, and critical branding elements. It ensures high contrast against white backgrounds for maximum legibility.
- **Secondary (#009BDE):** A vibrant "Sky Blue" used for interactive elements, links, and accents to provide a sense of progress and digital modernity.
- **Surfaces (#F2F2F2):** A "Light Gray" used to differentiate content areas, sidebars, and form backgrounds without the harshness of pure white.
- **Background (#FFFFFF):** Standard white for the main content body to ensure a clean, "paper-like" reading experience.
- **Success/Error/Warning:** Standard semantic colors should be used in accordance with Colombian .gov.co accessibility guidelines (Green #28A745, Red #D93025).

## Typography
This design system utilizes **Work Sans** across all levels. It was selected for its exceptional legibility on digital screens and its professional, grounded character. 

- **Hierarchy:** Use heavy weights (700) for page titles and section headers to establish a clear information architecture.
- **Body Text:** Use regular weight (400) for all instructional and descriptive text. For long-form documents or news articles, `body-lg` is preferred to improve readability.
- **Interactions:** Labels for buttons and navigation items should use `label-md` with semi-bold weights to distinguish them from static content.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for desktop to ensure content remains centered and readable on large displays, while transitioning to a **Fluid Grid** for mobile devices.

- **Desktop:** A 12-column grid with a 1200px max-width. Gutters are fixed at 24px to provide clear separation between content blocks.
- **Mobile:** A 4-column fluid grid with 16px side margins. 
- **Rhythm:** An 8px linear scale is used for all internal component spacing (padding/margins). Use `stack-lg` (32px) to separate major sections, and `stack-md` (16px) for grouping related elements within a card or section.

## Elevation & Depth
This design system employs **Low-contrast outlines** and **Tonal layers** rather than heavy shadows to maintain a clean, institutional feel.

- **Flat Surfaces:** Primary content areas reside on white backgrounds with a subtle 1px border (#E0E0E0) to define boundaries.
- **Layering:** Use the Light Gray surface color (#F2F2F2) to create depth for secondary areas like sidebars, footers, or search bars.
- **Hover States:** Interactive elements may use a very soft, diffused shadow (0px 4px 12px rgba(0,0,0,0.05)) to indicate focus, but the primary indicator should be a color shift to the Secondary Blue.

## Shapes
The shape language is **Soft (roundedness: 1)**. This uses a 0.25rem (4px) corner radius for standard elements like buttons and input fields.

This choice balances the formal requirements of a government agency with a modern, user-friendly touch. 
- **Buttons/Inputs:** 4px radius.
- **Cards/Modals:** 8px (rounded-lg) to provide a gentle containerized look.
- **Avatars:** Circular (full-round) to denote people/users.

## Components
- **Buttons:** Primary buttons are solid Navy Blue with white text. Secondary buttons use a Navy Blue outline with a transparent background. All buttons have a 4px corner radius.
- **Input Fields:** Use a 1px Light Gray border, 16px horizontal padding, and a 4px corner radius. Labels should always be visible above the field (not just placeholders).
- **Cards:** White background, 1px border (#E0E0E0), and 8px corner radius. Use a 24px internal padding for content.
- **Government Header:** Must include the official .gov.co bar at the very top, followed by the Secretaría de Educación del Magdalena logo and navigation menu.
- **Footer:** Deep Navy Blue (#001A3D) with white text, containing legal links, contact information for the Magdalena department, and the official co-branding logos.
- **Status Chips:** Small, 4px rounded labels for "En Trámite" (Sky Blue background) or "Finalizado" (Green background), using `label-sm` typography.