# Roomly

Roomly è una demo full-stack per cercare stanze, pubblicare annunci e mantenere conversazioni tra studenti e proprietari. Il progetto è diviso in due applicazioni standalone:

- `frontend/`: interfaccia React + TypeScript, servita e compilata da Vite.
- `backend/`: API Express + TypeScript.
- `backend/local-libs/api-zod/`: tipi e schemi Zod condivisi dal backend.
- `frontend/local-libs/api-client-react/`: client HTTP e hook React Query generati
	a partire dallo stesso contratto API.

## Mappa generale

```text
Browser
	|
	| React, Wouter, React Query
	v
Vite frontend :5173
	|
	| /api/* proxy -> BACKEND_URL
	v
Express backend :3001
	|
	| CORS, JSON/urlencoded, pino-http
	v
Router /api
	|
	| parsing e validazione con @workspace/api-zod
	v
Stato in memoria
	listings, conversations, messages
```

In sviluppo il browser chiama URL relativi come `/api/listings`. Vite inoltra
queste richieste al backend configurato con `BACKEND_URL`; il browser quindi non
deve conoscere direttamente la porta del backend. Il backend accetta richieste
cross-origin tramite CORS.

## Come si avvia

Sono necessari due processi, uno per ciascuna cartella:

```bash
# Terminale 1
cd backend
npm install
npm run dev

# Terminale 2
cd frontend
npm install
npm run dev
```

URL predefiniti:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3001`

Il backend richiede la variabile `PORT`. Il frontend usa `PORT` per la porta Vite,
`BACKEND_URL` per la destinazione del proxy e `BASE_PATH` per il prefisso di
deploy. I valori predefiniti sono rispettivamente `5173`,
`http://localhost:3001` e `/`.

Comandi disponibili:

```bash
cd backend
npm run typecheck
npm run dev       # tsx watch src/index.ts
npm start         # avvio senza watch

cd frontend
npm run typecheck
npm run build     # output in dist/public
npm run serve      # preview della build
```

## Backend: funzionamento

`backend/src/index.ts` carica `.env`, verifica che `PORT` esista e sia un numero
positivo, quindi avvia l'app Express. `backend/src/app.ts` configura:

1. `pino-http` per logging delle richieste e delle risposte;
2. `cors()` per consentire le chiamate dal frontend;
3. parser JSON e `application/x-www-form-urlencoded`;
4. il router principale sotto il prefisso `/api`.

`backend/src/routes/index.ts` monta le rotte di salute e quelle funzionali.
Gli handler funzionali sono in `backend/src/routes/roomly.ts` e lavorano su
array e `Map` locali. Ogni input viene validato con Zod e ogni risposta viene
verificata con lo schema di risposta corrispondente.

### API disponibili

| Metodo | Endpoint | Comportamento |
| --- | --- | --- |
| `GET` | `/api/healthz` | Restituisce `{ "status": "ok" }`. |
| `GET` | `/api/listings` | Elenca gli annunci; supporta `zone`, `maxPrice` e `furnished`. |
| `POST` | `/api/listings` | Valida e aggiunge un annuncio; assegna ID incrementale e proprietario `Tu`. |
| `GET` | `/api/listings/:id` | Restituisce un annuncio oppure `404`. |
| `GET` | `/api/conversations` | Restituisce l'elenco delle conversazioni demo. |
| `GET` | `/api/conversations/:id/messages` | Restituisce i messaggi della conversazione, oppure un array vuoto. |
| `POST` | `/api/conversations/:id/messages` | Valida il testo e aggiunge un messaggio inviato dallo studente. |
| `GET` | `/api/dashboard/owner` | Restituisce metriche demo per il pannello proprietario. |

Un annuncio contiene ID, titolo, zona, prezzo, proprietario, rating, numero di
foto, descrizione, disponibilità, arredamento e Wi-Fi. Le richieste di creazione
richiedono titolo, zona, prezzo e descrizione; `furnished`, `wifi` e `photos`
sono opzionali.

### Limiti attuali del backend

- Non c'è un database: annunci, conversazioni e messaggi sono dati mock in RAM.
- Tutti i dati inseriti vengono persi al riavvio del backend.
- Non c'è autenticazione, autorizzazione o gestione di utenti reali.
- Il contatto dall'annuncio apre solo un dialog frontend; non crea una nuova
	conversazione nell'API.
- Il dashboard proprietario restituisce valori demo, non calcolati da transazioni.

## Frontend: funzionamento

`frontend/src/main.tsx` monta l'app sull'elemento HTML `#root`, la avvolge in un
`ErrorBoundary` e importa gli stili globali. `frontend/src/App.tsx` configura
un unico `QueryClient`, il provider delle traduzioni, i tooltip, il router
Wouter e le notifiche.

### Navigazione e schermate

