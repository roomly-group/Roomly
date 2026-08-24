# Roomly – Backend (api-server)

Backend Express standalone, estratto dal monorepo Roomly. Dati in memoria (nessun database richiesto).

## Setup

```
npm install
npm run dev
```

Il server parte su http://localhost:3001 (impostabile via `.env`, variabile `PORT`).

## Endpoint disponibili (prefisso /api)

- GET  /api/healthz
- GET  /api/listings
- POST /api/listings
- GET  /api/listings/:id
- GET  /api/conversations
- GET  /api/conversations/:id/messages
- POST /api/conversations/:id/messages
- GET  /api/dashboard/owner

## Note

- `@workspace/api-zod` (validazione con zod) è incluso localmente in `local-libs/api-zod`.
- `@workspace/db` non è usato realmente dal codice, quindi non è stato incluso.
- I dati (listings, conversazioni, messaggi) vivono in memoria e si resettano ad ogni riavvio.
