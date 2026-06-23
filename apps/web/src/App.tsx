import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeedItem, FeedView } from "../../../packages/shared/src/index";
import { FeedItemCard } from "./components/FeedItemCard";
import { SideRail } from "./components/SideRail";
import { TimelineNav } from "./components/TimelineNav";
import { fetchFeed, updateFeedItemState } from "./lib/api";

export function App() {
  const [view, setView] = useState<FeedView>("for-you");
  const [query, setQuery] = useState("");
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const queryRef = useRef(0);

  const sources = useMemo(() => Array.from(new Set(items.map((item) => item.source))).sort(), [items]);

  const loadFeed = useCallback(
    async ({ append, cursor }: { append: boolean; cursor?: string | null }) => {
      const requestId = ++queryRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await fetchFeed({ view, cursor, source: activeSource, q: query.trim() });
        if (requestId !== queryRef.current) return;
        setItems((current) => (append ? mergeItems(current, result.items) : result.items));
        setNextCursor(result.nextCursor);
      } catch (feedError) {
        if (requestId === queryRef.current) setError(feedError instanceof Error ? feedError.message : "Feed request failed");
      } finally {
        if (requestId === queryRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [activeSource, query, view]
  );

  useEffect(() => {
    void loadFeed({ append: false });
  }, [loadFeed]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !loadingMore && !loading) {
          void loadFeed({ append: true, cursor: nextCursor });
        }
      },
      { rootMargin: "420px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadFeed, loading, loadingMore, nextCursor]);

  async function updateItem(item: FeedItem, patch: Parameters<typeof updateFeedItemState>[1]) {
    const updated = await updateFeedItemState(item.id, patch);
    setItems((current) => current.map((candidate) => (candidate.id === item.id ? updated : candidate)).filter((candidate) => !candidate.state.dismissed));
  }

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="mx-auto flex max-w-[1180px] justify-center gap-4">
        <nav className="sticky top-0 hidden h-screen w-[220px] shrink-0 border-r border-line bg-mist px-4 py-4 lg:block">
          <div className="text-2xl font-black tracking-normal">BF</div>
          <div className="mt-5 space-y-1 text-[15px] font-semibold text-slate-700">
            <button className="side-button side-button-active" type="button">
              Timeline
            </button>
            <button className="side-button" type="button">
              Saved
            </button>
            <button className="side-button" type="button">
              Sources
            </button>
          </div>
        </nav>

        <main className="min-h-screen w-full max-w-[640px] border-x border-line bg-white">
          <TimelineNav
            activeView={view}
            query={query}
            sources={sources}
            activeSource={activeSource}
            onViewChange={setView}
            onQueryChange={setQuery}
            onSourceChange={setActiveSource}
          />

          {error ? (
            <div className="border-b border-line px-5 py-6 text-sm font-medium text-legal">{error}</div>
          ) : loading ? (
            <FeedSkeleton />
          ) : items.length === 0 ? (
            <div className="border-b border-line px-5 py-10 text-center text-sm font-medium text-slate-600">No activity found</div>
          ) : (
            items.map((item) => (
              <FeedItemCard
                key={item.id}
                item={item}
                onRead={(target) => void updateItem(target, { read: !target.state.read })}
                onSave={(target) => void updateItem(target, { saved: !target.state.saved })}
                onDismiss={(target) => void updateItem(target, { dismissed: true })}
              />
            ))
          )}

          <div ref={sentinelRef} className="h-12 border-b border-line">
            {loadingMore ? <div className="px-5 py-3 text-sm text-slate-500">Loading</div> : null}
          </div>
        </main>

        <SideRail items={items} />
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[44px_1fr] gap-3 px-5 py-4">
          <div className="h-11 w-11 rounded-md bg-slate-200" />
          <div className="space-y-2">
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="h-4 w-full rounded bg-slate-200" />
            <div className="h-4 w-5/6 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function mergeItems(current: FeedItem[], incoming: FeedItem[]): FeedItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return Array.from(byId.values());
}
