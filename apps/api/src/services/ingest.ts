import { eq } from "drizzle-orm";
import {
  ActivityEvent,
  FeedItem,
  FeedView,
  ItemStatePatch,
  canonicalizeEvent,
  hashKey,
  makeFeedCursor,
  parseFeedCursor,
  toFeedItemDraft
} from "../../../../packages/shared/src/index";
import { activityEvents, feedItems } from "../db/schema";
import { DatabaseHandle } from "../db/client";

export type FeedQuery = {
  view: FeedView;
  cursor?: string;
  limit: number;
  source?: string;
  q?: string;
};

type JoinedFeedRow = {
  item_id: string;
  event_id: string;
  source: string;
  source_type: string;
  external_id: string;
  occurred_at_ms: number;
  actor_name: string | null;
  actor_email: string | null;
  title: string;
  body: string | null;
  media_json: string | null;
  summary: string;
  priority_score: number;
  category: string;
  needs_action: number;
  dedupe_key: string;
  image_policy: string;
  source_url: string | null;
  read: number;
  saved: number;
  dismissed: number;
  created_at_ms: number;
};

export function upsertActivityEvent(handle: DatabaseHandle, input: ActivityEvent, options: { persist?: boolean } = {}): FeedItem {
  const event = canonicalizeEvent(input);
  const now = Date.now();
  const occurredAtMs = new Date(event.occurredAt).getTime();
  const eventId = hashKey(`${event.sourceType}:${event.source}:${event.externalId}`);
  const draft = toFeedItemDraft(event);
  const feedId = hashKey(`feed:${draft.dedupeKey}`);

  handle.db
    .insert(activityEvents)
    .values({
      id: eventId,
      source: event.source,
      sourceType: event.sourceType,
      externalId: event.externalId,
      occurredAtMs,
      actorName: event.actor?.name ?? null,
      actorEmail: event.actor?.email ?? null,
      title: event.title,
      body: event.body ?? null,
      url: event.url ?? null,
      mediaJson: event.media ? JSON.stringify(event.media) : null,
      rawJson: event.raw === undefined ? null : JSON.stringify(event.raw),
      insertedAtMs: now,
      updatedAtMs: now
    })
    .onConflictDoUpdate({
      target: activityEvents.id,
      set: {
        occurredAtMs,
        actorName: event.actor?.name ?? null,
        actorEmail: event.actor?.email ?? null,
        title: event.title,
        body: event.body ?? null,
        url: event.url ?? null,
        mediaJson: event.media ? JSON.stringify(event.media) : null,
        rawJson: event.raw === undefined ? null : JSON.stringify(event.raw),
        updatedAtMs: now
      }
    })
    .run();

  handle.db
    .insert(feedItems)
    .values({
      id: feedId,
      eventId,
      summary: draft.summary,
      priorityScore: draft.priorityScore,
      category: draft.category,
      needsAction: draft.needsAction,
      dedupeKey: draft.dedupeKey,
      imagePolicy: draft.imagePolicy,
      sourceUrl: draft.sourceUrl ?? null,
      createdAtMs: now,
      updatedAtMs: now
    })
    .onConflictDoUpdate({
      target: feedItems.id,
      set: {
        eventId,
        summary: draft.summary,
        priorityScore: draft.priorityScore,
        category: draft.category,
        needsAction: draft.needsAction,
        imagePolicy: draft.imagePolicy,
        sourceUrl: draft.sourceUrl ?? null,
        updatedAtMs: now
      }
    })
    .run();

  const row = selectFeedItem(handle, feedId);
  if (!row) throw new Error("Feed item was not persisted");
  if (options.persist !== false) handle.persist();
  return rowToFeedItem(row);
}

export function ingestMany(handle: DatabaseHandle, events: ActivityEvent[]): FeedItem[] {
  handle.sqlite.run("BEGIN");
  try {
    const items = events.map((item) => upsertActivityEvent(handle, item, { persist: false }));
    handle.sqlite.run("COMMIT");
    handle.persist();
    return items;
  } catch (error) {
    handle.sqlite.run("ROLLBACK");
    throw error;
  }
}

export function listFeed(handle: DatabaseHandle, query: FeedQuery): { items: FeedItem[]; nextCursor: string | null } {
  const offset = parseFeedCursor(query.cursor);
  const rows = selectFeedRows(handle)
    .map(rowToFeedItem)
    .filter((item) => !item.state.dismissed)
    .filter((item) => filterByView(item, query.view))
    .filter((item) => (query.source ? item.source.toLowerCase() === query.source?.toLowerCase() : true))
    .filter((item) => {
      if (!query.q) return true;
      const q = query.q.toLowerCase();
      return `${item.title} ${item.summary} ${item.body ?? ""} ${item.actor?.name ?? ""} ${item.actor?.email ?? ""}`.toLowerCase().includes(q);
    })
    .sort((a, b) => sortForView(a, b, query.view));

  const page = rows.slice(offset, offset + query.limit);
  const nextOffset = offset + page.length;
  return {
    items: page,
    nextCursor: nextOffset < rows.length ? makeFeedCursor(nextOffset) : null
  };
}

