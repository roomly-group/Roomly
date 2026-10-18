---
target: search
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 5
target_identity: "file:C:\\Users\\simon\\Desktop\\Roomly\\frontend\\src\\pages\\search.tsx"
target_fingerprint: "sha256:faa36402229c84b3cf30617b33f53873334804b4c5840d78695d85a7d58c621b"
target_path: "C:\\Users\\simon\\Desktop\\Roomly\\frontend\\src\\pages\\search.tsx"
timestamp: 2026-10-18T19-40-51Z
slug: frontend-src-pages-search-tsx
---
Method: dual-agent (A: revisione di design · B: detector automatico)
Run notes: nessuna ispezione live (le pagine richiedono login owner). Evidenza visiva = screenshot desktop forniti dall'utente di home, dettaglio annuncio e dashboard; /search e tutto il mobile sono dedotti dal codice [codice]. Critique congiunta di 4 pagine: home, search, listing-detail, owner-dashboard.

## Punteggio (Nielsen, 0-4)

| # | Euristica | Home | Search | Dettaglio | Dashboard |
|---|---|---|---|---|---|
| 1 | Visibilità dello stato | 2 | 2 | 2 | 1 |
| 2 | Linguaggio del mondo reale | 2 | 2 | 2 | 2 |
| 3 | Controllo e libertà | 3 | 2 | 2 | 3 |
| 4 | Coerenza e standard | 2 | 2 | 2 | 1 |
| 5 | Prevenzione errori | 3 | 1 | 2 | 3 |
| 6 | Riconoscere > ricordare | 2 | 2 | 2 | 2 |
| 7 | Flessibilità ed efficienza | 2 | 1 | 2 | 1 |
| 8 | Estetica minimalista | 3 | 3 | 3 | 2 |
| 9 | Recupero dagli errori | 3 | 3 | 3 | 2 |
| 10 | Aiuto e documentazione | 1 | 1 | 2 | 1 |
| | Totale | 23/40 | 19/40 | 22/40 | 18/40 |

## Verdetto sulla specificità
LLM: la pelle è d'autore (Green Shutter applicato con coerenza), lo scheletro è generico (hero+search+griglia, dettaglio stile Airbnb, dashboard SaaS a 4 KPI). Università e distanza, il differenziatore del prodotto, quasi invisibili: MapPin + "Dove vuoi cercare?", distanza 12px sage nella card, assente nel dettaglio; il backend ordina già per distanza.
Detector: 0 findings su 4 pagine + 17 componenti + cartella components; TSX = solo regex, regole contrasto/testo piccolo non eseguite. Grep supplementare: >300 classi con hex grezzi che saltano i token semantici; ~17 valori fuori palette DESIGN.md.
Overlay: non disponibili (nessuna iniezione, serve login).

## Impressione generale
Bello e coerente in superficie; il problema principale è la verità dei dati (rating 0.0, "stanze che gli studenti stanno salvando", metriche finte, card campione). Seconda opportunità: distanza dall'università come elemento principale di ricerca e dettaglio.

## Cosa funziona
1. Token coerenti, coppie principali AA; ombre tintate; pannelli a blocchi.
2. LocationSearch: combobox accessibile (ARIA, frecce, Esc, ricerca senza accenti).
3. Stati gestiti ovunque: skeleton, QueryError con Riprova, empty state, errori richiesta in copy umano, conferme distruttive chiare.

## Problemi prioritari

### Trasversali
- [P1] Dati non veri presentati come fatti: "★ 0.0" sempre 0 (card e dettaglio); "Le stanze che gli studenti stanno salvando ora" = primi 6 annunci; card "Stanza soleggiata · Old Town"; "Verifica annunci in corso" = health-check; "8 stanze intorno al campus" = totale nazionale; dashboard 72%/91% hardcoded (owner-dashboard.tsx:404,413) ed endpoint backend mock (roomly.ts:643). Fix: nascondere rating o "Nuovo su Roomly"; "Ultime stanze pubblicate"; togliere card campione e riga stato; calcolare annunci attivi e richieste in attesa dai dati del client; rimuovere "Il tuo andamento". Comandi: distill + clarify.
- [P1] Cuore "salva" finto: useState locale (listing-card.tsx:27), nessuna persistenza né lista. Fix: rimuovere o implementare con "Salvate" in nav.
- [P2] Prezzi en-GB ("€3,445"): Intl fisso su en-GB (constants.ts:137); dashboard usa `€${price}`. Fix: formatPrice con lingua corrente. harden
- [P2] Deriva token: hex fuori palette, bg-white su footer/dropdown/menu, toast rossi invece di terracotta, nessun focus-visible. polish
- [P2] Footer non ancorato in basso: blocco bianco a metà schermo e vuoto crema sotto nelle pagine corte. Fix: flex col + main flex-1. layout

