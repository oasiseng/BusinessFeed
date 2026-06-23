# BusinessFeed

BusinessFeed is a self-hosted activity feed for small business owners who want the speed of a social timeline without handing private operations data to a hosted product. It normalizes activity from tools like Trello, Outlook, QuickBooks, Quotient, website forms, and message systems into concise feed items.

The first implementation is read-only for external systems. It ranks and summarizes activity, stores local feed state, and links back to source systems.

## What is included

- React + Vite timeline UI with dense filters, source chips, saved/read/dismissed state, and useful-media rendering.
- Fastify API backed by local SQLite and Drizzle schema definitions.
- Shared Zod schemas for `ActivityEvent`, `FeedItem`, and `SourceAdapter`.
- Read-only connector shapes for Trello, Outlook/Microsoft Graph, and generic Zapier/webhook ingestion.
- Fixture data for Trello cards, email previews, QuickBooks/payment events, website leads, Quotient proposals, and Quo-style messages.
- Unit, API, fixture, secret-safety, and Playwright test scaffolding.

## Quick start

```powershell
npm install
Copy-Item .env.example .env
npm run seed
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

The API runs on [http://127.0.0.1:4317](http://127.0.0.1:4317). The local database defaults to `./data/businessfeed.sqlite`.

## Production build

```powershell
npm run build
npm run seed
npm run start -w @businessfeed/api
```

After `npm run build`, the API serves the compiled web app from `apps/web/dist`.

## Docker

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

## Connector model

BusinessFeed is open-source, but your business data stays in your own database. Credentials live only in `.env`, which is ignored by Git.

- Trello: set `TRELLO_API_KEY`, `TRELLO_TOKEN`, and `TRELLO_QUERY`.
- Outlook: set `OUTLOOK_GRAPH_TOKEN` for a Microsoft Graph token with read access.
- Zapier: post normalized events to `POST /api/ingest/zapier` with an HMAC signature.

Zapier requests are signed as:

```text
x-businessfeed-signature: sha256=<hex hmac of raw JSON body using WEBHOOK_SECRET>
```

For local-only experiments, set `ALLOW_UNSIGNED_WEBHOOKS=true`.

## Event shape

```ts
type ActivityEvent = {
  source: string;
  sourceType: "trello" | "email" | "quickbooks" | "quotient" | "quo" | "website" | "zapier" | "other";
  externalId: string;
  occurredAt: string;
  actor?: { name?: string; email?: string };
  title: string;
  body?: string;
  url?: string;
  media?: Array<{ url: string; kind: "image" | "document" | "link" | "video"; label?: string }>;
  raw?: unknown;
};
```

## Privacy defaults

- No raw private activity dumps are committed.
- `.env`, SQLite files, logs, and local data are ignored.
- External-system actions are not implemented in v1; feed state changes are local only.
- Summaries are deterministic by default and do not invent missing facts.
