# Roomly – Frontend

Frontend standalone estratto dal monorepo Roomly (React + TypeScript + Vite).

## Setup

```
npm install
npm run dev
```

L'app sarà disponibile su http://localhost:5173

## Note

- Il pacchetto `@workspace/api-client-react` è incluso localmente in `local-libs/api-client-react`
  (dipendenza `file:` nel package.json) perché nel monorepo originale era gestito da pnpm workspace.
- I plugin Vite specifici di Replit (`@replit/vite-plugin-*`) sono stati rimossi: servivano solo
  nell'ambiente Replit e non sono necessari per lo sviluppo locale.
- L'immagine del logo (prima in `attached_assets/`) è ora in `assets/`.
- Questo frontend parla con il backend Roomly (progetto separato `roomly-backend`) tramite un
  proxy Vite: ogni richiesta a `/api/...` viene inoltrata a `BACKEND_URL` (default
  `http://localhost:3001`, vedi `.env`). Avvia il backend PRIMA o insieme al frontend, altrimenti
  le chiamate API falliranno.

## Build

```
npm run build
```

Output in `dist/public`.