### Home (23/40)
- [P1] Università assente dall'hero: MapPin + "Dove vuoi cercare?", ateneo del profilo non precompilato. Fix: label "La tua università", precompilazione, microcopy sull'ordinamento per distanza. shape
- [P2] Nessun "come funziona"; striscia fiducia ripetuta 3 volte. Fix: 3 passi numerati. onboard
- [P2] Ambra oltre la One Sun Rule; 4 link diversi verso /search. quieter
- [P2] A11y/i18n: campo prezzo con nome "€" e placeholder 2.70:1; amber-ink su amber 3.73:1; floaty infinita senza prefers-reduced-motion; "Cerca" hardcoded. harden
- Mobile [codice]: "Cerca" a ~600-650px, al limite della piega.

### Search (19/40)
- [P1] Filtro luogo fantasma: commit="explicit" (search.tsx:86), nessun bottone Cerca, conteggio mostra tutto. Fix: commit al blur o bottone; chip "Vicino a: X · per distanza". clarify
- [P1] Filtri non nell'URL; "Tutte le stanze" dal dettaglio azzera la ricerca. Fix: sync query string, link indietro con parametri. harden
- [P1] Prezzo filtra a ogni tasto senza debounce; stato vuoto e skeleton lampeggiano; "0 stanze" durante il caricamento. Fix: debounce 400ms, keepPreviousData. optimize
- [P2] Distanza 12px sage mentre la stella 0.0 è in evidenza; raggio 80 km non dichiarato. typeset
- Mobile [codice]: prezzo w-16, toggle "Arredata" ~36px senza aria-pressed, barra filtri non sticky. Fix: barra compatta + drawer. adapt

### Dettaglio annuncio (22/40)
- [P1] Titolo pino #085041 su scrim nero quando c'è una foto (listing-detail.tsx:233-243), ~1.2:1. Fix: testo crema/mint su scrim pino o titolo sotto la foto. colorize
- [P1] Momento della richiesta ambiguo: "nessun impegno" vs "invia una richiesta"; limiti solo come errore dopo l'invio; modale senza role="dialog", Esc, focus trap (riga 499). Fix: CTA "Invia richiesta", 3 passi, limiti prima, Dialog Radix. clarify + harden
- [P1] Mancano distanza, mappa, date di disponibilità, spese, deposito. shape
- [P1, mobile] CTA sotto tutte le caratteristiche sotto lg. Fix: barra sticky in basso con prezzo + "Invia richiesta". adapt
- [P2] "Identità verificata" sempre mostrato, basato solo sul flag owner.

### Dashboard proprietario (18/40)
- [P1] Metriche finte (vedi trasversali).
- [P1] Manca la coda delle richieste: "Richieste in sospeso" non cliccabile, "Apri posta" link piccolo. Fix: colonna principale "Richieste da gestire" con Accetta/Rifiuta. layout
- [P1] Nome da user_metadata (saluto) vs /api/me (header) = cognomi diversi; fallback "Maya"; "Buongiorno" a ogni ora; stringhe inglesi hardcoded. harden
- [P2] Righe annuncio: icona modifica #9ab8ab 2.03:1, cestino fuori token, target 32px, righe senza spazio, nessun link alla scheda pubblica. polish
- Mobile [codice]: 4 tile su una colonna, ~500px di zeri prima degli annunci.

## Persone
- Casey: CTA dettaglio in fondo; filtri persi; filtro fantasma; skeleton che lampeggia; cuore che dimentica; toggle 36px.
- Jordan: nessun "come funziona"; "nessun impegno" vs "richiesta"; "★ 0.0"; "€3,445"; "In arrivo" per stanza affittata; "Cerca" in italiano in UI inglese.
- Sam: titolo su foto ~1.2:1; modale senza role/Esc/focus trap; <button> dentro <a> nella card; hamburger senza aria-expanded; conferma di eliminazione verde.
- Alex (owner): metriche mock, nessuna coda richieste, nessun "vedi annuncio", nessun ordinamento.
- Lucía (Erasmus, Siviglia → Politecnico, da telefono): niente mappa/indirizzo/distanza/date/spese; non conosce raggio 80 km né limite di una richiesta accettata; nessuna aspettativa sui tempi di risposta.

## Osservazioni minori
- Gradiente placeholder diverso tra card e dettaglio.
- Stanza non disponibile: "In arrivo" + "non più disponibile" + bottone ambra disabilitato.
- Owner sul proprio annuncio: "Scrivi pure" poi "Non puoi scrivere a te stesso", senza link "Modifica".
- "Controlla i tuoi annunci" traduzione sbagliata di "List a room".
- Gruppo "Arredata" con tile "Arredata".
- Empty state dashboard: seconda CTA ambra, sfondo #F7FAF8 fuori token.

## Domande
1. Perché nella pagina dove lo studente decide non c'è né mappa né distanza? E se la distanza fosse il titolo della card?
2. Togliendo i numeri finti dalla dashboard, resta la dashboard vera: una coda di richieste?
3. Primo contatto: chiacchierata senza impegno o candidatura che consuma uno slot?
