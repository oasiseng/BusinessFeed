import { z } from "zod";
import {
  ActivityEvent,
  ActivityEventSchema,
  SourceAdapter,
  SourceType,
  canonicalizeEvent,
  normalizeWhitespace
} from "../../shared/src/index";

export type TrelloAdapterOptions = {
  apiKey: string;
  token: string;
  query: string;
  sourceName?: string;
};

export type OutlookAdapterOptions = {
  graphToken: string;
  sourceName?: string;
};

const TrelloCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string().optional().nullable(),
  dateLastActivity: z.string().optional().nullable(),
  due: z.string().optional().nullable(),
  shortUrl: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  idMembers: z.array(z.string()).optional(),
  labels: z.array(z.object({ name: z.string().optional().nullable() })).optional(),
  badges: z
    .object({
      attachments: z.number().optional(),
      comments: z.number().optional(),
      checklistItems: z.number().optional(),
      checklistItemsChecked: z.number().optional()
    })
    .optional()
});

const OutlookMessageSchema = z.object({
  id: z.string(),
  subject: z.string().optional().nullable(),
  bodyPreview: z.string().optional().nullable(),
  receivedDateTime: z.string().optional().nullable(),
  sentDateTime: z.string().optional().nullable(),
  webLink: z.string().optional().nullable(),
  from: z
    .object({
      emailAddress: z
        .object({
          name: z.string().optional().nullable(),
          address: z.string().optional().nullable()
        })
        .optional()
        .nullable()
    })
    .optional()
    .nullable(),
  hasAttachments: z.boolean().optional().nullable()
});

const GenericZapierSchema = z
  .object({
    source: z.string().optional(),
    sourceType: z.string().optional(),
    externalId: z.string().optional(),
    id: z.string().optional(),
    occurredAt: z.string().optional(),
    timestamp: z.string().optional(),
    createdAt: z.string().optional(),
    title: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
    description: z.string().optional(),
    url: z.string().optional(),
    link: z.string().optional(),
    actor: z
      .union([
        z.string(),
        z.object({
          name: z.string().optional(),
          email: z.string().optional()
        })
      ])
      .optional(),
    actorName: z.string().optional(),
    actorEmail: z.string().optional(),
    media: z.array(z.unknown()).optional()
  })
  .passthrough();

export class TrelloAdapter implements SourceAdapter {
  readonly id = "trello";
  readonly sourceType = "trello" as const;
  private readonly options: TrelloAdapterOptions;

  constructor(options: TrelloAdapterOptions) {
    this.options = options;
  }

  async fetchSince(): Promise<ActivityEvent[]> {
    const params = new URLSearchParams({
      key: this.options.apiKey,
      token: this.options.token,
      query: this.options.query,
      modelTypes: "cards",
      card_fields: "id,name,desc,dateLastActivity,due,shortUrl,url,idMembers,labels,badges",
      cards_limit: "50"
    });
    const response = await fetch(`https://api.trello.com/1/search?${params.toString()}`);
    if (!response.ok) throw new Error(`Trello search failed: ${response.status}`);
    const payload = (await response.json()) as { cards?: unknown[] };
    return (payload.cards ?? []).map((card) => mapTrelloCard(card, this.options.sourceName ?? "Trello"));
  }
}

export class OutlookAdapter implements SourceAdapter {
  readonly id = "outlook";
  readonly sourceType = "email" as const;
  private readonly options: OutlookAdapterOptions;

  constructor(options: OutlookAdapterOptions) {
    this.options = options;
  }

