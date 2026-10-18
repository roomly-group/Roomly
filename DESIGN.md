---
version: alpha
name: Roomly
description: Roomly's "Green Shutter" identity (Nunito Sans, deep pine greens on plaster cream, one amber spark) in a photo-first marketplace structure built around the distance to your university. Pill search bar with a single orb, category strip, frameless listing grid, and a listing page with a sticky request rail that becomes a bottom bar on mobile. Every colour, font, radius and shadow is Roomly's, and every number on screen is real.

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
  terracotta-mist: "#f6e4dc"
  plaster-cream: "#f1efe8"
  card-paper: "#faf9f4"
  ink: "#2c2c2a"
  sage-gray: "#527067"
  sage-placeholder: "#82978e"
  pine-deep-text: "#265c4d"
  line-mint: "#e1ebe4"
  field-border: "#c8ddd2"
  outline-border: "#b7d7ca"
  hairline: "#0850411a"
  chip-veil: "#f1efe8e0"
  scrim: "#08504180"

typography:
  display:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "clamp(3rem, 8vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 2.75rem)"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  section:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "clamp(1.375rem, 3vw, 1.75rem)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  distance-display:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "4rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.05em"
  title:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 900
    lineHeight: 1.4
  card-title:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 800
    lineHeight: 1.3
  price-lg:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 900
    letterSpacing: "-0.03em"
  price:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 900
  body:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  nav-link:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 800
    lineHeight: 1.25
  label:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 800
    lineHeight: 1.25
  search-label:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 900
    lineHeight: 1.3
  meta:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    lineHeight: 1.33
  badge:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 900
    lineHeight: 1.2
  tag:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 900
    letterSpacing: "0.1em"
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
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  gutter: "24px"
  xl: "28px"
  2xl: "56px"
  3xl: "64px"

