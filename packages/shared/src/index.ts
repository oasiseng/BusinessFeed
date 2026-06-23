import { createHash } from "node:crypto";
import { z } from "zod";

export const sourceTypes = ["trello", "email", "quickbooks", "quotient", "quo", "website", "zapier", "other"] as const;
export const feedViews = ["for-you", "latest", "needs-action", "money", "leads", "projects"] as const;
export const feedCategories = ["lead", "project", "money", "legal", "task", "message", "admin", "noise"] as const;

export const SourceTypeSchema = z.enum(sourceTypes);
export const FeedViewSchema = z.enum(feedViews);
export const FeedCategorySchema = z.enum(feedCategories);

export const ActorSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional()
  })
  .partial();

export const MediaSchema = z.object({
  url: z.string().trim().min(1),
  kind: z.enum(["image", "document", "link", "video"]),
  label: z.string().trim().min(1).optional(),
  contentType: z.string().trim().min(1).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

export const ActivityEventSchema = z.object({
  source: z.string().trim().min(1),
  sourceType: SourceTypeSchema,
  externalId: z.string().trim().min(1),
  occurredAt: z.string().trim().min(1),
  actor: ActorSchema.optional(),
  title: z.string().trim().min(1),
  body: z.string().trim().optional(),
  url: z.string().trim().min(1).optional(),
  media: z.array(MediaSchema).optional(),
  raw: z.unknown().optional()
});

export const FeedItemStateSchema = z.object({
  read: z.boolean(),
  saved: z.boolean(),
  dismissed: z.boolean()
});

export const FeedItemSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  source: z.string().min(1),
  sourceType: SourceTypeSchema,
  occurredAt: z.string().min(1),
  actor: ActorSchema.optional(),
  summary: z.string().min(1).max(200),
  title: z.string().min(1),
  body: z.string().optional(),
  priorityScore: z.number().int().min(0).max(100),
  category: FeedCategorySchema,
  needsAction: z.boolean(),
  dedupeKey: z.string().min(1),
  imagePolicy: z.enum(["show", "hide"]),
  media: z.array(MediaSchema).optional(),
  sourceUrl: z.string().optional(),
  state: FeedItemStateSchema
});

export const FeedResponseSchema = z.object({
  items: z.array(FeedItemSchema),
  nextCursor: z.string().nullable(),
  generatedAt: z.string()
});