  async fetchSince(): Promise<ActivityEvent[]> {
    const params = new URLSearchParams({
      "$select": "id,subject,bodyPreview,receivedDateTime,sentDateTime,webLink,from,hasAttachments",
      "$top": "50",
      "$orderby": "receivedDateTime desc"
    });
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`, {
      headers: { Authorization: `Bearer ${this.options.graphToken}` }
    });
    if (!response.ok) throw new Error(`Outlook message fetch failed: ${response.status}`);
    const payload = (await response.json()) as { value?: unknown[] };
    return (payload.value ?? []).map((message) => mapOutlookMessage(message, this.options.sourceName ?? "Outlook"));
  }
}

export function mapTrelloCard(input: unknown, source = "Trello"): ActivityEvent {
  const card = TrelloCardSchema.parse(input);
  const labelText = card.labels?.map((label) => label.name).filter(Boolean).join(", ");
  const checklist =
    card.badges?.checklistItems && card.badges.checklistItems > 0
      ? `${card.badges.checklistItemsChecked ?? 0}/${card.badges.checklistItems} checklist items`
      : undefined;
  const body = [card.desc, labelText ? `Labels: ${labelText}` : undefined, checklist, card.due ? `Due ${card.due}` : undefined]
    .filter(Boolean)
    .join(" | ");

  const event: ActivityEvent = {
    source,
    sourceType: "trello",
    externalId: card.id,
    occurredAt: card.dateLastActivity ?? card.due ?? new Date().toISOString(),
    title: card.name
  };

  if (body) event.body = normalizeWhitespace(body);
  if (card.shortUrl ?? card.url) event.url = card.shortUrl ?? card.url ?? undefined;
  event.raw = card;
  return canonicalizeEvent(event);
}

export function mapOutlookMessage(input: unknown, source = "Outlook"): ActivityEvent {
  const message = OutlookMessageSchema.parse(input);
  const actorName = message.from?.emailAddress?.name ?? undefined;
  const actorEmail = message.from?.emailAddress?.address ?? undefined;
  const event: ActivityEvent = {
    source,
    sourceType: "email",
    externalId: message.id,
    occurredAt: message.receivedDateTime ?? message.sentDateTime ?? new Date().toISOString(),
    title: message.subject || "(no subject)"
  };

  if (message.bodyPreview) event.body = message.bodyPreview;
  if (message.webLink) event.url = message.webLink;
  if (actorName || actorEmail) event.actor = { ...(actorName ? { name: actorName } : {}), ...(actorEmail ? { email: actorEmail } : {}) };
  if (message.hasAttachments) event.media = [{ kind: "document", url: message.webLink ?? `outlook:${message.id}`, label: "message attachment" }];
  event.raw = message;
  return canonicalizeEvent(event);
}

export function normalizeZapierEvent(input: unknown): ActivityEvent {
  const direct = ActivityEventSchema.safeParse(input);
  if (direct.success) return canonicalizeEvent(direct.data);

  const payload = GenericZapierSchema.parse(input);
  const sourceType = normalizeSourceType(payload.sourceType ?? payload.source);
  const actor = normalizeActor(payload.actor, payload.actorName, payload.actorEmail);
  const event: ActivityEvent = {
    source: payload.source ?? inferSourceName(sourceType),
    sourceType,
    externalId: payload.externalId ?? payload.id ?? `${sourceType}-${Date.now()}`,
    occurredAt: payload.occurredAt ?? payload.timestamp ?? payload.createdAt ?? new Date().toISOString(),
    title: payload.title ?? payload.subject ?? `${inferSourceName(sourceType)} activity`
  };

  const body = payload.body ?? payload.description;
  const url = payload.url ?? payload.link;
  if (body) event.body = body;
  if (url) event.url = url;
  if (actor) event.actor = actor;
  if (payload.media) event.media = normalizeMedia(payload.media);
  event.raw = payload;
  return canonicalizeEvent(event);
}

function normalizeSourceType(value: string | undefined): SourceType {
  const normalized = value?.toLowerCase().replace(/\s+/g, "");
  if (normalized?.includes("trello")) return "trello";
  if (normalized?.includes("email") || normalized?.includes("outlook") || normalized?.includes("gmail")) return "email";
  if (normalized?.includes("quickbooks")) return "quickbooks";
  if (normalized?.includes("quotient")) return "quotient";
  if (normalized?.includes("quo")) return "quo";
  if (normalized?.includes("website") || normalized?.includes("form")) return "website";
  if (normalized?.includes("zapier")) return "zapier";
  return "other";
}

function inferSourceName(sourceType: SourceType): string {
  const names: Record<SourceType, string> = {
    trello: "Trello",
    email: "Email",
    quickbooks: "QuickBooks",
    quotient: "Quotient",
    quo: "Quo",
    website: "Website",
    zapier: "Zapier",
    other: "Business"
  };
  return names[sourceType];
}

function normalizeActor(actor: unknown, actorName?: string, actorEmail?: string): ActivityEvent["actor"] | undefined {
  if (typeof actor === "string" && actor.trim()) return { name: actor.trim() };
  if (actor && typeof actor === "object") {
    const parsed = z.object({ name: z.string().optional(), email: z.string().email().optional() }).safeParse(actor);
    if (parsed.success) return parsed.data;
  }
  if (actorName || actorEmail) return { ...(actorName ? { name: actorName } : {}), ...(actorEmail ? { email: actorEmail } : {}) };
  return undefined;
}

function normalizeMedia(media: unknown[]): ActivityEvent["media"] {
  const normalized: NonNullable<ActivityEvent["media"]> = [];
  for (const item of media) {
    const parsed = z
      .object({
        url: z.string(),
        kind: z.enum(["image", "document", "link", "video"]).optional(),
        label: z.string().optional(),
        contentType: z.string().optional()
      })
      .safeParse(item);
    if (!parsed.success) continue;
    normalized.push({
      url: parsed.data.url,
      kind: parsed.data.kind ?? inferMediaKind(parsed.data.url, parsed.data.contentType),
      ...(parsed.data.label ? { label: parsed.data.label } : {}),
      ...(parsed.data.contentType ? { contentType: parsed.data.contentType } : {})
    });
  }
  return normalized;
}

function inferMediaKind(url: string, contentType?: string): "image" | "document" | "link" | "video" {
  const text = `${url} ${contentType ?? ""}`.toLowerCase();
  if (/\.(png|jpe?g|webp|gif)(\?|$)/.test(text) || text.includes("image/")) return "image";
  if (/\.(mp4|mov|webm)(\?|$)/.test(text) || text.includes("video/")) return "video";
  if (/\.(pdf|docx?|xlsx?|pptx?)(\?|$)/.test(text)) return "document";
  return "link";
}
