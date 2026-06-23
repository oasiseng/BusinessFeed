import {
  Bookmark,
  BookmarkCheck,
  Check,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  X
} from "lucide-react";
import type { FeedItem } from "../../../../packages/shared/src/index";
import { categoryTone, relativeTime, sourceLabel } from "../lib/format";

type FeedItemCardProps = {
  item: FeedItem;
  onRead(item: FeedItem): void;
  onSave(item: FeedItem): void;
  onDismiss(item: FeedItem): void;
};

export function FeedItemCard({ item, onRead, onSave, onDismiss }: FeedItemCardProps) {
  const visibleMedia = item.imagePolicy === "show" ? item.media?.find((media) => media.kind === "image") : undefined;
  const documents = item.media?.filter((media) => media.kind === "document") ?? [];
  const actor = item.actor?.name ?? item.actor?.email ?? sourceLabel(item);

  return (
    <article className="feed-card border-b border-line bg-white px-4 py-3 transition-colors hover:bg-mist/70 sm:px-5" data-testid="feed-item">
      <div className="grid grid-cols-[44px_1fr] gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-md border border-line bg-ink text-sm font-semibold text-white">
          {sourceLabel(item).slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0">
          <div className="flex min-h-6 items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="max-w-full truncate font-semibold text-ink">{actor}</span>
                <span className="text-slate-500">@{sourceLabel(item).replace(/\s+/g, "").toLowerCase()}</span>
                <span className="text-slate-400">·</span>
                <time className="text-slate-500" dateTime={item.occurredAt}>
                  {relativeTime(item.occurredAt)}
                </time>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${categoryTone(item.category)}`}>
                  {item.category}
                </span>
              </div>
              <h2 className="mt-1 break-words text-[15px] font-semibold leading-5 text-ink">{item.title}</h2>
            </div>
            <button className="icon-button" title="More" type="button">
              <MoreHorizontal size={18} />
            </button>
          </div>

          <p className="mt-1 break-words text-[15px] leading-5 text-slate-800">{item.summary}</p>

          {visibleMedia ? (
            <a className="mt-3 block overflow-hidden rounded-md border border-line bg-slate-100" href={visibleMedia.url} target="_blank" rel="noreferrer">
              <img className="h-auto max-h-[360px] w-full object-cover" src={visibleMedia.url} alt={visibleMedia.label ?? "Business activity media"} loading="lazy" />
            </a>
          ) : null}

          {documents.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {documents.map((doc) => (
                <a
                  key={doc.url}
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-slate-700 hover:border-action hover:text-action"
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ImageIcon size={16} />
                  {doc.label ?? "Attachment"}
                </a>
              ))}
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-5 items-center gap-1 text-slate-500 sm:max-w-md">
            <button className="action-button" title="Mark read" type="button" onClick={() => onRead(item)} aria-pressed={item.state.read}>
              {item.state.read ? <Check size={18} /> : <Eye size={18} />}
              <span>{item.state.read ? "Read" : "Read"}</span>
            </button>
            <button className="action-button" title="Save" type="button" onClick={() => onSave(item)} aria-pressed={item.state.saved}>
              {item.state.saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
              <span>Save</span>
            </button>
            <div className="inline-flex h-9 items-center gap-1 text-sm" title="Priority">
              <MessageCircle size={18} />
              <span>{item.priorityScore}</span>
            </div>
            {item.sourceUrl ? (
              <a className="action-button" title="Open source" href={item.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={18} />
                <span>Open</span>
              </a>
            ) : (
              <span className="h-9" />
            )}
            <button className="action-button justify-self-end" title="Dismiss" type="button" onClick={() => onDismiss(item)}>
              <X size={18} />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