components:
  button-primary:
    backgroundColor: "{colors.shutter-green}"
    textColor: "{colors.mint-mist}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.deep-pine}"
  button-secondary:
    backgroundColor: "{colors.mint-mist}"
    textColor: "{colors.deep-pine}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.mint-wash}"
  button-outline:
    backgroundColor: transparent
    textColor: "{colors.deep-pine}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  button-amber:
    backgroundColor: "{colors.sun-amber}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "52px"
  button-amber-hover:
    backgroundColor: "{colors.sun-amber-hover}"
  button-destructive:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.card-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  top-nav:
    backgroundColor: "{colors.plaster-cream}"
    textColor: "{colors.deep-pine}"
    typography: "{typography.nav-link}"
    height: "80px"
  product-tab-active:
    backgroundColor: "{colors.mint-mist}"
    textColor: "{colors.deep-pine}"
    typography: "{typography.nav-link}"
    rounded: "{rounded.md}"
    padding: "8px 16px 8px 8px"
  product-tab-inactive:
    backgroundColor: transparent
    textColor: "{colors.sage-gray}"
    typography: "{typography.nav-link}"
    rounded: "{rounded.md}"
    padding: "8px 16px 8px 8px"
  new-tag:
    backgroundColor: "{colors.deep-pine}"
    textColor: "{colors.mint-mist}"
    typography: "{typography.tag}"
    rounded: "{rounded.full}"
    padding: "3px 7px"
  search-bar-pill:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "66px"
  search-field-label:
    textColor: "{colors.deep-pine}"
    typography: "{typography.search-label}"
  search-field-value:
    textColor: "{colors.sage-gray}"
    typography: "{typography.label}"
    padding: "6px 24px"
  search-orb:
    backgroundColor: "{colors.sun-amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "50px"
  search-orb-compact:
    backgroundColor: "{colors.shutter-green}"
    textColor: "{colors.mint-mist}"
    rounded: "{rounded.full}"
    size: "36px"
  category-tab-active:
    textColor: "{colors.deep-pine}"
    typography: "{typography.meta}"
  category-tab-inactive:
    textColor: "{colors.sage-gray}"
    typography: "{typography.meta}"
  listing-card-photo:
    rounded: "{rounded.lg}"
  listing-card-title:
    textColor: "{colors.deep-pine}"
    typography: "{typography.card-title}"
  listing-card-distance:
    textColor: "{colors.deep-pine}"
    typography: "{typography.label}"
  listing-card-meta:
    textColor: "{colors.sage-gray}"
    typography: "{typography.body-sm}"
  listing-card-price:
    textColor: "{colors.shutter-green}"
    typography: "{typography.price}"
  photo-chip:
    backgroundColor: "{colors.chip-veil}"
    textColor: "{colors.deep-pine}"
    typography: "{typography.badge}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  save-heart:
    backgroundColor: "{colors.chip-veil}"
    textColor: "{colors.shutter-green}"
    rounded: "{rounded.full}"
    size: "44px"
  distance-card:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.deep-pine}"
    typography: "{typography.distance-display}"
    rounded: "{rounded.lg}"
    padding: "24px 28px"
  trust-card:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "24px"
  host-card:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  request-card:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  mobile-request-bar:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    height: "76px"
  amenity-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "12px 0"
  distance-row:
    textColor: "{colors.deep-pine}"
    typography: "{typography.label}"
    padding: "12px 0"
  date-picker-day:
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "38px"
  date-picker-day-selected:
    backgroundColor: "{colors.deep-pine}"
    textColor: "{colors.mint-mist}"
    rounded: "{rounded.full}"
    size: "38px"
  date-picker-range:
    backgroundColor: "{colors.mint-mist}"
  input:
    backgroundColor: "{colors.plaster-cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
    height: "48px"
  input-helper-error:
    textColor: "{colors.terracotta}"
    typography: "{typography.body-sm}"
  status-pill-pending:
    backgroundColor: "{colors.mint-mist}"
    textColor: "{colors.ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  status-pill-accepted:
    backgroundColor: "{colors.mint-mist}"
    textColor: "{colors.deep-pine}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  status-pill-declined:
    backgroundColor: "{colors.terracotta-mist}"
    textColor: "{colors.terracotta}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  status-pill-cancelled:
    backgroundColor: "{colors.plaster-cream}"
    textColor: "{colors.sage-gray}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  request-queue-row:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  university-link:
    textColor: "{colors.deep-pine}"
    typography: "{typography.label}"
  panel-mint:
    backgroundColor: "{colors.mint-wash}"
    textColor: "{colors.pine-deep-text}"
    rounded: "{rounded.panel}"
  panel-amber:
    backgroundColor: "{colors.sun-amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  panel-pine:
    backgroundColor: "{colors.deep-pine}"
    textColor: "{colors.mint-mist}"
    rounded: "{rounded.panel}"
  footer:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
  legal-band:
    textColor: "{colors.sage-gray}"
    typography: "{typography.body-sm}"
  bottom-tab-bar:
    backgroundColor: "{colors.card-paper}"
    height: "76px"
  bottom-tab-active:
    textColor: "{colors.shutter-green}"
    typography: "{typography.meta}"
  bottom-tab-inactive:
    textColor: "{colors.sage-gray}"
    typography: "{typography.meta}"
---

<!-- Target structure: the marketplace layout below is not built yet. Tokens match the shipped code. Re-run /impeccable document after the build to record the shipped components and regenerate .impeccable/design.json. -->

# Design System: Roomly

## Overview

**Creative North Star: "The Green Shutter"**

An Italian student flat on a sunny morning: green shutters, plaster walls, light on a tidy desk. The structure is a photo-first marketplace: search at the top, a strip of quick filters, a dense grid of listings, and a listing page with a sticky request rail. The identity is entirely Roomly's.

The marketplace structure brings the pill search bar ending in one round orb, the icon category strip, frameless photo-first cards four to a row, the 1+4 photo mosaic, a sticky request card that becomes a bottom bar on phones, a university link grid and a light three-column footer. The one oversized number on the listing page is the **distance to the student's university**, not a rating: the university is the centre of the map, and the product has no reviews yet.

Roomly keeps Nunito Sans at 900 for headings, the pine/mint/cream palette, one amber spark per view, pine-tinted layered shadows, 12/16/32px rounding, colour-block panels, and the eyebrow → headline → description intro.

