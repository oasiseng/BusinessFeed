import type { FeedItem, FeedView, ItemStatePatch } from "../../../../packages/shared/src/index";

export type FeedResponse = {
  items: FeedItem[];
  nextCursor: string | null;
  generatedAt: string;
};

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export async function fetchFeed(params: {
  view: FeedView;
  cursor?: string | null | undefined;
  source?: string | null | undefined;
  q?: string | undefined;
}): Promise<FeedResponse> {
  const query = new URLSearchParams({ view: params.view, limit: "20" });
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.source) query.set("source", params.source);
  if (params.q) query.set("q", params.q);
  const response = await fetch(`${baseUrl}/api/feed?${query.toString()}`);
  if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
  return (await response.json()) as FeedResponse;
}

export async function updateFeedItemState(id: string, patch: ItemStatePatch): Promise<FeedItem> {
  const response = await fetch(`${baseUrl}/api/items/${id}/state`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!response.ok) throw new Error(`State update failed: ${response.status}`);
  const payload = (await response.json()) as { item: FeedItem };
  return payload.item;
}
