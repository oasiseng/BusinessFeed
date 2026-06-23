import cors from "@fastify/cors";
import fastify, { FastifyInstance, FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { normalizeZapierEvent } from "../../../packages/connectors/src/index";
import { ActivityEventSchema, FeedViewSchema, ItemStatePatchSchema } from "../../../packages/shared/src/index";
import { ApiConfig, loadConfig } from "./config";
import { openDatabase, DatabaseHandle } from "./db/client";
import { feedStats, ingestMany, listFeed, updateItemState, upsertActivityEvent } from "./services/ingest";
import { verifyHmacSignature } from "./services/security";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

type CreateAppOptions = Partial<ApiConfig> & {
  db?: DatabaseHandle;
  serveStatic?: boolean;
};

const BatchBodySchema = z.union([z.array(ActivityEventSchema), z.object({ events: z.array(ActivityEventSchema) })]);

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const config = loadConfig(options);
  const handle = options.db ?? (await openDatabase(config.dbPath));
  const app = fastify({ logger: process.env.NODE_ENV === "test" ? false : true });

  app.decorate("dbHandle", handle);
  app.addHook("onClose", async () => {
    if (!options.db) handle.close();
  });

  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request: FastifyRequest, body, done) => {
    request.rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
    try {
      const text = request.rawBody.toString("utf8");
      done(null, text.length ? JSON.parse(text) : {});
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  await app.register(cors, { origin: true });

  app.get("/api/health", async () => ({
    ok: true,
    generatedAt: new Date().toISOString(),
    stats: feedStats(handle)
  }));

  app.get("/api/feed", async (request) => {
    const query = z
      .object({
        view: FeedViewSchema.default("for-you"),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().positive().max(50).default(30),
        source: z.string().optional(),
        q: z.string().optional()
      })
      .parse(request.query);
    const result = listFeed(handle, {
      view: query.view,
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.q ? { q: query.q } : {})
    });
    return {
      ...result,
      generatedAt: new Date().toISOString()
    };
  });

  app.post("/api/ingest/zapier", async (request, reply) => {
    if (!config.allowUnsignedWebhooks) {
      if (!config.webhookSecret) return reply.code(500).send({ error: "WEBHOOK_SECRET is required when unsigned webhooks are disabled" });
      const signature = request.headers["x-businessfeed-signature"];
      const signatureValue = Array.isArray(signature) ? signature[0] : signature;
      if (!request.rawBody || !verifyHmacSignature(request.rawBody, signatureValue, config.webhookSecret)) {
        return reply.code(401).send({ error: "Invalid webhook signature" });
      }
    }

    const item = upsertActivityEvent(handle, normalizeZapierEvent(request.body));
    return reply.code(201).send({ item });
  });

  app.post("/api/ingest/batch", async (request, reply) => {
    const parsed = BatchBodySchema.parse(request.body);
    const events = Array.isArray(parsed) ? parsed : parsed.events;
    const items = ingestMany(handle, events);
    return reply.code(201).send({ items, count: items.length });
  });

  app.post("/api/items/:id/state", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const patch = ItemStatePatchSchema.parse(request.body);
    const item = updateItemState(handle, params.id, patch);
    if (!item) return reply.code(404).send({ error: "Feed item not found" });
    return { item };
  });

  if (options.serveStatic !== false) registerStatic(app, config);

  return app;
}

function registerStatic(app: FastifyInstance, config: ApiConfig): void {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const defaultDist = resolve(currentDir, "../../web/dist");
  const dist = config.webDistDir ? resolve(config.webDistDir) : defaultDist;
  if (!existsSync(join(dist, "index.html"))) {
    app.get("/", async () => ({ name: "BusinessFeed API", web: "Run npm run build to serve the web app from the API." }));
    return;
  }

  app.register(fastifyStatic, {
    root: dist,
    prefix: "/"
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) return reply.code(404).send({ error: "Not found" });
    return reply.sendFile("index.html");
  });
}