| Rotta | Schermata | Funzione principale |
| --- | --- | --- |
| `/` | Home studente | Mostra gli annunci iniziali, lo stato backend, la ricerca rapida e il passaggio al ruolo proprietario. |
| `/search` | Ricerca | Filtra gli annunci per zona, prezzo massimo e arredamento. |
| `/listings/:id` | Dettaglio annuncio | Carica un annuncio singolo, mostra dettagli e permette di aprire il dialog di contatto. |
| `/messages` | Messaggi studente | Carica l'inbox e seleziona la prima conversazione. |
| `/messages/:id` | Conversazione studente | Carica i messaggi e invia nuovi messaggi. |
| `/profile` | Profilo studente | Mostra dati demo e attiva/disattiva l'editor visuale. |
| `/owner` | Dashboard proprietario | Mostra metriche e annunci del proprietario. |
| `/owner/listings/new` | Nuovo annuncio | Invia un annuncio validato dal backend e apre il dettaglio creato. |
| `/owner/messages` | Messaggi proprietario | Riusa l'inbox e il pannello conversazioni in modalità proprietario. |
| `/owner/profile` | Profilo proprietario | Mostra il profilo demo del proprietario. |

Le rotte sconosciute vengono gestite dalla pagina `NotFound`. `AppShell` contiene
logo, navigazione desktop/mobile, selettore lingua, avatar e collegamento per
passare dalla vista studente a quella proprietario.

### Dati e chiamate dal frontend

Gli hook in `@workspace/api-client-react` sono generati e usano
`frontend/local-libs/api-client-react/src/custom-fetch.ts`:

- `useHealthCheck` controlla `/api/healthz` e aggiorna lo stato online della Home;
- `useListListings` carica gli annunci e ricrea la query quando cambiano i filtri;
- `useGetListing` carica il dettaglio tramite ID;
- `useListConversations` carica l'inbox;
- `useListMessages` carica i messaggi della conversazione selezionata;
- `useSendMessage` invia un messaggio e aggiorna localmente la cache React Query;
- `useCreateListing` crea un annuncio e poi naviga al suo dettaglio;
- `useGetOwnerDashboard` carica le metriche del proprietario.

React Query gestisce loading, errori, cache e refetch. Durante il caricamento
compaiono skeleton; in caso di errore viene mostrato un componente con azione di
retry. Il router usa `BASE_URL`, così l'app può funzionare anche sotto un
prefisso diverso dalla root.

### Lingue e stato locale

Il provider in `frontend/src/lib/i18n.tsx` supporta inglese, italiano, spagnolo,
francese, tedesco e portoghese. All'avvio sceglie prima la lingua salvata in
`localStorage` con chiave `roomly-language`, poi prova `navigator.languages` e
infine usa l'inglese. La scelta aggiorna anche l'attributo `lang` del documento.

Preferiti, profili, modifica profilo e alcuni controlli della UI sono attualmente
solo stato locale React: non vengono salvati tramite API.

## Contratto condiviso

Il backend importa gli schemi da `@workspace/api-zod`, mentre il frontend importa
tipi e hook da `@workspace/api-client-react`. Entrambi sono pacchetti locali
collegati con dipendenze `file:`. Questa separazione mantiene coerenti forme dei
dati, parametri di query e risposte senza duplicare manualmente il contratto tra
client e server.

## Flussi principali

### Studente che cerca una stanza

1. L'utente apre `/` e il frontend chiama `GET /api/listings`.
2. La Home mostra i primi tre annunci e una chiamata parallela a `GET /api/healthz`.
3. La ricerca porta a `/search`; filtri e query producono, per esempio,
	 `GET /api/listings?zone=...&maxPrice=...&furnished=true`.
4. Selezionando un annuncio si apre `/listings/:id`, che chiama
	 `GET /api/listings/:id`.

### Studente che invia un messaggio

1. La pagina dettaglio mostra un dialog informativo di contatto.
2. La sezione `/messages` carica conversazioni e messaggi esistenti.
3. L'invio usa `POST /api/conversations/:id/messages` con `{ "body": "..." }`.
4. Alla risposta positiva il frontend aggiunge il messaggio alla cache React Query
	 e svuota il campo di testo.

### Proprietario che pubblica una stanza

1. Il proprietario apre `/owner/listings/new` e compila titolo, zona, prezzo,
	 descrizione, arredamento, Wi-Fi e numero di foto.
2. Il frontend invia `POST /api/listings`.
3. Il backend valida il payload, crea l'annuncio in memoria e risponde `201`.
4. Il frontend naviga a `/listings/:id` per mostrare l'annuncio appena creato.

## Struttura essenziale

```text
Roomly/
├── backend/
│   ├── src/index.ts                 # bootstrap e PORT
│   ├── src/app.ts                   # middleware e /api
│   ├── src/routes/health.ts         # health check
│   ├── src/routes/roomly.ts         # annunci, chat, dashboard
│   └── local-libs/api-zod/           # schemi e tipi Zod
└── frontend/
		├── src/main.tsx                 # bootstrap React
		├── src/App.tsx                  # shell, pagine e routing
		├── src/lib/i18n.tsx             # lingue e localStorage
		├── src/components/              # ErrorBoundary, lingua e UI
		├── src/pages/not-found.tsx      # fallback 404
		└── local-libs/api-client-react/  # fetch e hook React Query
```
