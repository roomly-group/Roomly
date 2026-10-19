---
version: 1
slug: "frontend-src-pages-home-tsx"
primary_target: "frontend/src/pages/home.tsx"
related_targets: ["frontend/src/pages/search.tsx"]
---

# Surface brief: Roomly app shell and browse (home, search) — identity "La pianta"

Scope: the whole app shell (header band, footer band, phone tab bar) and the browse surfaces `/home` and `/search`; every other surface (listing detail, owner dashboard, messages, profile, forms, auth, waitlist, static pages) inherits this world through DESIGN.md. Mode: Operate (the waitlist is the one Persuade surface and may carry the map illustration).

Audience: university students moving to an Italian city, mostly on a phone, comparing rooms by distance to their university and by monthly price. Job: find rooms near the campus within budget and open one. Proof: real listings, real backend distances, real prices. Constraints: pinned palette (pine, shutter, mint, sun amber, terracotta, map paper (was plaster cream, see run note), card paper, ink, sage) and pinned Nunito Sans; backend, API, routes and every data-testid untouched; Truth Rule; six languages; standard web controls.

Run note: the decision page was not shown — the user was asleep and asked for unattended work. The assigned direction is built as dealt; the user can re-roll from the seed below.

## Direction contract

THESIS: Roomly is a student's pocket map of the city: the campus is the fixed point and every room is a measured distance from it. It refuses the marketplace template (pill search with an orb, icon category strip, soft-shadow cards, pastel hero panels, kickers over every heading).

OWN-WORLD: Pale map-paper ground (#f2f6f3, faintly green, the paper of a printed city plan), a pine header and footer band with mint-mist type, card-paper sheets edged by 1px hairlines and no drop shadows, 4px sheet corners and 8px control corners, Nunito Sans 900 for titles and tabular 900 figures for km and euro, map-legend square swatches for property types, a closed green shutter as the no-photo placeholder, sun amber only on the single action of a view.

STORY: The student names their university, sees every room ranked by how far it is, compares km and price at a glance, opens one, and sends one clear request. Nothing on screen is invented.

FIRST VIEWPORT: Pine band, 72px: mint wordmark left, text nav with a mint-wash underline for the active item, account pill right; on browse pages a second pine row holds the search sentence "Stanze vicino a [università] fino a [€] al mese [Cerca]" with the amber Cerca button. Below on map paper: the page title at display size on the left seven columns, the result sentence and scale legend on the right baseline, the legend tabs with swatches and real counts, then the 4-up grid of photo cards, each with title and price on one baseline and its tratta beneath. Phones: the pine band holds only the search field; navigation moves to the tab bar.

FORM: Pocket city map (pianta della città), assigned index 6 of 7 grounded candidates, seed:144ee22b94cce21c. Signature move: "la tratta" — distance drawn as a scale-true route segment (home dot, line, campus square) whose length is the real km on a fixed 0–5 km scale. Raises: from the split-flap concourse (competitive), rows ranked by one number in fixed columns with tabular figures; from the boarding pass (declined), the request rail as labelled segments with tabular figures; from labanotation (declined), length is the exact quantity; the vertical feed (declined) keeps only the snap-to-next photo strip on phones. Motion grammar: the tratta draws from home to campus once on first view, 600ms ease-out, static under reduced motion; nothing else animates beyond hover and press.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Run note (validation pass): the detector flagged the warm plaster-cream ground (#f1efe8) as cream-palette on every route, and the warm-cream ground is the first machine-made cluster in the new-work calibration. The ground moved to map paper #f2f6f3 and card paper to #fcfdfb; the token is now `ground`. Reverting is one line in index.css.
