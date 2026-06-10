import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Contact, Bell, Copy, Check, RefreshCw, Link2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DentistRow { id: number; fullName: string; practiceName: string; preferredDelivery: string; status: string; lifetimeReferrals: number; portalToken: string }
interface Profile {
  dentist: DentistRow & { relationshipNotes: string | null; phone: string | null; email: string | null };
  sparkline: number[];
  history: { id: number; name: string; visits: number; status: string }[];
  touchpoints: { id: number; kind: string; note: string | null; createdAt: string }[];
  alerts: { id: number; message: string; severity: string }[];
  deliveries: { id: number; channel: string; status: string; createdAt: string }[];
}

// The Referring Doctor CRM: the list, then a profile with a referral history
// sparkline, preferences, touchpoints, alerts, and the tokenized portal link.
export function ReferringDoctors() {
  const [selected, setSelected] = useState<number | null>(null);
  const { data } = useQuery({ queryKey: ["/api/referring-doctors"], queryFn: () => apiRequest<{ dentists: DentistRow[] }>("GET", "/api/referring-doctors") });
  const dentists = data?.dentists ?? [];
  const activeId = selected ?? dentists[0]?.id ?? null;

  const runAlerts = useMutation({
    mutationFn: () => apiRequest("POST", "/api/crm/run-alerts"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/referring-doctors"] }); queryClient.invalidateQueries({ queryKey: ["/api/today"] }); },
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-hairline px-6 py-4">
        <h1 className="text-[18px] font-semibold">Referring Doctors</h1>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => runAlerts.mutate()} disabled={runAlerts.isPending}>
          <RefreshCw className="h-4 w-4" /> {runAlerts.isPending ? "Running..." : "Run alerts"}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0 overflow-y-auto border-r border-hairline p-2">
          {dentists.map((d) => (
            <button key={d.id} onClick={() => setSelected(d.id)} className={cn("mb-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left", activeId === d.id ? "bg-endo/12" : "hover:bg-[var(--surface-2)]")}>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-parchment">{d.fullName.split(" ").slice(-1)[0][0]}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{d.fullName}</div>
                <div className="truncate text-[11px] text-content-soft">{d.practiceName}</div>
              </div>
              <span className="rounded-full bg-[var(--surface-2)] px-1.5 text-[11px] text-content-soft tnum">{d.lifetimeReferrals}</span>
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          {activeId && <DoctorProfile id={activeId} />}
        </div>
      </div>
    </div>
  );
}

function DoctorProfile({ id }: { id: number }) {
  const { data } = useQuery({ queryKey: ["/api/referring-doctors", id], queryFn: () => apiRequest<Profile>("GET", `/api/referring-doctors/${id}`) });
  const [copied, setCopied] = useState(false);
  if (!data) return <div className="text-[13px] text-content-soft">Loading...</div>;
  const d = data.dentist;
  const portalUrl = `${location.origin}/portal?token=${d.portalToken}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest text-[15px] font-semibold text-parchment"><Contact className="h-6 w-6" /></div>
        <div>
          <h2 className="text-[18px] font-semibold">{d.fullName}</h2>
          <div className="text-[13px] text-content-soft">{d.practiceName}</div>
          <div className="mt-0.5 text-[12px] text-content-soft">{d.email} {d.phone && `, ${d.phone}`}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[24px] font-semibold tnum">{d.lifetimeReferrals}</div>
          <div className="text-[11px] text-content-soft">lifetime referrals</div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="mt-5 rounded-card border border-hairline bg-surface p-4 shadow-card">
        <div className="mb-2 text-[12px] font-semibold text-content-soft">Referral trend, last 6 months</div>
        <Sparkline values={data.sparkline} />
      </div>

      {/* Portal link */}
      <div className="mt-4 rounded-card border border-hairline bg-surface p-4 shadow-card">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold"><Link2 className="h-4 w-4 text-endo" /> Tokenized portal link</div>
        <div className="flex items-center gap-2">
          <input readOnly value={portalUrl} className="flex-1 rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1.5 text-[12px] text-content-soft outline-none" />
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(portalUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check className="h-4 w-4 text-endo" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-content-soft">Share with the GP to submit referrals, track status, and download reports, no login.</p>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Bell className="h-4 w-4 text-caution" /> Alerts</div>
          {data.alerts.map((a) => (
            <div key={a.id} className="mb-1.5 flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px]">
              <span className={cn("h-2 w-2 rounded-full", a.severity === "caution" ? "bg-caution" : "bg-info")} />
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* History + touchpoints */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
          <div className="mb-2 text-[12px] font-semibold text-content-soft">Recent patients referred</div>
          {data.history.slice(0, 6).map((h) => (
            <div key={h.id} className="flex items-center gap-2 border-b border-hairline py-1.5 text-[13px] last:border-0">
              {h.name}<span className="ml-auto text-[11px] text-content-soft tnum">{h.visits} visit{h.visits === 1 ? "" : "s"}</span>
            </div>
          ))}
          {data.history.length === 0 && <div className="text-[12px] text-content-soft">No patients in your clinics.</div>}
        </div>
        <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
          <div className="mb-2 text-[12px] font-semibold text-content-soft">Touchpoints, preferences</div>
          <div className="mb-2 text-[12px] text-content-soft">Prefers delivery by <span className="font-medium text-content">{d.preferredDelivery}</span>.</div>
          {data.touchpoints.map((t) => (
            <div key={t.id} className="border-b border-hairline py-1.5 text-[12px] last:border-0">
              <span className="font-medium capitalize">{t.kind.replace("_", " ")}</span>: {t.note}
            </div>
          ))}
          {data.touchpoints.length === 0 && <div className="text-[12px] text-content-soft">No touchpoints logged.</div>}
        </div>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const w = 100, h = 28;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#3A7D44" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {values.map((v, i) => <circle key={i} cx={(i / (values.length - 1)) * w} cy={h - (v / max) * h} r="1.6" fill="#3A7D44" />)}
    </svg>
  );
}