export function updateItemState(handle: DatabaseHandle, id: string, patch: ItemStatePatch): FeedItem | null {
  const existing = selectFeedItem(handle, id);
  if (!existing) return null;
  handle.db
    .update(feedItems)
    .set({
      ...(patch.read !== undefined ? { read: patch.read } : {}),
      ...(patch.saved !== undefined ? { saved: patch.saved } : {}),
      ...(patch.dismissed !== undefined ? { dismissed: patch.dismissed } : {}),
      updatedAtMs: Date.now()
    })
    .where(eq(feedItems.id, id))
    .run();
  handle.persist();
  const row = selectFeedItem(handle, id);
  return row ? rowToFeedItem(row) : null;
}

export function feedStats(handle: DatabaseHandle): { total: number; needsAction: number; saved: number } {
  const items = selectFeedRows(handle).map(rowToFeedItem).filter((item) => !item.state.dismissed);
  return {
    total: items.length,
    needsAction: items.filter((item) => item.needsAction).length,
    saved: items.filter((item) => item.state.saved).length
  };
}

function selectFeedRows(handle: DatabaseHandle): JoinedFeedRow[] {
  return handle.queryAll<JoinedFeedRow>(
    `
      SELECT
        fi.id AS item_id,
        fi.event_id,
        ae.source,
        ae.source_type,
        ae.external_id,
        ae.occurred_at_ms,
        ae.actor_name,
        ae.actor_email,
        ae.title,
        ae.body,
        ae.media_json,
        fi.summary,
        fi.priority_score,
        fi.category,
        fi.needs_action,
        fi.dedupe_key,
        fi.image_policy,
        fi.source_url,
        fi.read,
        fi.saved,
        fi.dismissed,
        fi.created_at_ms
      FROM feed_items fi
      INNER JOIN activity_events ae ON ae.id = fi.event_id
      `
  );
}

function selectFeedItem(handle: DatabaseHandle, id: string): JoinedFeedRow | null {
  return (
    handle.queryAll<JoinedFeedRow>(
      `
      SELECT
        fi.id AS item_id,
        fi.event_id,
        ae.source,
        ae.source_type,
        ae.external_id,
        ae.occurred_at_ms,
        ae.actor_name,
        ae.actor_email,
        ae.title,
        ae.body,
        ae.media_json,
        fi.summary,
        fi.priority_score,
        fi.category,
        fi.needs_action,
        fi.dedupe_key,
        fi.image_policy,
        fi.source_url,
        fi.read,
        fi.saved,
        fi.dismissed,
        fi.created_at_ms
      FROM feed_items fi
      INNER JOIN activity_events ae ON ae.id = fi.event_id
      WHERE fi.id = ?
      `,
      [id]
    )[0] ?? null
  );
}

function rowToFeedItem(row: JoinedFeedRow): FeedItem {
  const media = row.media_json ? JSON.parse(row.media_json) : undefined;
  const actor = row.actor_name || row.actor_email ? { ...(row.actor_name ? { name: row.actor_name } : {}), ...(row.actor_email ? { email: row.actor_email } : {}) } : undefined;
  const item: FeedItem = {
    id: row.item_id,
    eventId: row.event_id,
    source: row.source,
    sourceType: row.source_type as FeedItem["sourceType"],
    occurredAt: new Date(row.occurred_at_ms).toISOString(),
    summary: row.summary,
    title: row.title,
    priorityScore: row.priority_score,
    category: row.category as FeedItem["category"],
    needsAction: Boolean(row.needs_action),
    dedupeKey: row.dedupe_key,
    imagePolicy: row.image_policy as FeedItem["imagePolicy"],
    state: {
      read: Boolean(row.read),
      saved: Boolean(row.saved),
      dismissed: Boolean(row.dismissed)
    }
  };

  if (actor) item.actor = actor;
  if (row.body) item.body = row.body;
  if (media) item.media = media;
  if (row.source_url) item.sourceUrl = row.source_url;
  return item;
}

function filterByView(item: FeedItem, view: FeedView): boolean {
  if (view === "needs-action") return item.needsAction;
  if (view === "money") return item.category === "money";
  if (view === "leads") return item.category === "lead";
  if (view === "projects") return item.category === "project" || item.category === "task";
  return true;
}

function sortForView(a: FeedItem, b: FeedItem, view: FeedView): number {
  if (view === "latest") return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  if (a.state.saved !== b.state.saved) return Number(b.state.saved) - Number(a.state.saved);
  if (a.needsAction !== b.needsAction) return Number(b.needsAction) - Number(a.needsAction);
  if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
  return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
}
