# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: university students** moving to (or already in) an Italian city who need a room or flat close to their university. Many are off-site or international, searching remotely, on a phone, under time pressure before the academic year starts.
- **Secondary: owners and agents** (`tipo_utente`: `proprietario`, `agente`) who publish and manage listings, answer requests, and chat with students through the owner dashboard.

## Product Purpose

Roomly makes finding a home near your university simple, fast, and safe, connecting students and owners directly without unnecessary middlemen. Success means a student finds a room that matches the photos, their budget, and the way they live, and closes the deal through a transparent, direct conversation.

## Positioning

- **Verified owners and listings**: trust is a product feature, not a slogan.
- **Housing contract management**: the rental relationship continues inside Roomly after the match.
- **Lifestyle matching algorithm**: matches students with owners, and students with other students living nearby, based on each person's lifestyle and preferences (budget, pets, smoking, noise level, cleanliness, daily schedule, study habits).
- Search is anchored to the student's university and the distance from it, not a generic city search.

## Operating Context

- Student flow: register (with university, degree course, academic year) → set preferences → search near a university → open a listing → send a request → owner accepts or declines inside the chat (`in_attesa`, `accettata`, `rifiutata`, `annullata`) → continue in direct messages.
- Owner flow: register as owner/agent → publish a listing (type, price, address, beds, bathrooms, furniture, appliances, included utilities, availability dates, photos) → edit listings → manage requests and conversations from the dashboard.
- Mostly used on mobile; must work equally well on desktop.

## Capabilities and Constraints

- Stack: React 19 + TypeScript + Vite + Wouter + React Query frontend (Vercel); Express + Zod backend (Railway); Supabase for database, auth, and storage. Every push deploys automatically.
- UI translated into Italian, English, Spanish, French, German, and Portuguese (`src/lib/i18n.tsx`); Italian is the home market.
- Bot protection on forms through Cloudflare Turnstile.
- Errors shown to users must be friendly and plain-language, never raw technical messages.
- Open: how much of contract management and the matching algorithm is already built versus planned is not recorded here; confirm before presenting either as live.

## Brand Commitments

- Name: **Roomly**. Logo asset at `frontend/src/img/logo_no_background.png`; favicon at `frontend/public/favicon.png`.
- Voice: warm, direct, reassuring ("Find a place that feels yours."). Values stated in the product: people first, trust and transparency, simplicity.

## Evidence on Hand

- Pre-launch: the public root route is a waitlist ("Roomly is on its way").
- No real testimonials, user counts, reviews, partner universities, or press exist yet. Future work must not fabricate any of them.

## Product Principles

1. **Trust before choice**: verification, real photos, and clear terms come before volume of listings.
2. **The university is the centre of the map**: distance and commute to campus frame every search.
3. **Match people, not just rooms**: lifestyle compatibility with owners and housemates is part of the decision.
4. **Fewer steps, less waiting**: direct conversation and a clear request status replace middlemen.
5. **Student-first, owner-respected**: optimise for the student while keeping the owner workflow fast and dependable.