**Key Characteristics:**
- Plaster Cream page, Card Paper surfaces, Deep Pine voice, Shutter Green actions, one Sun Amber moment per view.
- Pill search bar (Università · Budget mensile, plus Ingresso once listings carry dates) ending in an amber orb on search screens; the orb turns Shutter Green in compact headers where another action owns the amber.
- Listing cards are frameless in grids: a 16px-rounded photo plus four lines of meta. Card Paper surfaces are kept for distance, trust, host, request and empty-state cards.
- Distance to the university is a first-class field on every card and the loudest number on the listing page.
- Prices are monthly and formatted for the reader's language; dates are entry date + duration, never check-in/check-out.
- Nothing on screen is invented: ratings, badges, counts and metrics appear only when real data backs them.

### Named Rules

**The Truth Rule.** Every number, badge and claim comes from real data. No placeholder ratings ("★ 0.0"), sample listings, "students are saving" headlines, health pings dressed as status, or hardcoded percentages. When the data does not exist yet, the component shows its honest empty state or is not rendered. This carries PRODUCT.md's commitment: no testimonials, counts, reviews or partners may be fabricated.

## Colors

All colours come from the Roomly token list. The source marketplace's own palette (pinkish-red accent, pure white canvas, neutral greys, blue legal links, black stars, black scrim) is fully replaced.

