# Roomly

Roomly è una demo full-stack per cercare stanze, pubblicare annunci e scambiare
messaggi tra studenti e proprietari. È composta da due applicazioni indipendenti:

- `frontend/`: React 19, TypeScript, Vite, Wouter e React Query;
- `backend/`: Express, TypeScript e Zod;
- `backend/local-libs/api-zod/`: contratto condiviso con schemi e tipi;
- `frontend/local-libs/api-client-react/`: client HTTP e hook React Query generati.

## 1. Architettura

```text
Browser -> Vite frontend -> proxy /api -> Express backend
                                      -> dati demo in memoria
```

Il browser usa URL relativi come `/api/listings`. Vite inoltra `/api` al backend
configurato con `BACKEND_URL`; in questo modo il frontend non deve conoscere la
porta dell'API. Il backend abilita CORS, parsing JSON e URL encoded, logging con
`pino-http` e monta tutte le rotte sotto `/api`.

## 2. Avvio locale

### 2.1 Avvio dei server

Servono due terminali. Il backend richiede obbligatoriamente `PORT`.

```bash
# Terminale 1
cd backend
npm install
$env:PORT=3001       # PowerShell; usare PORT=3001 in bash
npm run dev

# Terminale 2
cd frontend
npm install
npm run dev
```

Indirizzi predefiniti: frontend `http://localhost:5173`, backend
`http://localhost:3001`.

### 2.2 Variabili d'ambiente

Le variabili del frontend sono lette da `frontend/vite.config.ts`:

| Variabile | Default | Scopo |
| --- | --- | --- |
| `PORT` | `5173` | Porta di Vite e della preview |
| `BACKEND_URL` | `http://localhost:3001` | Destinazione del proxy `/api` |
| `BASE_PATH` | `/` | Prefisso dell'app in fase di deploy |

### 2.3 Comandi utili

```bash
cd backend
npm run typecheck
npm run dev       # sviluppo con watch
npm start         # avvio senza watch

cd frontend
npm run typecheck
npm run build     # frontend/dist/public
npm run serve     # preview della build
```

## 3. Backend

### 3.1 Bootstrap e middleware

Il bootstrap è in `backend/src/index.ts`: carica `.env`, controlla `PORT` e
avvia Express. La configurazione dei middleware è in `backend/src/app.ts`.
`backend/src/routes/index.ts` compone il router; la logica principale è in
`backend/src/routes/roomly.ts`.

### 3.2 API disponibili

| Metodo | Endpoint | Funzione |
| --- | --- | --- |
| `GET` | `/api/healthz` | Health check |
| `GET` | `/api/listings` | Lista annunci; filtri `zone`, `maxPrice`, `furnished` |
| `POST` | `/api/listings` | Crea un annuncio e risponde `201` |
| `GET` | `/api/listings/:id` | Dettaglio annuncio oppure `404` |
| `GET` | `/api/conversations` | Lista conversazioni demo |
| `GET` | `/api/conversations/:id/messages` | Messaggi di una conversazione |
| `POST` | `/api/conversations/:id/messages` | Aggiunge un messaggio dello studente |
| `GET` | `/api/dashboard/owner` | Metriche demo del proprietario |

### 3.3 Contratto e validazione

Gli input e le risposte positive vengono verificati con gli schemi di
`@workspace/api-zod`. Per cambiare una forma dati, modificare il contratto in
`backend/local-libs/api-zod/src/generated/` e aggiornare il client generato del
frontend insieme al backend.

### 3.4 Stato in memoria

I dati sono definiti direttamente in `roomly.ts`: `listings` è un array,
`conversations` un array e `messages` una `Map` indicizzata per conversazione.
Un nuovo annuncio riceve un ID incrementale, proprietario `Tu` e valori demo per
rating e disponibilità.

## 4. Frontend

### 4.1 Bootstrap e provider

`frontend/src/main.tsx` monta React su `#root`. `App.tsx` costruisce i provider
globali: React Query, tooltip, routing Wouter, lingua e notifiche. Il router è in
`frontend/src/router.tsx` e usa `BASE_PATH`.

### 4.2 Routing

| Rotta | Schermata |
| --- | --- |
| `/` | Home studente, health check, ricerca rapida e primi annunci |
| `/search` | Ricerca per zona, prezzo massimo e arredamento |
| `/listings/:id` | Dettaglio, preferito e dialog di contatto |
| `/messages`, `/messages/:id` | Inbox e conversazione studente |
| `/profile` | Profilo studente e impostazioni lingua |
| `/owner` | Dashboard proprietario |
| `/owner/listings/new` | Form per pubblicare un annuncio |
| `/owner/messages` | Inbox proprietario |
| `/owner/profile` | Profilo proprietario |

