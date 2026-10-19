---
version: 1
slug: "frontend-src-pages-home-tsx"
primary_target: "frontend/src/pages/home.tsx"
related_targets: ["frontend/src/pages/search.tsx"]
---

# Surface brief: Browse (home + search)

Scope: `/home` and `/search`, plus the shared header, search pill, category strip, listing card, footer and mobile tab bar they introduce. Mode: Operate (home leans Persuade only in its intro and colour-block panels).

Audience: university students searching remotely on a phone, under time pressure before term. Job: find rooms near their university within budget, then open one. Proof: real listings, real distance to the chosen university, real prices. Constraints: Truth Rule (no ratings, saves, fake counts), six languages, owner/admin gating unchanged, API filters only zone, maxPrice, furnished (other filters client-side).

Unresolved: student university is not exposed by /api/me, so the pill cannot prefill it yet.

## Direction contract

THESIS: Browsing is anchored on the university, not the city. Refuses the generic hero-plus-featured-grid landing; the search pill is the page's spine and distance is the line every card leads with.

OWN-WORLD: Plaster Cream ground, Card Paper pill and sheets, Deep Pine voice, Shutter Green actions, one Sun Amber orb. Nunito Sans 900 tight headings, frameless 20:19 photo cards, pine-tinted shadows, 12/16/32px corners, shutter-slat placeholder when a room has no photo.

STORY: The student sees the pill, picks a university, sees how far every room is from it, narrows by type and filters, and opens a room. Nothing on the page is invented.

FIRST VIEWPORT: Sticky two-row header: logo, product tabs, account; below it the 66px pill (Università · Budget mensile · amber orb) centred at about 760px wide. Then the intro headline, the category strip, and the first row of four cards on desktop. Mobile: one pill "Dove vuoi studiare?" opening a full-screen sheet, cards 1-up, bottom tab bar.

FORM: Photo-first marketplace grid in the Green Shutter world (DESIGN.md, user-pinned); position 1 of 1; seed: none (roll skipped on purpose: the direction is pinned by the user-supplied DESIGN.md, and a user-pinned direction beats the roll; no seed reference exists).

Signature interaction: choosing a university reorders the grid by distance and the result line states the radius and order.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
