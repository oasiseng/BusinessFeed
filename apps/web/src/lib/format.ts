import type { FeedItem } from "../../../../packages/shared/src/index";

export function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(delta / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function sourceLabel(item: FeedItem): string {
  if (item.sourceType === "quickbooks") return "QuickBooks";
  if (item.sourceType === "quotient") return "Quotient";
  if (item.sourceType === "trello") return "Trello";
  if (item.sourceType === "website") return "Website";
  if (item.sourceType === "email") return item.source;
  return item.source;
}

export function categoryTone(category: FeedItem["category"]): string {
  const tones: Record<FeedItem["category"], string> = {
    lead: "text-lead bg-amber-50 border-amber-200",
    project: "text-action bg-blue-50 border-blue-200",
    money: "text-money bg-emerald-50 border-emerald-200",
    legal: "text-legal bg-rose-50 border-rose-200",
    task: "text-violet-700 bg-violet-50 border-violet-200",
    message: "text-sky-700 bg-sky-50 border-sky-200",
    admin: "text-slate-700 bg-slate-50 border-slate-200",
    noise: "text-slate-500 bg-slate-50 border-slate-200"
  };
  return tones[category];
}
