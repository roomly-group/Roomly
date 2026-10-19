---
version: alpha
name: Roomly
description: A student's pocket map of the city. Pale map paper, a pine band at top and bottom, flat sheets edged by hairlines, Nunito Sans at its extremes, and one signature move — every distance to the university drawn as a scale-true route segment, la tratta.

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
  map-paper: "#f2f6f3"
  card-paper: "#fcfdfb"
  ink: "#2c2c2a"
  sage-gray: "#527067"
  sage-placeholder: "#82978e"
  pine-deep-text: "#265c4d"
  line-mint: "#e1ebe4"
  field-border: "#6f8b80"
  outline-border: "#b7d7ca"
  hairline: "#0850411a"
  chip-veil: "#fcfdfbe6"
  scrim: "#08504180"

typography:
  display:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "clamp(2.75rem, 6vw, 4.25rem)"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  title-lg:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "clamp(1.5rem, 2.6vw, 1.875rem)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  lede:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 800
    lineHeight: 1.3
  figure-lg:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "clamp(3rem, 7vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.05em"
  figure:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 900
    letterSpacing: "-0.01em"
  map-label:
    fontFamily: "Nunito Sans, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 800
    letterSpacing: "0.08em"

rounded:
  sheet: "4px"
  control: "8px"
  full: "9999px"

spacing:
  hair: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "72px"

components:
  shell-band:
    backgroundColor: "{colors.deep-pine}"
    textColor: "{colors.mint-mist}"
    typography: "{typography.label}"
    height: "72px"
  nav-link:
    textColor: "{colors.mint-mist}"
    padding: "8px 4px"
  search-sentence:
    backgroundColor: "{colors.deep-pine}"
    textColor: "{colors.mint-mist}"
    typography: "{typography.title}"
    height: "64px"
  search-field:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    height: "48px"
  button-action:
    backgroundColor: "{colors.sun-amber}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-primary:
    backgroundColor: "{colors.shutter-green}"
    textColor: "{colors.mint-mist}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.deep-pine}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-destructive:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.card-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  sheet:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "24px"
  legend-tab:
    textColor: "{colors.sage-gray}"
    typography: "{typography.label}"
    padding: "10px 0"
  legend-tab-active:
    textColor: "{colors.deep-pine}"
    typography: "{typography.label}"
  listing-photo:
    backgroundColor: "{colors.line-mint}"
    rounded: "{rounded.sheet}"
  listing-title:
    textColor: "{colors.deep-pine}"
    typography: "{typography.title}"
  listing-price:
    textColor: "{colors.deep-pine}"
    typography: "{typography.figure}"
  tratta:
    textColor: "{colors.deep-pine}"
    typography: "{typography.label}"
    height: "20px"
  tratta-figure:
    textColor: "{colors.deep-pine}"
    typography: "{typography.figure-lg}"
  ruled-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "16px 0"
  input:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "48px"
  input-helper-error:
    textColor: "{colors.terracotta}"
    typography: "{typography.body-sm}"
  status-pending:
    textColor: "{colors.ink}"
  status-accepted:
    textColor: "{colors.ink}"
  status-declined:
    textColor: "{colors.terracotta}"
  status-cancelled:
    textColor: "{colors.sage-gray}"
  tab-bar:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.sage-gray}"
    typography: "{typography.label}"
    height: "68px"
  tab-bar-active:
    textColor: "{colors.deep-pine}"
  footer-band:
    backgroundColor: "{colors.deep-pine}"
    textColor: "{colors.mint-mist}"
    typography: "{typography.body-sm}"
---

# Design System: Roomly

## Overview

**Creative North Star: "La pianta" (the pocket city map)**

Roomly is the map a student unfolds the week before term: the university is marked, the streets are real, and every room on it sits at a measured distance from the lecture halls. The interface borrows four things from that map and nothing else: its paper and park colours, its dense and tabular way of setting figures, its legend, and one signature move — **la tratta**, the route segment that draws each distance to scale. Navigation, forms and controls stay the standard web ones; the map never dresses the screen as a map.

