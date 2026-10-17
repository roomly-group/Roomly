---
name: Roomly
description: Warm, sunlit student housing. Deep pine greens on plaster cream, with a single amber spark.
colors:
  deep-pine: "#085041"
  shutter-green: "#0f6e56"
  shutter-green-hover: "#0c5a47"
  mint-wash: "#9fe1cb"
  mint-mist: "#e1f5ee"
  sun-amber: "#ef9f27"
  sun-amber-hover: "#e6a53d"
  amber-ink: "#624c2e"
  terracotta: "#a74b32"
  plaster-cream: "#f1efe8"
  card-paper: "#faf9f4"
  ink: "#2c2c2a"
  sage-gray: "#527067"
  sage-placeholder: "#82978e"
  pine-deep-text: "#265c4d"
  line-mint: "#e1ebe4"
  field-border: "#c8ddd2"
  outline-border: "#b7d7ca"
typography:
  display:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "clamp(3rem, 8vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3rem)"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 900
    lineHeight: 1.4
  body:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 800
    lineHeight: 1.25
  eyebrow:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 900
    letterSpacing: "0.15em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  panel: "32px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "28px"
  2xl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.shutter-green}"
    textColor: "{colors.mint-mist}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.deep-pine}"
  button-secondary:
    backgroundColor: "{colors.mint-mist}"
    textColor: "{colors.deep-pine}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.mint-wash}"
  button-amber:
    backgroundColor: "{colors.sun-amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-amber-hover:
    backgroundColor: "{colors.sun-amber-hover}"
  input:
    backgroundColor: "{colors.plaster-cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  card:
    backgroundColor: "{colors.card-paper}"
    rounded: "{rounded.lg}"
  nav-link-active:
    backgroundColor: "{colors.mint-mist}"
    textColor: "{colors.deep-pine}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  pill:
    backgroundColor: "{colors.mint-mist}"
    textColor: "{colors.deep-pine}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
---

# Design System: Roomly

## Overview

**Creative North Star: "The Green Shutter"**

An Italian student flat on a sunny morning: green wooden shutters against warm plaster walls, light falling across a tidy desk, a set of keys waiting on the table. Roomly's interface comes from that scene. Deep pine and shutter greens carry the structure and the voice. Plaster cream is the wall everything sits on. One amber accent shows up where the sun would land: the main search button, a rating star, the owners' invitation.

The system is calm and tidy. Controls stay quiet and well-ordered so that photos, prices, and distance to the university lead. Personality comes from three places only. Type is extra-black and tightly tracked, so headings feel spoken, not printed. Large rounded panels are blocked in solid colour (a mint hero, an amber owners panel, a deep-pine features panel). Small, slow moments of life: a tilted card floating in the hero, concentric rings bleeding off a panel's corner, content rising gently into place.

Depth is softly layered. Surfaces sit on the cream with a faint, green-tinted shadow, rise a little on hover, and the few floating elements (search bar, hero card, menus) cast the deepest shade. Nothing is grey. Even the shadows are pine-tinted.

**Key Characteristics:**
- Warm cream page, pine-green ink, a single amber accent.
- Extra-black (900) Nunito Sans headings with tight negative tracking.
- Generous, consistent rounding: 12px controls, 16px cards, 32px hero panels.
- Colour-blocked feature panels instead of decorative imagery.
- Soft, green-tinted layered shadows; never grey or black drop shadows.
- Gentle motion: rise-in on page enter, a slow float, a 4px hover lift, a 0.98 press.

## Colors

A warm, nature-led palette: two greens for structure, two mints for calm fills, one amber for action, on plaster cream.

### Primary
- **Deep Pine** (deep-pine): the voice of the brand. Headings, listing titles, the dark features panel, text on mint fills, and the hover state of primary buttons.
- **Shutter Green** (shutter-green): the action green. Primary buttons, links, prices, the eyebrow label, the saved-heart fill, and the focus border on inputs.

### Secondary
- **Mint Wash** (mint-wash): the home hero panel, icon tiles on mint backgrounds, the secondary-button hover, and (at 40% alpha) the input focus ring.
- **Mint Mist** (mint-mist): active nav item, secondary buttons, pills and badges, icon tiles, trust banners, and text on dark-pine or shutter-green fills.

### Tertiary
- **Sun Amber** (sun-amber): the single warm spark. The main search CTA, rating stars, the owners panel, and attention dots for a pending state. Text on amber is Ink or Amber Ink, never white.
- **Terracotta** (terracotta): error and declined-request text only. Friendly, warm, not alarm-red.