Le rotte sconosciute mostrano `NotFound`. `AppShell` contiene header, logo,
navigazione desktop/mobile, avatar e cambio tra vista studente e proprietario.

### 4.3 Pagine e chiamate API

Le pagine in `frontend/src/pages/` usano gli hook di
`@workspace/api-client-react`:

- `home.tsx`: `useListListings` e `useHealthCheck`;
- `search.tsx`: `useListListings` con query costruita dai filtri;
- `listing-detail.tsx`: `useGetListing`;
- `messages.tsx`: `useListConversations`, `useListMessages`, `useSendMessage`;
- `new-listing.tsx`: `useCreateListing`, poi navigazione al dettaglio;
- `owner-dashboard.tsx`: `useGetOwnerDashboard`;
- `profile.tsx`: dati demo locali e `LanguageSetting`.

React Query gestisce cache, caricamento, errori e refetch. Gli stati di loading
usano skeleton; gli errori mostrano `QueryError`; le liste vuote usano
`EmptyState`.

### 4.4 Componenti riusabili

I componenti riusabili applicativi sono in `components/shared` e comprendono
`ListingCard`, `PageIntro`, `Button`, `LoadingCards`, `EmptyState` e
`QueryError`. `components/ui` contiene primitive Radix/shadcn già predisposte
(dialog, form, input, select, toast, tabs e altre).

## 5. Stato e traduzioni

### 5.1 Stato remoto e stato locale

Lo stato remoto appartiene a React Query. Lo stato locale React gestisce filtri,
preferiti, menu mobile, dialog di contatto, editor profilo e controlli del
dashboard.

### 5.2 Lingue

`frontend/src/lib/i18n.tsx` supporta inglese, italiano, spagnolo, francese,
tedesco e portoghese. La lingua viene scelta in quest'ordine:

1. preferenza in `localStorage`;
2. `navigator.languages` / `navigator.language`;
3. inglese.

La preferenza è separata per persona nelle chiavi
`roomly-language:student` e `roomly-language:owner`. Le zone visualizzate sono
tradotte, ma il valore inviato all'API resta quello della costante in
`frontend/src/lib/constants.ts`. Prezzi e iniziali sono formattati dalle funzioni
presenti nello stesso file.

## 6. Flussi principali

### 6.1 Flusso studente: cercare una stanza

La Home carica annunci e health check. La ricerca porta a `/search`, dove i filtri
aggiornano la query React Query e producono, per esempio,
`/api/listings?zone=...&maxPrice=...&furnished=true`. Un click apre
`/listings/:id`.

### 6.2 Flusso studente: inviare un messaggio

Le conversazioni demo vengono caricate da `/api/conversations`. La chat carica i
messaggi e invia `{ "body": "..." }` a
`POST /api/conversations/:id/messages`; dopo la risposta il messaggio viene
aggiunto alla cache locale.

### 6.3 Flusso proprietario: pubblicare una stanza

Il form in `/owner/listings/new` raccoglie titolo, zona, prezzo, descrizione,
arredamento e Wi-Fi. Il backend valida il payload, aggiunge l'annuncio in RAM e
il frontend apre `/listings/:id` dell'annuncio creato.

## 7. Limiti della demo e prossimi punti di modifica

### 7.1 Funzionalità ancora simulate

- Non esistono database, autenticazione, autorizzazione o utenti reali.
- Il riavvio del backend cancella annunci e messaggi creati durante la sessione.
- Il dialog di contatto non crea ancora una conversazione.
- Preferiti e profili restano nello stato locale del frontend.
- Il dashboard usa metriche demo; le righe degli annunci sono hardcoded e non
  rappresentano necessariamente quelli presenti nell'array backend.
- Le zone seed del backend (`San Lorenzo`, `Fuorigrotta`, `Vomero`) non coincidono
  con quelle proposte dal frontend (`North Campus`, `Riverside`, ecc.). Per
  aggiungere una zona, aggiornare sia `roomly.ts` sia `constants.ts` e le
  traduzioni.
- Su mobile il pannello della conversazione è nascosto, quindi il flusso chat è
  pensato principalmente per desktop.

### 7.2 Evoluzione consigliata

Per portare la demo verso un'applicazione reale, i primi punti da sostituire sono
lo stato in `roomly.ts` con un repository/database, l'identità fissa con
autenticazione, le statistiche hardcoded con query reali e la generazione del
client dopo ogni modifica al contratto API.

