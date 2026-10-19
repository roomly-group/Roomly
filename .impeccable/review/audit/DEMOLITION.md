# Audit and demolition list — identity "La pianta"

Audit: 2026-10-19. Playwright (logged out, 1440×900 and 390×844, full-page captures in this folder) for the public routes; the user's Chrome session for the authenticated routes. The impeccable detector (`detect.js`, live server on :8400) was injected into every rendered page.

## Detector findings by route

| Route | Findings |
|---|---|
| `/` waitlist | hero-eyebrow-chip, icon-tile-stack ×2, kicker-above-heading ×4, nested-cards, cream-palette, repeating-stripes-gradient |
| `/login`, `/register` | cream-palette; visually a centred card with a "WELCOME TO ROOMLY" chip (generic auth template) |
| `/chi-siamo`, `/privacy` | kicker-above-heading, line-length ~108ch, cream-palette |
| `/contatti` | kicker-above-heading, skipped-heading (h1 → h3), cream-palette |
| `/termini`, `/cookie` | kicker-above-heading, cream-palette |
| 404 | low-contrast 4.0:1 (white on #3f8d78); decorative blobs |
| `/home` | kicker-above-heading ×4, undersized-ui-text (avatar 10px), cream-palette, repeating-stripes-gradient |
| `/search` | kicker-above-heading, skipped-heading (h1 → h3), undersized-ui-text |
| `/listings/:id` | flat-type-hierarchy (14/14/16px), undersized-ui-text |
| `/owner` | hero-eyebrow-chip, undersized-ui-text |
| `/owner/messages` | hero-eyebrow-chip, low-contrast 2.9:1 (#82978e dates), undersized-ui-text |
| `/owner/listings/new` | hero-eyebrow-chip, low-contrast ×4 (#82978e hints, placeholder, pine 4.3:1 and amber-ink 3.7:1 on amber), tiny-text 11px |
| `/owner/profile` | hero-eyebrow-chip, kicker-above-heading, undersized-ui-text |
| `/profile/preferences` | hero-eyebrow-chip, kicker-above-heading, undersized-ui-text |

## Beyond the detector (design review against DESIGN.md)

- The shell is the marketplace template: cream header with icon-tile nav pills, Airbnb pill search with an orb, icon category strip.
- Pastel mint/amber colour-block panels with concentric rings (home, waitlist, confirmation, 404).
- Identical icon-tile + title + two-line text groups (waitlist steps and reasons, chi-siamo values, profile tiles, preference header).
- Soft-shadow cards everywhere (distance card, request rail, owner rows, profile cards, form sheets).
- Slogan titles that say nothing ("Racconta bene la storia della tua stanza.", "Un profilo di cui ci si può fidare.", "Continua le belle conversazioni.", "Persone interessate alle tue stanze.") while the concrete label sits above them as a kicker.
- The no-photo placeholder is a pastel gradient with stripes; it should be the brand's closed shutter.
- Distance — the product's mechanism — is a line of text, not a figure.

## Demolish and rebuild

Shared: app shell (pine header band, pine footer band), navbar and profile menu, search (sentence bar replaces the pill), category strip (legend with swatches and counts replaces icons), listing card (baseline pair, tratta, persiana), tratta component (new), section head (new), page intro (no kicker), buttons and inputs (8px control corners), empty state and query error (flat sheets), mobile tab bar, avatar (11px floor), `.eyebrow` class (deleted).

Views: waitlist, waitlist confirmation, login, register, home, search, listing detail, owner dashboard, messages (student and owner), profile (student and owner), preferences, new and edit listing, static pages (about, contact, privacy, terms, cookies), 404.

Constraint for every rebuild: no change to API calls, routes, hooks, data flow, element ids or `data-testid` attributes.