export const ItemStatePatchSchema = z
  .object({
    read: z.boolean().optional(),
    saved: z.boolean().optional(),
    dismissed: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one state field is required");

export type SourceType = z.infer<typeof SourceTypeSchema>;
export type FeedView = z.infer<typeof FeedViewSchema>;
export type FeedCategory = z.infer<typeof FeedCategorySchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type FeedItemState = z.infer<typeof FeedItemStateSchema>;
export type ItemStatePatch = z.infer<typeof ItemStatePatchSchema>;

export type FetchCursor = {
  since?: string;
  cursor?: string;
};

export type SourceAdapter = {
  id: string;
  sourceType: SourceType;
  fetchSince(cursor?: FetchCursor): Promise<ActivityEvent[]>;
};

export type FeedItemDraft = Omit<FeedItem, "id" | "eventId" | "state">;

const actionTerms = [
  "please",
  "confirm",
  "review",
  "approve",
  "question",
  "needed",
  "need",
  "deadline",
  "due",
  "waiting",
  "request",
  "can you",
  "would you",
  "estimate"
];

const leadTerms = ["new lead", "lead", "contact form", "website form", "inquiry", "quote request", "estimate request"];
const projectTerms = ["plan", "drawing", "permit", "project", "site", "field", "inspection", "foundation", "deck", "framing"];
const moneyTerms = ["invoice", "payment", "paid", "deposit", "receipt", "quickbooks", "proposal", "quote", "$"];
const legalTerms = ["claim", "insurance", "attorney", "lawyer", "carrier", "legal", "notice"];
const taskTerms = ["trello", "card", "assigned", "checklist", "due", "todo", "task"];
const noiseTerms = ["newsletter", "unsubscribe", "dmarc", "digest", "promotion", "promo", "no-reply", "noreply"];
const lowSignalMoneyTerms = ["payment received", "receipt", "sales receipt", "quickbooks payment"];
const usefulMediaTerms = ["photo", "image", "site", "field", "plan", "drawing", "screenshot", "attachment", "permit", "project"];
const decorativeMediaTerms = ["logo", "avatar", "profile", "signature", "icon", "banner"];

export function canonicalizeEvent(input: unknown): ActivityEvent {
  const parsed = ActivityEventSchema.parse(input);
  const occurredAt = new Date(parsed.occurredAt);
  const normalized: ActivityEvent = {
    source: parsed.source,
    sourceType: parsed.sourceType,
    externalId: parsed.externalId,
    occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date().toISOString() : occurredAt.toISOString(),
    title: normalizeWhitespace(parsed.title)
  };

  if (parsed.actor && Object.keys(parsed.actor).length > 0) normalized.actor = parsed.actor;
  if (parsed.body) normalized.body = normalizeWhitespace(parsed.body);
  if (parsed.url) normalized.url = parsed.url;
  if (parsed.media && parsed.media.length > 0) normalized.media = parsed.media;
  if (parsed.raw !== undefined) normalized.raw = parsed.raw;
  return normalized;
}

export function toFeedItemDraft(eventInput: ActivityEvent): FeedItemDraft {
  const event = canonicalizeEvent(eventInput);
  const category = categorizeEvent(event);
  const summary = summarizeEvent(event);
  const priorityScore = scoreEvent(event, category);
  const media = event.media?.filter((item) => item.kind === "image" || item.kind === "document");
  const imagePolicy = shouldShowMedia(event) ? "show" : "hide";
  const draft: FeedItemDraft = {
    source: event.source,
    sourceType: event.sourceType,
    occurredAt: event.occurredAt,
    summary,
    title: event.title,
    priorityScore,
    category,
    needsAction: inferNeedsAction(event, category),
    dedupeKey: makeDedupeKey(event),
    imagePolicy
  };

  if (event.actor) draft.actor = event.actor;
  if (event.body) draft.body = event.body;
  if (media && media.length > 0) draft.media = media;
  if (event.url) draft.sourceUrl = event.url;
  return draft;
}

export function summarizeEvent(eventInput: ActivityEvent): string {
  const event = canonicalizeEvent(eventInput);
  const actor = event.actor?.name ?? event.actor?.email;
  const segments = [actor, event.title, event.body].filter(Boolean).map((segment) => normalizeWhitespace(String(segment)));
  const summary = segments.join(": ");
  return trimTo(summary, 200);
}

export function categorizeEvent(eventInput: ActivityEvent): FeedCategory {
  const event = canonicalizeEvent(eventInput);
  const text = searchableText(event);

  if (matchesAny(text, noiseTerms)) return "noise";
  if (matchesAny(text, legalTerms)) return "legal";
  if (event.sourceType === "website" || matchesAny(text, leadTerms)) return "lead";
  if (event.sourceType === "quickbooks" || event.sourceType === "quotient" || matchesAny(text, moneyTerms)) return "money";
  if (event.sourceType === "trello" || matchesAny(text, taskTerms)) return "task";
  if (event.sourceType === "email" || event.sourceType === "quo") return "message";
  if (matchesAny(text, projectTerms)) return "project";
  return "admin";
}

export function scoreEvent(eventInput: ActivityEvent, category = categorizeEvent(eventInput)): number {
  const event = canonicalizeEvent(eventInput);
  const text = searchableText(event);
  let score = 42;

  if (category === "lead") score += 28;
  if (category === "legal") score += 26;
  if (category === "project") score += 18;
  if (category === "task") score += 12;
  if (category === "message") score += 10;
  if (category === "money") score += 8;
  if (category === "noise") score -= 32;

  if (matchesAny(text, actionTerms)) score += 20;
  if (matchesAny(text, projectTerms)) score += 10;
  if (matchesAny(text, legalTerms)) score += 14;
  if (matchesAny(text, lowSignalMoneyTerms) && !matchesAny(text, projectTerms)) score -= 18;
  if (/^(re|fw|fwd):/i.test(event.title)) score -= 4;

  const ageHours = Math.max(0, Date.now() - new Date(event.occurredAt).getTime()) / 36e5;
  if (ageHours < 12) score += 8;
  else if (ageHours > 72) score -= 6;

  return clamp(Math.round(score), 0, 100);
}

export function inferNeedsAction(eventInput: ActivityEvent, category = categorizeEvent(eventInput)): boolean {
  const event = canonicalizeEvent(eventInput);
  const text = searchableText(event);
  if (category === "noise") return false;
  if (category === "lead" || category === "legal") return true;
  return matchesAny(text, actionTerms);
}

export function shouldShowMedia(eventInput: ActivityEvent): boolean {
  const event = canonicalizeEvent(eventInput);
  if (!event.media?.length) return false;
  const usefulText = searchableText(event);
  return event.media.some((item) => {
    const label = `${item.label ?? ""} ${item.contentType ?? ""} ${item.url}`.toLowerCase();
    if (item.kind !== "image" && item.kind !== "document") return false;
    if (matchesAny(label, decorativeMediaTerms)) return false;
    return matchesAny(`${usefulText} ${label}`, usefulMediaTerms);
  });
}

export function makeDedupeKey(eventInput: ActivityEvent): string {
  const event = canonicalizeEvent(eventInput);
  const normalizedTitle = normalizeWhitespace(event.title)
    .replace(/^(re|fw|fwd):\s*/i, "")
    .toLowerCase();
  return hashKey([event.sourceType, event.source, event.externalId || normalizedTitle].join(":"));
}

export function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function trimTo(value: string, maxLength: number): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 80 ? lastSpace : maxLength - 1).trim()}...`;
}

export function parseFeedCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { offset?: number };
    const offset = decoded.offset;
    return typeof offset === "number" && Number.isInteger(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}

export function makeFeedCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function searchableText(event: ActivityEvent): string {
  return `${event.source} ${event.sourceType} ${event.actor?.name ?? ""} ${event.actor?.email ?? ""} ${event.title} ${event.body ?? ""}`.toLowerCase();
}

function matchesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
