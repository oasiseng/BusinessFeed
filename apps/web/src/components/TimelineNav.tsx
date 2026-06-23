import { Bell, BriefcaseBusiness, DollarSign, Flame, Inbox, KanbanSquare, Search, Sparkles } from "lucide-react";
import type { FeedView } from "../../../../packages/shared/src/index";

type TimelineNavProps = {
  activeView: FeedView;
  query: string;
  sources: string[];
  activeSource: string | null;
  onViewChange(view: FeedView): void;
  onQueryChange(query: string): void;
  onSourceChange(source: string | null): void;
};

const views: Array<{ id: FeedView; label: string; icon: typeof Sparkles }> = [
  { id: "for-you", label: "For you", icon: Sparkles },
  { id: "latest", label: "Latest", icon: Inbox },
  { id: "needs-action", label: "Action", icon: Bell },
  { id: "money", label: "Money", icon: DollarSign },
  { id: "leads", label: "Leads", icon: Flame },
  { id: "projects", label: "Projects", icon: BriefcaseBusiness }
];

export function TimelineNav({ activeView, query, sources, activeSource, onViewChange, onQueryChange, onSourceChange }: TimelineNavProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="px-4 pt-3 sm:px-5">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-normal text-ink">BusinessFeed</h1>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-md border border-line text-slate-700">
            <KanbanSquare size={19} />
          </div>
        </div>

        <label className="mt-3 flex h-11 items-center gap-2 rounded-md border border-line bg-mist px-3 focus-within:border-action focus-within:bg-white focus-within:shadow-focus">
          <Search size={18} className="shrink-0 text-slate-500" />
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-slate-500"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search activity"
          />
        </label>
      </div>

      <div className="mt-3 flex overflow-x-auto border-t border-line scrollbar-none" role="tablist" aria-label="Feed views">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-tab ${activeView === id ? "nav-tab-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeView === id}
            onClick={() => onViewChange(id)}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {sources.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto px-4 py-2 sm:px-5">
          <button className={`source-chip ${activeSource === null ? "source-chip-active" : ""}`} type="button" onClick={() => onSourceChange(null)}>
            All
          </button>
          {sources.map((source) => (
            <button
              key={source}
              className={`source-chip ${activeSource === source ? "source-chip-active" : ""}`}
              type="button"
              onClick={() => onSourceChange(source)}
            >
              {source}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
