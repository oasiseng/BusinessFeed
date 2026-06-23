import { BookmarkCheck, CircleDollarSign, ShieldAlert, Zap } from "lucide-react";
import type { FeedItem } from "../../../../packages/shared/src/index";

type SideRailProps = {
  items: FeedItem[];
};

export function SideRail({ items }: SideRailProps) {
  const needsAction = items.filter((item) => item.needsAction).length;
  const saved = items.filter((item) => item.state.saved).length;
  const money = items.filter((item) => item.category === "money").length;
  const legal = items.filter((item) => item.category === "legal").length;

  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[280px] shrink-0 overflow-y-auto px-4 py-2 xl:block">
      <div className="space-y-3">
        <Metric icon={Zap} label="Action" value={needsAction} tone="text-action" />
        <Metric icon={BookmarkCheck} label="Saved" value={saved} tone="text-violet-700" />
        <Metric icon={CircleDollarSign} label="Money" value={money} tone="text-money" />
        <Metric icon={ShieldAlert} label="Claims" value={legal} tone="text-legal" />
      </div>
    </aside>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Zap; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div className={`grid h-9 w-9 place-items-center rounded-md bg-mist ${tone}`}>
          <Icon size={18} />
        </div>
        <span className="text-2xl font-bold text-ink">{value}</span>
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-700">{label}</div>
    </div>
  );
}
