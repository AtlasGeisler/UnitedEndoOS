import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PenLine, Send, FileText, BellRing, ArrowRight, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

interface WorklistItem { id: number; label: string; sub: string; href: string }
interface Worklist { key: string; label: string; count: number; items: WorklistItem[] }

const ICONS: Record<string, typeof PenLine> = {
  unsigned_notes: PenLine,
  unsent_reports: Send,
  claims_to_submit: FileText,
  recall_due: BellRing,
};

// Worklists, the operational backbone: savable task queues with inline actions.
// Each row links straight to where the work gets done.
export function Worklists() {
  const { data } = useQuery({ queryKey: ["/api/worklists"], queryFn: () => apiRequest<{ worklists: Worklist[] }>("GET", "/api/worklists") });
  const lists = data?.worklists ?? [];
  const [active, setActive] = useState<string | null>(null);
  const current = lists.find((l) => l.key === (active ?? lists[0]?.key));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hairline px-7 py-4">
        <h1 className="text-[18px] font-semibold">Worklists</h1>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* Queue list */}
        <div className="w-64 shrink-0 border-r border-hairline p-3">
          {lists.map((l) => {
            const Icon = ICONS[l.key] ?? PenLine;
            const on = current?.key === l.key;
            return (
              <button key={l.key} onClick={() => setActive(l.key)} className={cn("mb-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px]", on ? "bg-endo/12 text-endo" : "hover:bg-[var(--surface-2)]")}>
                <Icon className="h-4 w-4" />
                <span className="flex-1 truncate">{l.label}</span>
                <span className={cn("rounded-full px-1.5 text-[11px] tnum", l.count ? "bg-endo/15 text-endo" : "bg-[var(--surface-2)] text-content-soft")}>{l.count}</span>
              </button>
            );
          })}
        </div>

        {/* Items */}
        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          {current && (
            <>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="text-[15px] font-semibold">{current.label}</h2>
                <span className="text-[12px] text-content-soft tnum">{current.count} item{current.count === 1 ? "" : "s"}</span>
              </div>
              {current.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-hairline bg-surface py-16 text-content-soft shadow-card">
                  <CheckCircle2 className="h-7 w-7 text-complete" />
                  <div className="text-[13px]">This queue is clear. Nice work.</div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
                  {current.items.map((it) => (
                    <Link key={`${current.key}-${it.id}`} href={it.href}>
                      <div className="group flex cursor-pointer items-center gap-3 border-b border-hairline px-4 py-2.5 last:border-0 hover:bg-[var(--surface-2)]">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium">{it.label}</div>
                          <div className="truncate text-[12px] text-content-soft">{it.sub}</div>
                        </div>
                        <ArrowRight className="ml-auto h-4 w-4 text-content-soft opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