### Neutral
- **Plaster Cream** (plaster-cream): the page background, input fills, the sticky header (at 95% with blur), and chips on photos.
- **Card Paper** (card-paper): card and popover surfaces, a shade lighter than the page so cards read as laid on top.
- **Ink** (ink): strongest body text, input values, and text on amber.
- **Sage Gray** (sage-gray): secondary text, descriptions, meta lines (zone, distance), and inactive nav items.
- **Sage Placeholder** (sage-placeholder): input placeholders only.
- **Pine Deep Text** (pine-deep-text): body copy on the mint hero.
- **Line Mint** (line-mint), **Field Border** (field-border), **Outline Border** (outline-border): dividers inside cards, input strokes, and outline-button strokes. Hairline card borders use Deep Pine at 10% alpha (`#0850411a`).

### Named Rules

**The One Sun Rule.** Amber marks the single most important action or highlight in a view. One amber CTA per screen; stars and status dots are the only repeat uses.

**The No-Grey Rule.** Neutrals are warm (cream, ink) or green-tinted (sage, mint lines). Do not use cool Tailwind greys (`#e5e7eb` and similar) or pure black for text, borders, or shadows.

**The Token Rule.** Every colour comes from this list. A new hex in a component is a bug: reuse the nearest token.

## Typography

**Display Font:** Nunito Sans (self-hosted, weights 400–900), with sans-serif fallback
**Body Font:** Nunito Sans
**Label/Mono Font:** none in use

**Character:** One rounded humanist sans used at its extremes. Headings at 900 weight with tight tracking feel warm and spoken. Labels and controls at 800 feel sturdy without shouting. Body text stays at 400 for easy reading.

### Hierarchy
- **Display** (900, 48px mobile → 72px desktop, line-height 0.98, tracking -0.045em): one per page, in hero panels only. A second line may switch to Shutter Green for emphasis.
- **Headline** (900, 36px → 48px, line-height 0.98, tracking -0.045em): page intros and section titles, always in Deep Pine.
- **Title** (900, 18px): card titles, panel headings, listing names.
- **Body** (400, 15px, line-height 1.6): intros and descriptions, max about 36rem (≈65ch).
- **Body small** (400, 14px, line-height 1.6): the workhorse for card text, helper text, and messages.
- **Label** (800, 14px): buttons, nav links, form labels. Meta lines use 12px at 800.
- **Eyebrow** (900, 11px, 0.15em tracking, UPPERCASE, Shutter Green): the kicker above every page intro and section title.

### Named Rules

**The Eyebrow-Then-Headline Rule.** Every page intro and major section is an uppercase eyebrow, then a 900-weight headline, then an optional sage description. Do not skip the eyebrow or reorder them.

**The Weight Floor Rule.** Interactive text never goes below 700. Only body copy uses 400.

## Layout

- **Container:** max 1320px, centred, with 20px side gutters (32px from `lg`). Reading pages (static pages, forms) narrow to 920–1120px; single forms to about 28rem.
- **Grid:** listing cards use 1 column on mobile, 2 from `sm` (640px), and 3 from `lg` (1024px), with a 20px gap. Feature rows use asymmetric splits such as 1fr / 1.45fr.
- **Rhythm:** sections are separated by 56–64px. Inside panels, padding is 24px on mobile and 36px on desktop. Cards pad 16px. Stacks inside cards step in 8 / 12px.
- **Responsive behaviour:** mobile first. Navigation collapses to a menu button below `md` (768px). Inline forms (the search bar) stack vertically on mobile and become a single row from `sm`. Decorative floating elements appear only from `lg`.
- **Header:** sticky, 72px tall, translucent plaster cream with a blur and a hairline mint border.

## Elevation & Depth