## 8. Struttura da consultare

### 8.1 Dove intervenire

```text
roomly/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # avvio del server e validazione di PORT
│   │   ├── app.ts                   # Express, middleware e prefisso /api
│   │   ├── lib/logger.ts            # logger pino
│   │   ├── middlewares/             # middleware aggiuntivi
│   │   └── routes/
│   │       ├── index.ts             # composizione dei router
│   │       ├── health.ts            # GET /api/healthz
│   │       └── roomly.ts            # annunci, messaggi e dashboard
│   └── local-libs/api-zod/
│       └── src/generated/           # schemi e tipi del contratto API
└── frontend/
    ├── src/
    │   ├── main.tsx                 # bootstrap React e ErrorBoundary
    │   ├── App.tsx                  # provider globali e router
    │   ├── router.tsx               # associa rotte e pagine
    │   ├── pages/                   # pagine collegate alle rotte
    │   ├── components/
    │   │   ├── layout/              # AppShell, logo, avatar e navigazione
    │   │   ├── shared/              # componenti usati da più pagine
    │   │   └── ui/                  # primitive Radix/shadcn
    │   ├── hooks/                   # hook locali, ad esempio label delle zone
    │   └── lib/                     # i18n, costanti e utilità
    └── local-libs/api-client-react/
        └── src/                     # fetch, tipi e hook React Query generati
```

### 8.2 Pagine frontend

| File | Rotta | Responsabilità |
| --- | --- | --- |
| `pages/home.tsx` | `/` | Home studente, annunci iniziali, health check e ricerca rapida |
| `pages/search.tsx` | `/search` | Filtri per zona, prezzo massimo e arredamento; lista risultati |
| `pages/listing-detail.tsx` | `/listings/:id` | Dettaglio annuncio, preferito e dialog di contatto |
| `pages/messages.tsx` | `/messages`, `/messages/:id` | Inbox, selezione conversazione, lettura e invio messaggi |
| `pages/profile.tsx` | `/profile` | Profilo studente e impostazioni della lingua |
| `pages/owner-dashboard.tsx` | `/owner` | Metriche e riepilogo del pannello proprietario |
| `pages/new-listing.tsx` | `/owner/listings/new` | Form di creazione e pubblicazione di un annuncio |
| `pages/profile.tsx` | `/owner/profile` | Stesso componente del profilo, visualizzato per il proprietario |
| `pages/messages.tsx` | `/owner/messages` | Stessa inbox, visualizzata in modalità proprietario |
| `pages/not-found.tsx` | altre rotte | Pagina di fallback per gli indirizzi non riconosciuti |

Le pagine che mostrano dati dal backend seguono quasi sempre lo stesso schema:

1. importano l'hook generato da `@workspace/api-client-react`;
2. mostrano skeleton mentre `isLoading` è attivo;
3. mostrano `QueryError` in caso di errore e consentono il retry;
4. renderizzano i dati oppure `EmptyState` quando la lista è vuota.

### 8.3 Componenti condivisi

- `components/layout/app-shell.tsx`: involucro comune delle pagine, navigazione,
  cambio ruolo, avatar e provider lingua per persona;
- `components/shared/listing-card.tsx`: card di un annuncio con prezzo,
  valutazione, preferito e link al dettaglio;
- `components/shared/page-intro.tsx`: intestazione riutilizzata dalle pagine;
- `components/shared/button.tsx`: pulsante applicativo con varianti comuni;
- `components/shared/loading-cards.tsx`: placeholder di caricamento per gli annunci;
- `components/shared/query-error.tsx`: messaggio di errore con azione di retry;
- `components/shared/empty-state.tsx`: stato vuoto per liste e risultati;
- `components/language-selector.tsx`: controllo della lingua nel profilo;
- `components/ui/`: componenti di base riutilizzabili per dialog, form, input,
  select, toast, tabs e altri controlli.

### 8.4 File di supporto

- `lib/i18n.tsx`: lingue, traduzioni, rilevamento browser e localStorage;
- `lib/constants.ts`: zone, chiavi di traduzione, gradienti, prezzi e iniziali;
- `hooks/use-zone-label.ts`: restituisce la label tradotta di una zona;
- `local-libs/api-client-react/src/custom-fetch.ts`: fetch comune e gestione
  degli errori HTTP;
- `local-libs/api-client-react/src/generated/`: hook, tipi e funzioni API usati
  dalle pagine.