| Structural role | Roomly token |
|---|---|
| Page canvas | Plaster Cream (#f1efe8) |
| Card, popover, dropdown, sticky bars, footer | Card Paper (#faf9f4) |
| Headlines, listing titles, distance line, active text | Deep Pine (#085041) |
| Primary buttons, prices, links, saved heart | Shutter Green (#0f6e56) |
| The one key action per view (search orb, "Richiedi la stanza", "Nuovo annuncio") | Sun Amber (#ef9f27) with Ink text |
| Rating stars (only with real reviews), pending dots | Sun Amber, the only allowed repeats |
| Secondary text, meta lines, inactive tabs, search prompts | Sage Gray (#527067) |
| Example text inside labelled inputs | Sage Placeholder (#82978e) |
| Dividers / input strokes / outline strokes | Line Mint / Field Border / Outline Border |
| Card hairline border | Hairline, Deep Pine at 10% (#0850411a) |
| Chips and the save heart on photos | Chip Veil, Plaster Cream at 88% (#f1efe8e0) |
| Active tab pill, chips, icon wells, pending and accepted pills | Mint Mist (#e1f5ee) |
| Errors, declined requests, destructive buttons | Terracotta (#a74b32) on Terracotta Mist (#f6e4dc) or Card Paper |
| Modal scrim | Scrim, Deep Pine at 50% (#08504180) |

Contrast checks on the pairs that matter: Sage Gray on Plaster Cream 4.7:1, on Card Paper 5.1:1. Shutter Green on Plaster Cream 5.4:1. Ink on Sun Amber 6.4:1. Mint Mist on Shutter Green 5.5:1. Mint Wash on Deep Pine 6.3:1. Terracotta on Terracotta Mist 4.6:1. Two pairs fail and are restricted: Sage Placeholder on cream is 2.7:1, and Amber Ink on Sun Amber is 3.7:1.

### Named Rules

**The One Sun Rule.** One amber call to action per screen. Home and search: the search orb. Listing page: "Richiedi la stanza". Owner dashboard: "Nuovo annuncio". Everywhere else the orb is Shutter Green. Stars and pending dots are the only repeats. The amber owners panel is a panel, not a button: its button is Shutter Green. Decorative amber (circles, stat numbers, icons) is not allowed.

**The No-Grey Rule.** No cool greys, no pure black, no pure white: footers, dropdowns and menus are Card Paper, never `#fff`. Even the modal scrim is pine.

**The Token Rule.** A new hex in a component is a bug. Components reference tokens through the theme variables in `frontend/src/index.css` (`bg-primary`, `text-muted-foreground`…), not arbitrary `bg-[#…]` values.

**The Readable Prompt Rule.** Text that carries meaning (search segment prompts, hints, helper text) uses Sage Gray. Sage Placeholder is only for example text inside an input that already has a visible label. Amber Ink is never used for text on Sun Amber; body copy on amber is Ink.

## Typography

**Font:** Nunito Sans (self-hosted, 400–900), sans-serif fallback. One family for everything.

**Character:** headings stay extra-black and tightly tracked. A marketplace has many more headings than a landing page, so a smaller **Section** level and a lighter **Card title** keep the grid calm.

| Token | Size | Weight | Use |
|---|---|---|---|
| `display` | 48 → 72px | 900 | Hero panels only, one per page |
| `headline` | 36 → 44px | 900 | Page intro headline (home, listing title, dashboard greeting) |
| `section` | 22 → 28px | 900 | Repeated section titles ("Dove vuoi studiare?", "Cosa trovi") |
| `distance-display` | 64px | 900 | The distance to the university on the listing page: the one loud number |
| `title` | 18px | 900 | Panel and card headings, host name, rating (when reviews exist) |
| `card-title` | 16px | 800 | Listing card titles in the grid |
| `price-lg` | 28px | 900 | Price in the request card |
| `price` | 16px | 900 | Price on listing cards |
| `body` | 15px | 400 | Descriptions, amenity rows |
| `body-sm` | 14px | 400 | Card meta, reviews, footer links |
| `nav-link` | 15px | 800 | Product tabs |
| `label` | 14px | 800 | Buttons, form labels, distance line, university names |
| `search-label` | 12px | 900 | Search segment labels |
| `meta` | 12px | 800 | Category labels, availability lines, tab bar labels |
| `badge` | 12px | 900 | Chips on photos, status pills |
| `tag` | 10px | 900, +0.1em, uppercase | "NUOVO" tags |
| `eyebrow` | 11px | 900, +0.15em, uppercase | Kicker above every intro and section |

### Named Rules

**The Eyebrow-Then-Headline Rule.** Every page intro and major section: eyebrow, then a 900 heading, then an optional Sage description.

**The Weight Floor Rule.** Interactive text never below 700; only body copy at 400.

**The One Loud Number Rule.** On the listing page, only the distance uses `distance-display`. Prices stay at `price-lg`; a rating, when real reviews exist, sits at `title` inside the trust card.

**The Locale Rule.** Prices and distances are formatted with `Intl` in the reader's language: "420 €/mese" and "1,2 km" in Italian, "€420/month" and "1.2 km" in English. Never hardcode the symbol position or the decimal mark.

## Layout

- **Container:** max 1320px with 32px gutters (20px under 640px). Listing detail narrows to 1120px.
- **App shell:** a full-height flex column; `main` grows so the footer always sits at the bottom of the viewport on short pages.
- **Header:** two rows on search screens (logo · product tabs · account, then the search pill), about 168px; one 80px row with a compact search pill elsewhere. Sticky, Plaster Cream at 95% with blur, Line Mint bottom border.
- **Listing grid:** 4 columns from 1180px, 3 from 900px, 2 from 640px, 1 below. Gap 40px vertical, 24px horizontal. Reduce columns, never reflow rows.
- **Listing detail:** main column (`flex: 999 1 520px`) and a 340px sticky request rail, 64px apart.
- **Owner dashboard:** request queue as the main column (`flex: 999 1 520px`), listings as a 380px secondary column; stacked on mobile with the queue first.
- **University grid:** 6 → 4 → 3 → 2 columns.
- **Rhythm:** 64px between major sections; 40px between blocks inside the listing page; card meta stacks in 3px steps.

### Responsive behaviour

| Name | Width | Key changes |
|---|---|---|
| Mobile | < 640px | Search collapses to one pill that opens a full-screen search sheet; product tabs move into a sheet; cards 1-up; university grid 2 columns; request card becomes the bottom bar; bottom tab bar appears. |
| Tablet | 640–900px | Cards 2-up; tabs hidden behind the menu; request card stacks under the content and the bottom bar stays. |
| Laptop | 900–1180px | Cards 3-up; full header; request rail sticky. |
| Desktop | > 1180px | Cards 4-up; full two-row header; university grid 6 columns. |

Touch targets: primary actions 48px+, every other control 44px+, date days 38px. Sticky bottom bars add `env(safe-area-inset-bottom)`. Respect `prefers-reduced-motion`: no hover rises, floats or infinite animations.

## Elevation & Depth

Three pine-tinted shadow tokens (also defined as `--shadow-sm/md/lg` in `index.css`); colour-block panels carry none. One-off `rgba()` shadows map to the nearest token.

- **Rest** `0 2px 7px hsl(166 81% 17% / .06)`: host, trust and distance cards, photo chips, account button, request queue rows.
- **Lift** `0 10px 28px hsl(166 81% 17% / .09)`: card photo on hover (with a 4px rise), the request card, menus.
- **Float** `0 20px 48px hsl(166 81% 17% / .13)`: the search pill, the floating tilted card, dialogs, the mobile map pill.

Content cards carry a 1px Hairline border on top of their shadow.

## Shapes

- **8px:** chips sitting on photos.
- **12px:** every control: buttons, inputs, product tabs, icon tiles.
- **16px:** listing photos, cards, the photo mosaic, map tile, queue rows.
- **20px:** icon wells, the mobile content sheet.
- **32px:** colour-block panels.
- **Full:** search pill and orb, save heart, avatars, pills, date-picker days.

The brand mark is a pine square with corners 11/11/11/3px tilted −5°; it is reused as the "home" pin on maps.

## Components

### Focus states
Every interactive element shows `:focus-visible`: a 2px Shutter Green outline with a 2px offset (Mint Mist on Deep Pine or amber surfaces). Inputs use their own focus treatment (below). Never `outline: none` without a replacement.

### Buttons
Primary Shutter Green, secondary Mint Mist, outline (Outline Border stroke, hover to Shutter Green stroke on Mint Mist), ghost, amber (the one per view), destructive Terracotta for delete and release confirmations; a destructive action is never styled as a positive green button. Hover darkens over 200ms; press scales to 0.98; disabled is 50% opacity.

### Search
**`search-bar-pill`**: Card Paper, full radius, Float shadow, Hairline border, 66px. Segments are divided by 1px Line Mint rules:
- **Università**: a GraduationCap icon, prefilled with the student's university from their profile.
- **Budget mensile**.
- **Ingresso**: added only once listings carry availability dates.

Labels are `search-label` Deep Pine; prompts and values are Sage Gray.

**`search-orb`**: 50px amber circle with an Ink magnifier. **`search-orb-compact`**: 36px Shutter Green, used on every screen where another action owns the amber.

Behaviour:
- A search applies when the orb is pressed or a suggestion is chosen.
- Typed text that hasn't resolved to a university shows an inline hint ("Scegli un'università dall'elenco"). A field that looks filled must never silently not filter.
- Budget applies on blur or after a 400ms pause, and the previous results stay on screen while new ones load.
- The active search is written to the URL, so back, refresh and share keep it.
- Results open with a line stating what is shown: "Stanze entro 80 km dal Politecnico di Milano, dalla più vicina".
- Mobile: one tappable pill ("Dove vuoi studiare?") plus a round outline filter button; both open sheets.

### Top navigation
Logo left, product tabs centre, account right.

**Product tabs**: an icon tile plus a label. The active tab is a Mint Mist pill with a Mint Wash icon tile. Inactive tabs are Sage with a Line Mint tile. Tabs exist only for surfaces that are live. Lifestyle matching ("Coinquilini") gets a tab, with a **`new-tag`**, only when it ships.

**Account**: an outline pill with a menu icon and a Shutter Green avatar. The hamburger exposes `aria-expanded`.

### Category strip
Built from real listing data:
- **Tipologia** (`tipologia_proprieta`): Tutte · Stanze · Appartamenti · Residenze.
- **Taglio** for apartments (`taglio_appartamento`): Monolocali, Bilocali, and so on.

Each item is a 24px icon (stroke 1.8) above a `meta` label. Active: Deep Pine with a 3px Deep Pine bottom bar. Inactive: Sage, Deep Pine on hover. The selected state is exposed with `aria-pressed` or tab semantics.

A "Filtri" outline button closes the row. It opens a sheet with Arredata, Spese incluse, Animali ammessi and Fumatori ammessi.

### Listing card
Frameless. The whole card is one link; the save heart is a sibling button over the photo, never nested inside the link.

**Photo**: 20:19, 16px radius, Lift plus a 4px rise on hover. On the photo:
- the "Preferita dagli studenti" chip, top-left, only when real persisted save counts back it;
- the save heart, top-right;
- carousel dots, bottom-centre.

**Meta below the photo**:
1. `card-title`, followed on the same line by an amber star rating when the listing has 3 or more real reviews. With fewer reviews there is no rating and no "0.0".
2. **Distance**: Deep Pine `label` with a GraduationCap icon, "1,2 km dal Politecnico di Milano". It names the searched university, or the nearest one when no university was searched. This is the line that matters most.
3. Zone, in Sage with a MapPin icon.
4. Availability, with a 6px status dot: "Disponibile ora" (Shutter Green dot) or "Non disponibile" (Sage dot). Never "In arrivo" for a rented room.
5. Price, Shutter Green `price` + "/mese", with "spese incluse" when `spese_incluse` is not empty.

Without photos, use the pastel shutter-window placeholder, chosen deterministically from the listing id so the card and the detail page match.

### Listing detail

**Intro**:
- Eyebrow = city · zone; headline = listing name. The title never sits on top of a photo.
- Condividi and Salva as ghost buttons.

**1+4 photo mosaic** with a "Mostra tutte le foto" Card Paper button. It degrades with fewer photos:
- 1 photo: a single 16:9 image;
- 2–4 photos: one large image plus the rest;
- no photos: the placeholder.

**Distance card**, the loud moment:
- `distance-display` "1,2 km", then "dal Politecnico di Milano" in `label`.
- Then distance rows (place · time · mode) once travel times exist, and a map tile with the brand-mark pin when coordinates exist.

**Trust card**, only true facts:
- "Proprietario verificato da Roomly", with a "Cosa verifichiamo" disclosure that says what was checked.
- Response time, only when it is measured from real conversations.
- Rating, with five amber stars at `title`, only with 3 or more real reviews. Otherwise "Ancora nessuna recensione".

**Body**: the host card, the description, amenities in two columns (from the feature groups), house rules (pets, smoking), then reviews in two columns (name, course, month). Reviews are omitted while there are none.

**`request-card`**, the sticky right rail:
- `price-lg` price and a spese pill.
- A Plaster Cream field group: Ingresso · Durata, once listings carry dates; Contratto only when contract management is live.
- The amber "Richiedi la stanza" button.
- Under the button, the request lifecycle in three short steps: richiesta inviata → il proprietario accetta o rifiuta → continuate in chat.
- The limits, stated before sending: "Puoi avere una sola richiesta accettata alla volta".
- The cost breakdown: rent, utilities, and deposit when the owner provides it. No Roomly fee and no "first payment" total until the product defines a fee or a payment flow.

States:
- **Unavailable listing**: one signal only. The card says "Stanza non disponibile" in Sage, shows no amber button, and offers a secondary "Vedi stanze simili".
- **The owner viewing their own listing**: the card becomes "Questo è il tuo annuncio" with a secondary "Modifica".

**`mobile-request-bar`** below 900px: price + entry-date link on the left, amber "Richiedi" on the right, Line Mint top border, safe-area padding.

**Request dialog**: a Radix Dialog on desktop and a bottom sheet (Drawer) on mobile.
- `role="dialog"`, focus trapped, closes on Esc and on scrim click, and the close button has a label.
- The send button stays visible above the on-screen keyboard.
- After sending, it confirms "Richiesta inviata" and links to the chat.

### Date picker
38px circular days. Selected: Deep Pine fill, Mint Mist text. Range fill: Mint Mist. Today: an Outline Border ring. The week starts on Monday. It is used only once listings carry availability dates.

### Forms
Plaster Cream fill, Field Border stroke, 12px radius, 48px tall, always with a visible label.
- **Focus**: Shutter Green border plus a 3px Mint Wash ring at 40%.
- **Error**: Terracotta border and friendly Terracotta helper text with a next step.

### Status pills
Request states always pair text with an icon or dot, never colour alone:
- `in_attesa`: Mint Mist, Ink text, amber dot.
- `accettata`: Mint Mist, Deep Pine text, check icon.
- `rifiutata`: Terracotta Mist, Terracotta text.
- `annullata`: Plaster Cream, Sage text.

### Owner dashboard
An Operate surface: the owner's job is answering requests.

**Intro**: "Ciao, {nome}". The name comes from the same account source as the header.

**Main column, "Richieste da gestire"**: one row per request (`request-queue-row`).
- Each row shows the student's avatar and name, their course when shared, the listing title, the date and a status pill.
- Actions: Accetta (primary), Rifiuta (outline), Apri chat (ghost).
- Empty state: "Nessuna richiesta in attesa".

**Secondary column, "I tuoi annunci"**:
- Each row links to the public listing, with a menu for Modifica / Vedi / Elimina.
- Status pill: Disponibile or Affittata. Rows are spaced 12px apart.

**Counts**: only figures computed from real data (annunci attivi, richieste in attesa). No views, response rate, earnings or rating until they are tracked. The amber action is "Nuovo annuncio".

### Colour-block panels
- **Deep Pine "Perché Roomly" band**: true claims only (verified owners, direct conversation).
- **Amber owners panel**: Ink headline and Ink body, a Shutter Green button, and a tilted floating card on desktop. The card shows a real listing, or a contract only once contract management is live.
- **Mint Wash hero**: only where a marketing hero is needed.

Concentric rings may bleed off a corner.

### Footer
Card Paper, Line Mint top border, three columns (Assistenza / Proprietari / Roomly). The legal band is Sage, with the language selector; Roomly is euro-only, so there is no currency selector.

### Mobile tab bar
- **Students**: Esplora · Preferiti · Messaggi · Profilo. Request status lives inside the conversation, so an amber dot on Messaggi marks a request waiting on the student. Preferiti appears only once saves persist; until then the heart is not shown.
- **Owners**: Dashboard · Messaggi · Profilo.

Active tab Shutter Green, inactive Sage. A Deep Pine "Mappa" pill floats above the bar with the Float shadow once the map view exists.

## Do's and Don'ts

### Do:
- **Do** take every colour, radius and shadow from the tokens above, through the theme variables.
- **Do** let photo, distance to the university and monthly price lead every listing.
- **Do** keep exactly one amber action per view and switch the orb to green elsewhere.
- **Do** use `section` for repeated section titles and keep `headline` for the page intro.
- **Do** keep listing cards frameless in grids and use Card Paper for content cards.
- **Do** show an honest empty state ("Ancora nessuna recensione", "Nessuna richiesta in attesa") when data is missing.
- **Do** give every interactive element a visible focus state and a 44px+ touch target.
- **Do** format prices and distances with the reader's locale.

### Don't:
- **Don't** carry over the source marketplace's accent colour, wordmark, custom typeface, laurel ornaments, illustrated 3D tab icons or sub-brand colours.
- **Don't** use nightly prices, check-in/check-out or guest counts: Roomly is monthly, entry date + duration.
- **Don't** show a rating, review count, "Preferita dagli studenti", response time, view count, earnings or percentage that isn't computed from real data.
- **Don't** present contract management, lifestyle matching or a Roomly service fee as live until PRODUCT.md confirms them.
- **Don't** render stars in Ink; Roomly stars are amber.
- **Don't** set text over photos, except chips on the Chip Veil.
- **Don't** use grey or black shadows, pure white surfaces or blue links.
- **Don't** set headings below 800 or drop the negative tracking on 900 headings.

## Data Dependencies

Components that need data the product does not have yet. Until it exists, the component follows the Truth Rule (empty state or not rendered).

| Component | Needs | Today |
|---|---|---|
| Distance line, distance card | listing coordinates + university | Yes: `distanceKm` in university search; nearest university otherwise |
| Distance rows (time · mode), map tile | travel times; map styling | Coordinates yes; travel times no |
| Ingresso segment, date picker, Durata | availability dates on listings | No |
| Deposit in the cost breakdown | deposit field | No (included utilities: yes, `spese_incluse`) |
| Rating, reviews, stars | reviews | No (`rating` is always 0) |
| Save heart, Preferiti tab, "Preferita dagli studenti" | persisted saves | No (local state only) |
| Response time | measured from conversations | Not computed |
| Contratto field, floating contract card | contract management | Open in PRODUCT.md |
| Roomly fee, first-payment total | a defined business model | Not defined |
| Owner metrics beyond counts | view and response tracking | No (the endpoint returns mock data) |

Design gaps still open: map view beyond the static tile (listing markers, clusters), loading skeletons and the carousel's swipe states, the filters sheet and the full-screen mobile search sheet.