Softly layered. Every surface sits on the plaster-cream page with a hairline pine-tinted border and a faint ambient shadow. Hover adds one level of lift and moves the element up 4px. Floating UI (the search bar, the hero card, dropdowns, dialogs) takes the deepest level. All shadows are tinted with Deep Pine, never grey.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 2px 7px hsl(166 81% 17% / 0.06)`, `--shadow-sm`): cards, empty states, and panels at rest.
- **Lift** (`box-shadow: 0 10px 28px hsl(166 81% 17% / 0.09)`, `--shadow-md`): card hover and raised menus.
- **Float** (`box-shadow: 0 20px 48px hsl(166 81% 17% / 0.13)`, `--shadow-lg`): the hero search bar, the floating hero card, dialogs.

### Named Rules

**The Tinted Shade Rule.** Shadows only use the three `--shadow-*` tokens. One-off `rgba(8,80,65,…)` shadows should map to the nearest token.

**The Colour-Block Exception.** Solid colour panels (mint hero, amber owners panel, deep-pine panel) carry no shadow. Their colour is their elevation.

## Shapes

Friendly, generous, and consistent. Corners are always rounded, never sharp.

- **8px:** small badges and chips sitting on photos.
- **12px:** every control: buttons, inputs, nav links, icon tiles.
- **16px:** cards, the search bar, banners, feature panels.
- **20px:** value and info cards on static pages; icon wells in empty states.
- **32px:** the large home and waitlist hero panels.
- **Full:** pills, status badges, avatars, the save-heart button, and decorative rings.

**Signature forms.** The brand mark is a pine square with three rounded corners and one tight corner (11 / 11 / 11 / 3px), tilted -5°. Hero panels carry oversized concentric rings or soft circles that bleed off a corner, clipped by the panel radius.

## Components

### Buttons
- **Character:** calm and tidy. Solid fills, no gradients, no outlines unless the button is a secondary choice.
- **Shape:** gently rounded (12px).
- **Primary:** Shutter Green fill, Mint Mist text, 800 weight 14px, 10px × 16px padding. Large form submits are 48px tall.
- **Hover / Focus / Active:** fill darkens to Deep Pine over 200ms. Press scales to 0.98. Disabled is 50% opacity with a not-allowed cursor.
- **Secondary:** Mint Mist fill with Deep Pine text; hover goes to Mint Wash.
- **Outline:** transparent with an Outline Border stroke and Deep Pine text; hover shifts the stroke to Shutter Green on a Mint Mist fill.
- **Ghost:** no fill, Ink text; Mint Mist on hover.
- **Amber:** Sun Amber fill with Ink text. Reserved for the one key action per view (see The One Sun Rule).

### Chips / Pills
- **Style:** fully rounded Mint Mist pills with Deep Pine 900-weight 12px text. On photos, use a Plaster Cream pill at 85% with a backdrop blur and an 8px radius.
- **State:** a live/pending dot (6px circle) in Shutter Green for OK and Sun Amber for waiting.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Card Paper.
- **Shadow Strategy:** Rest at rest, Lift on hover with a 4px upward move over 300ms.
- **Border:** 1px hairline in Deep Pine at about 10–14% alpha.
- **Internal Padding:** 16px. Internal dividers use Line Mint.
- **Listing card:** a 192px photo area (or a soft pastel gradient placeholder when there is no photo) with a dark-bottom scrim. An availability chip sits bottom-left and the save-heart top-right. Below: a zone/distance meta line, the title, then a divider and a price row (price in Shutter Green, "/month" in Sage) with a "view" link whose arrow nudges on hover.

### Inputs / Fields
- **Style:** Plaster Cream fill, 1px Field Border stroke, 12px radius, 12 × 14px padding, Ink 700-weight 14px text, Sage Placeholder placeholder.
- **Focus:** the border turns Shutter Green and gains a 3px Mint Wash ring at 40% alpha. Transition 200ms.
- **Error:** Terracotta helper text in plain, friendly language below the field.

### Navigation
- **Style:** sticky translucent plaster header with the logo left, links centre, and account actions right.
- **Links:** 800-weight 14px with a 16px icon. Inactive links are Sage Gray with a pale mint hover. The active link is a Mint Mist pill with Deep Pine text, 12px radius.
- **Mobile:** links collapse into a menu button (Deep Pine icon, Mint Mist hover) below 768px.

### Page Intro (signature)
Eyebrow → Headline (900, Deep Pine) → Sage description, with an optional action aligned to the bottom-right from `sm`. It is the opening of every app page.

### Colour-Block Panel (signature)
Large rounded panels in a single solid brand colour: Mint Wash (hero), Sun Amber (owners), or Deep Pine (features, with Mint Mist text and Shutter Green icon tiles). They may carry decorative rings or circles and, on desktop, one floating tilted card using the Float shadow.

### Empty State
A Card Paper surface, centred, 64px vertical padding. A Mint Mist icon well (20px radius) with a Shutter Green icon, a 900-weight Deep Pine title, a short Sage explanation, and one action.

## Do's and Don'ts

### Do:
- **Do** take every colour, radius, and shadow from the tokens above. Add a new token here before using a new value.
- **Do** open every page with the Page Intro pattern (eyebrow, 900-weight headline, sage description).
- **Do** use 12px corners on controls and 16px on cards. Keep the rounding consistent within a view.
- **Do** tint every shadow with Deep Pine using the three shadow tokens.
- **Do** let photos, price, and distance lead the listing card. Keep the surrounding chrome quiet.
- **Do** write error messages in plain, friendly words in Terracotta, with a next step when possible.
- **Do** design mobile-first: stack inline forms, keep 48px tap targets for primary actions, and hide decorative floaters below `lg`.
- **Do** respect `prefers-reduced-motion` for the float, rise, and shimmer animations.

### Don't:
- **Don't** use more than one amber call to action in a view.
- **Don't** use cool greys, pure black, or pure white text on brand fills. Use Mint Mist on greens and Ink on amber.
- **Don't** use sharp corners or mix radii arbitrarily within one component.
- **Don't** use grey or black drop shadows, or invent one-off shadow values.
- **Don't** set headings below 800 weight or drop the negative tracking on display and headline text.
- **Don't** use red for errors. Terracotta is the error colour.
- **Don't** add gradients to buttons or text. Gradients are allowed only as soft pastel listing-photo placeholders.
