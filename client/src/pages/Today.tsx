import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Sparkles, CalendarCheck, ShieldAlert, FileWarning, Send, Bell, TrendingUp,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Huddle {
  date: string;
  scheduled: number;
  unconfirmed: number;
  emergencyOpen: number;
  productionCents: number;
  goalCents: number;
  unsignedNotes: number;
  reportsDue: number;
  alerts: { id: number; message: string; severity: string }[];
  brief: string;
}

// The Today page is the morning huddle: production against goal, emergency slot
// status, unconfirmed patients, yesterday's unsigned notes, referral SLA flags,
// and an AI written one paragraph brief.
export function Today() {
  const { data } = useQuery({ queryKey: ["/api/today"], queryFn: () => apiRequest<Huddle>("GET", "/api/today") });
  if (!data) return <div className="flex h-full items-center justify-center text-[13px] text-content-soft">Loading huddle...</div>;

  const pct = Math.min(100, Math.round((data.productionCents / data.goalCents) * 100));

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-hairline px-7 py-4">
        <div className="font-serif text-[22px] font-semibold">Good morning</div>
        <div className="text-[13px] text-content-soft">{format(new Date(data.date), "EEEE, MMMM d, yyyy")}, morning huddle</div>
      </div>

      <div className="space-y-5 p-6">
        {/* AI brief */}
        <div className="rounded-card border border-endo/25 bg-endo/6 p-4 shadow-card">
          <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-endo">
            <Sparkles className="h-4 w-4" /> Huddle brief
          </div>
          <p className="text-[14px] leading-relaxed text-content">{data.brief}</p>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={CalendarCheck} label="Scheduled today" value={String(data.scheduled)} sub={`${data.unconfirmed} unconfirmed`} tone={data.unconfirmed ? "caution" : "ok"} />
          <Metric icon={ShieldAlert} label="Emergency slots open" value={String(data.emergencyOpen)} sub="Held per the Thanksgiving Rule" tone="info" />
          <Metric icon={FileWarning} label="Unsigned notes" value={String(data.unsignedNotes)} sub="Close before end of day" tone={data.unsignedNotes ? "caution" : "ok"} href="/worklists" />
          <Metric icon={Send} label="Reports to send" value={String(data.reportsDue)} sub="Referral SLA, 24 hours" tone={data.reportsDue ? "caution" : "ok"} href="/worklists" />
        </div>

        {/* Production */}
        <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-endo" />
            <span className="text-[13px] font-semibold">Production against goal</span>
            <span className="ml-auto text-[13px] tnum">
              ${(data.productionCents / 100).toLocaleString()} of ${(data.goalCents / 100).toLocaleString()}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full bg-endo transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-content-soft tnum">{pct}% of daily goal</div>
        </div>

        {/* CRM alerts */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
            <Bell className="h-4 w-4 text-caution" /> CRM alerts
          </div>
          <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
            {data.alerts.length === 0 ? (
              <div className="px-4 py-5 text-center text-[13px] text-content-soft">No open alerts. Relationships look healthy.</div>
            ) : (
              data.alerts.map((a) => (
                <Link key={a.id} href="/referring-doctors">
                  <div className="flex cursor-pointer items-center gap-3 border-b border-hairline px-4 py-2.5 text-[13px] last:border-0 hover:bg-[var(--surface-2)]">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", a.severity === "caution" ? "bg-caution" : "bg-info")} />
                    {a.message}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub, tone, href }: { icon: typeof CalendarCheck; label: string; value: string; sub: string; tone: "ok" | "caution" | "info"; href?: string }) {
  const body = (
    <div className={cn("rounded-card border bg-surface p-4 shadow-card", href && "cursor-pointer transition-transform hover:-translate-y-0.5", "border-hairline")}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-content-soft">{label}</span>
        <Icon className={cn("h-4 w-4", tone === "caution" ? "text-caution" : tone === "info" ? "text-info" : "text-endo")} />
      </div>
      <div className="mt-1.5 text-[26px] font-semibold tnum">{value}</div>
      <div className="text-[11px] text-content-soft">{sub}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