The shell is committed: a pine band at the top and at the bottom of every page, pale map paper in between. Content sits flat on the paper. Sheets (forms, the request rail, dialogs) are card paper edged by a 1px hairline; nothing casts a soft shadow except things that float over the page (menus, dialogs, the phone's bottom bar). Corners are crisp: 4px for sheets and photos, 8px for controls.

Type is one family used at its extremes. Nunito Sans 900 for the one page title and for figures (km, euro, counts), 800 for titles and labels, 400 for reading text. There are no kickers: a heading carries its own weight and is never preceded by a small uppercase label.

The world was dealt by an impeccable concept roll (seed:144ee22b94cce21c, assigned candidate 6 of 7) and built unattended; the direction contract lives in `.impeccable/surfaces/frontend-src-pages-home-tsx.md`.

**Key Characteristics:**
- Pine band header and footer, map-paper page, card-paper sheets with hairlines, no soft shadows on content.
- La tratta: distance to the university drawn as a scale-true segment (home dot → line → campus square) on a fixed 0–5 km scale.
- A map legend instead of an icon strip: property types as square swatches with real counts.
- Figures are the loudest type: tabular, 900, aligned on a shared baseline with their titles.
- One amber action per view; sun amber means "do this", never decoration.
- Copy is concrete Italian addressed to "tu": it names places, numbers and actions, never slogans.

### Named Rules

**The Truth Rule.** Every number, badge and claim comes from real data. No placeholder ratings, sample listings, invented counts, fallback numbers or hardcoded percentages. Missing data shows an honest empty state or is not rendered. Illustrations on the public waitlist that show the mechanism are labelled "Esempio".

**The No-Kicker Rule.** No small uppercase label above a heading, anywhere. Section context lives in the heading's own words. Uppercase letterspaced type is reserved for place names inside map illustrations and scale ticks (`map-label`).

**The Flat Paper Rule.** Content never floats. Grouping comes from hairlines, alignment and the paper/sheet tonal step. A soft shadow is allowed only on elements that physically sit above the page: menus, popovers, dialogs, the sticky bottom request bar.

## Colors

The pinned palette, read as an Italian city map: paper ground, park greens, the amber of a main road, the terracotta of built blocks.

### Primary
- **Deep Pine** (#085041): the shell bands (header, footer), page titles and headings, prices and km figures, the campus square of the tratta, active legend tab underline.
- **Shutter Green** (#0f6e56): primary buttons, links, the tratta's route line and home dot, focus rings on paper, the persiana placeholder slats.

### Secondary
- **Mint Wash** (#9fe1cb): the active nav underline on the pine band, text selection, park fills in illustrations, the residenza legend swatch.
- **Mint Mist** (#e1f5ee): all text and icons on pine, status pills, chips, focus rings on pine.

### Tertiary
- **Sun Amber** (#ef9f27): the single action of a view (Cerca, Richiedi la stanza, Nuovo annuncio, Registrati). Ink text on it. Pending-request dots are the only other use.
- **Terracotta** (#a74b32) on **Terracotta Mist** (#f6e4dc): errors, declined requests, destructive confirmations; built blocks in the waitlist map illustration.

### Neutral
- **Map Paper** (#f2f6f3, token `ground`): the page. A faintly green, near-neutral ground like the paper of a printed city plan. It replaced the earlier warm plaster cream (#f1efe8): a warm cream ground is the most common machine-made look, and the map world never asked for it.
- **Card Paper** (#fcfdfb): sheets, inputs, the tab bar, menus.
- **Ink** (#2c2c2a): reading text. **Sage Gray** (#527067): secondary text and labels (5:1 on map paper). **Sage Placeholder** (#82978e): defined in `@theme` but not used; input placeholders are set in Sage Gray.
- **Line Mint** (#e1ebe4): row dividers on paper. **Hairline** (#0850411a): sheet edges. **Field Border** (#6f8b80): input strokes, 3:1 against card paper and map paper so a field reads as a field (WCAG 1.4.11). **Outline Border** (#b7d7ca): secondary-button strokes.
- **Scrim** (#08504180): behind dialogs.

### Named Rules

**The One Sun Rule.** One amber action per view. Amber never decorates: no amber icons, dots, numbers or rings except the pending-request dot.

**The No-Grey Rule.** No cool greys, no pure black, no pure white. Photo lightboxes use Ink at 95%.

**The Token Rule.** Components use the theme utilities generated from the `@theme` block in `frontend/src/index.css` (`bg-pine`, `text-sage`, `border-line`, `rounded-sheet`…). A raw hex in a component is a bug.

## Typography

**Family:** Nunito Sans (self-hosted, 400–900) for everything, sans-serif fallback.

**Character:** a rounded humanist sans pushed to its extremes. Titles at 900 with tight tracking feel spoken; labels at 800 feel printed on a sign; body at 400 reads easily. Figures always tabular.

### Hierarchy
- **Display** (900, 44 → 68px, lh 0.98, −0.045em): the one page title. Never inside cards.
- **Page title** (900, 36 → 52px, lh 0.98, −0.045em): the one title of a working screen (search, listing, dashboard, messages, profile, forms, auth).
- **Title-lg** (900, 24 → 30px, lh 1.05, −0.035em): section titles. Sentence case, no kicker.
- **Title** (800, 17px): listing titles, row titles, sheet headings.
- **Lede** (400, 19px, lh 1.55): the one sentence under a page title.
- **Body** (400, 16px, lh 1.6): reading text, max 65ch. **Body-sm** (400, 14px): meta and helper text.
- **Label** (800, 13px): buttons, nav, form labels, column headers, legend tabs. Sentence case.
- **Figure-lg** (900, 48 → 72px, −0.05em, tabular): the km on a listing page, the waitlist position.
- **Figure** (900, 17px, tabular): prices and km in cards and rows.
- **Map-label** (800, 11px, +0.08em, uppercase): place names in map illustrations and tratta scale ticks only.

### Named Rules

**The Baseline Pair Rule.** A title and its figure share one baseline: listing title left, price right; row title left, count right. Figures align right in every list.

**The Weight Floor Rule.** Interactive text never below 800; reading text stays at 400.

## Layout

- **Container:** max 1320px, 20px gutters on phones, 32px from 1024px. Reading pages (static, forms) narrow to 760px of text inside the same container, left-aligned.
- **Grid:** 12 columns. Page heads are asymmetric: the title takes columns 1–8, the result sentence or page actions sit on columns 9–12 on the title's last baseline. Never centre a page head.
- **Section head:** title-lg on the left, a hairline running to the right edge of the container, an optional text link at the end of the line. On phones a head with a link stacks: title, then the link; the hairline only runs when they share a line.
- **Page heads with results:** the title on the left; on the right baseline the result sentence ("5 stanze disponibili su Roomly", "2 stanze entro 80 km, dalla più vicina"). A search by university adds the tratta's scale key under it (the 0–5 km track, "Distanza dal campus, scala 0–5 km"), because only those cards draw a tratta. Never a hero metric.
- **Reading pages:** text at reading measure on columns 1–7; columns 9–12 hold an aside: the clause index on legal pages (sticky, from 1024px), the values on Chi siamo, the owners' note on Contatti.
- **Listing grid:** 1 → 2 (640px) → 3 (900px) → 4 (1180px) columns, gap 24px horizontal and 40px vertical. Columns drop, rows never reflow.
- **Listing page:** main column and a 340px sheet rail, 64px apart; below 900px the rail becomes the sticky bottom bar.
- **Lists:** ruled rows (Line Mint 1px between rows), fixed columns, figures right-aligned. Rows are ranked by one number when one number matters (distance, date).
- **Rhythm:** 8px base; 24px inside groups, 40px between blocks, 72px between sections.
- **Breakpoints** are declared in rem in `@theme` (`laptop` 56.25rem, `desk` 73.75rem) so they sort with Tailwind's defaults.
- **App shell:** a full-height column; `main` grows so the footer band always closes the page.

### Responsive behaviour

| Width | Changes |
|---|---|
| < 640px | Header band shows logo + search field only; navigation moves to the bottom tab bar; search opens a full-screen sheet; cards 1-up; listing request becomes the bottom bar. |
| 640–1024px | Text nav behind a menu button; search sentence on two lines; cards 2–3 up. |
| ≥ 1024px | Full text nav; search sentence on one line; cards 3–4 up; request rail sticky. |

Touch targets 44px+ (primary actions 48px). Sticky bottom elements add `env(safe-area-inset-bottom)`. `prefers-reduced-motion` turns off every transition and the tratta draw.

## Elevation & Depth

Flat by default. Three levels only:
- **Paper** (no border, no shadow): page content, cards, photos.
- **Sheet** (card paper + 1px Hairline, no shadow): the request rail, the messages frame, empty states, error panels, the filters panel.
- **Float** (`box-shadow: 0 18px 44px hsl(166 81% 17% / .14)`, `shadow-float`): menus, popovers, dialogs, the sticky bottom request bar.

### Named Rules

**The Float Is Physical Rule.** If an element does not cover something else, it does not get a shadow.

## Shapes

- **Sheet corner 4px:** photos, sheets, panels, the tratta plates.
- **Control corner 8px:** buttons, inputs, selects, the search sentence fields.
- **Full:** avatars, switches, the account pill, the footer's social circles, the tratta's home dot. The tratta's campus marker, legend swatches and status swatches are squares.
- No 16–32px "pillowy" panels, no decorative rings or blobs.

## Components

### Shell
- **Header band** (Deep Pine, 72px): the Roomly mark recoloured Mint Mist through a CSS mask of the official logo asset; text nav in Mint Mist 800 at 15px with a 3px Mint Wash underline under the active item; account as an outline pill (Mint Mist 30% stroke) with the name and a Mint Wash avatar.
- **Search sentence** (second pine row on home and search): "Stanze vicino a [università] fino a [€ budget] al mese [Cerca]". Fields are card-paper controls set inside the sentence; Cerca is the view's amber action. Phones: one field-shaped button that opens the full-screen search sheet. The URL holds the search state.
- **Footer band** (Deep Pine): mark, one-line purpose, product and company links, legal links, language picker, copyright. Mint Mist text, Mint Wash hover.
- **Tab bar** (phones): card paper, top hairline, Esplora/Panoramica · Messaggi · Profilo, active item Deep Pine with a 3px bar on its top edge; hidden on listing pages, which own the bottom edge.

### La tratta (signature)
The distance to a university drawn to scale: a Shutter Green ring (home), a Shutter Green line (2px sm, 3px lg), a Deep Pine square (campus; 6px in sm). The line's length is the real km on a 0–5 km scale; beyond 5 km it ends in an arrow. Next to it: the km figure (tabular 900) and the university name. Sizes: **sm** inline in cards and rows, one line; **lg** on the listing page with scale ticks (0, 1, 2… km in map-label) and the figure-lg number. It appears only when the backend returned a distance. On first view the lg tratta draws from home to campus once (600ms ease-out).

### Legend (property types)
Tabs with a 10px square swatch, the label and the real count: Tutte · Stanze (Shutter Green) · Appartamenti (Deep Pine) · Residenze (Mint Wash with a pine edge). The active tab has a 3px Deep Pine underline. A type with no rooms in the current results is inert: Sage at 60%, its swatch faded, not selectable. On phones the legend scrolls sideways and clears the Filtri link. The same swatch tags a listing's type in its card. Filters open from a text button "Filtri (n)" at the end of the legend.

### Listing card
Frameless on paper. Photo 4:3 with the sheet corner; without photos, the **persiana**: a closed green shutter drawn in CSS (Shutter Green slats on Deep Pine) with "Ancora senza foto". Under the photo: title and price on one baseline, then the tratta (or the nearest university's name when there is no distance), then the type swatch, type and availability. The whole card is one link; hover underlines the title and lifts nothing.

### Listing page
Title (display) on the left with type and zone as a lede line; Condividi as a text button. Photo mosaic 1 + 4 with sheet corners; a single photo keeps a photo's proportions (3:2, at most 840px wide) instead of being cropped to a banner. The **tratta lg** opens the content. Facts as a two-column ruled definition list (Tipologia, Arredamento, Spese, Disponibilità, Animali, Fumatori). Description at reading width. Owner as a ruled row (avatar, name, "Proprietario verificato", "Ancora nessuna recensione"); the line is true because only accounts an admin has flagged `owner` can publish. **Request rail** (sheet, sticky): price figure, labelled segments (Affitto, Spese incluse, Tratta), the amber "Richiedi la stanza", the three-step lifecycle as a numbered list, the one-accepted-request limit. Own listing, unavailable, already-requested and accepted states replace the action with a secondary button. A listing the API no longer has (404) gets a plain page head, "Questo annuncio non è più su Roomly", and the amber way back to search, never a retry.

### Owner dashboard
Page head: "Ciao, {nome}" and the amber "Nuovo annuncio" on the right baseline. "Richieste da gestire": ruled rows, one per pending request (student, room, date, preview, Accetta primary, Rifiuta secondary, Apri chat link), ranked by date. "I tuoi annunci": ruled rows with thumbnail, title, price figure right-aligned, status legend entry, and a menu (Modifica, Vedi, Elimina). Counts only from real data.

### Forms
Card-paper inputs, Field Border stroke, 8px corners, 48px tall, label above in label type (never placeholder-only). Focus: Shutter Green border plus a 3px Mint Wash ring at 40%. Errors: Terracotta border and a Terracotta sentence that says how to fix it. Long forms are one column (max 42rem) with ruled groups under section heads: the listing form runs L'annuncio (title, address, price, description), Foto, La stanza (type, rules, features), then the listing promise as a pine-ruled note and the amber Pubblica. Hints under labels are concrete instructions in Sage, never slogans. Switches are ruled rows, label left and the switch at the end of the line, with a tabular "n/7" count when a group is partly chosen; multiple choices are 44px chips with a square check. Selects, native selects and the Geoapify address field are restyled to the same control. Login and register share the same field set.

### Dialogs and errors
Dialogs are card-paper sheets with a hairline, 4px corners and the float shadow over a 50% Deep Pine scrim; title in 900 at 20px, text in Sage; Annulla is secondary, the confirm is primary or Terracotta when it declines or deletes. A failed load is a Terracotta Mist sheet with a retry; inside another sheet (the chat) it drops the sheet and keeps only the Terracotta heading, text and retry, so sheets never nest and no side stripe appears.

### Messages
Inbox and chat side by side in one sheet from 1024px. Inbox rows are ruled; the open conversation is tinted Mint Mist (no side stripe); unread is an 8px Shutter Green square plus bold preview; each row ends with the request's legend entry. Bubbles have 8px corners with a 2px corner on the speaker's side (mine Shutter Green, theirs Mint Mist); system notes are centred between two hairlines. Request actions sit on a strip under the chat head (Accetta amber, Rifiuta secondary, Annulla richiesta and Libera la stanza secondary). Dates follow the interface language. On phones an open chat owns the screen between the header and the tab bar.

### Auth and 404
Login and register: the pine band with the mark and the language picker; title, lede and form on columns 1–5; on columns 7–12 from 1024px the example city plan with one line on what the tratta measures. The submit is the amber action; Turnstile sits in the form flow. 404: the same band, a page title, the amber "Torna alla home" and the city plan's lost variant (a dotted route ending in a "?"), decorative and unlabelled.

### Buttons and links
Action (amber, one per view), primary (Shutter Green), secondary (transparent with Outline Border stroke), destructive (Terracotta) for delete/decline confirmations. Hover darkens; press moves down 1px; disabled is 50% opacity. Text links are Shutter Green with a 1px underline offset 4px; hover thickens the underline to 2px.

### Status pills
Request states read like legend entries, a square swatch and the state's name: in attesa (Sun Amber swatch, Ink), accettata (Shutter Green swatch, Ink), rifiutata (Terracotta swatch and text), annullata (Outline swatch, Sage). Listing states use the same form: affittata (Deep Pine), disponibile (Shutter Green), non disponibile (Outline, Sage).

### Waitlist (Persuade surface)
Map-paper page, pine band. Title "Roomly sta arrivando." at display size on the left; on the right an authored SVG city plan in the palette (terracotta blocks, mint parks, an amber main road, a pine campus square, a tratta from a room to the campus) labelled "Esempio". One amber "Registrati ora", a secondary "Accedi". Steps as a numbered ruled list; the pine band states the distance promise and shows it: one example tratta (0,8 km, "dalla tua università") on a card-paper plate tagged "Esempio"; "Cosa ti dice ogni annuncio" as one ruled list (prezzo al mese, distanza, regole della casa, proprietario verificato); FAQ as a ruled accordion; the close is a pine band with the amber action. Sign-up count only when real and ≥ 100.

## Do's and Don'ts

### Do:
- **Do** let distance and price lead every listing, drawn as the tratta and set as tabular figures.
- **Do** keep one amber action per view and nothing else amber.
- **Do** group with hairlines, alignment and the paper/sheet step; keep shadows for floating layers.
- **Do** write headings that say what the section is, in sentence case, without a kicker.
- **Do** set every figure tabular and right-align figures in lists.
- **Do** keep every control a standard, recognisable web control with a visible label and focus state.
- **Do** show honest empty states and hide data that does not exist.

### Don't:
- **Don't** put a small uppercase label above any heading.
- **Don't** mark selection or alerts with a coloured stripe on one side of a row or panel; tint the row or rule the top edge instead.
- **Don't** use rows of identical cards with an icon tile, a title and two lines of text.
- **Don't** use pastel gradient panels, concentric rings, blobs, floating tilted sample cards or decorative icons.
- **Don't** give content cards soft shadows or 16–32px corners.
- **Don't** centre page heads or build symmetric hero blocks.
- **Don't** write slogans or filler ("il modo più piacevole", "un buon punto di partenza", "fai valere ogni stanza").
- **Don't** show ratings, saves, view counts, earnings or percentages that are not computed from real data.
- **Don't** costume the screen as a paper map: no fold creases, compass roses, grid coordinates or map paper texture on working screens.

## Data Dependencies

| Element | Needs | Today |
|---|---|---|
| Tratta on cards | backend distance | Yes, in university search (`distanceKm`) |
| Tratta on the listing page | distance to the searched or nearest university | Yes, read from the university search for that listing |
| University prefill in search | the student's university in /api/me | No |
| Map of real listings | coordinates in the listing API | No (illustration only on the waitlist) |
| Ingresso, Durata, Contratto, deposit | listing fields | No |
| Ratings, reviews, saves, response time | data | No |
| Owner metrics beyond counts | tracking | No |

## Agent Prompt Guide

When generating a Roomly screen: pine band on top, map-paper page, the page title at display size on the left without a kicker, figures tabular and right-aligned, groups separated by hairlines, sheets only for forms and rails, the tratta wherever a distance exists, the legend swatches for property types, one amber action. Use standard controls. Write in plain Italian with real places and numbers.
