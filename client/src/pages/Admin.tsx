import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Sliders, Bot, Scale, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Config {
  categories: { id: number; label: string; options: { id: number; label: string }[] }[];
  prompts: { id: number; key: string; label: string; template: string }[];
  weights: { id: number; finding: string; pulpalDiagnosis: string | null; apicalDiagnosis: string | null; weight: number }[];
}
interface AiLog { id: number; feature: string; provider: string; redactedInput: unknown; output: unknown; approved: boolean | null; createdAt: string }

const TABS = ["AI audit log", "Config", "AI prompts", "Prediction weights"] as const;
type Tab = (typeof TABS)[number];

// Admin: the config editor, the AI prompt manager, prediction weights, and the
// AI audit log viewer, where every row carries a PHI redaction badge.
export function Admin() {
  const [tab, setTab] = useState<Tab>("AI audit log");
  const config = useQuery({ queryKey: ["/api/admin/config"], queryFn: () => apiRequest<Config>("GET", "/api/admin/config") });
  const audit = useQuery({ queryKey: ["/api/admin/ai-audit"], queryFn: () => apiRequest<{ logs: AiLog[] }>("GET", "/api/admin/ai-audit") });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hairline px-7 py-4">
        <h1 className="text-[18px] font-semibold">Admin</h1>
        <div className="mt-3 flex gap-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium", tab === t ? "bg-endo/12 text-endo" : "text-content-soft hover:bg-[var(--surface-2)]")}>{t}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          {tab === "AI audit log" && (
            <>
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-endo/25 bg-endo/6 px-3 py-2 text-[12px] text-endo">
                <ShieldCheck className="h-4 w-4" /> Every AI interaction is logged. Inputs are PHI redacted before the model sees them.
              </div>
              <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
                {(audit.data?.logs ?? []).map((l) => (
                  <div key={l.id} className="border-b border-hairline p-3 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-endo/12 px-2 py-0.5 text-[11px] font-medium text-endo capitalize">{l.feature.replace("_", " ")}</span>
                      <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-content-soft">{l.provider}</span>
                      <span className="rounded-full bg-sage/20 px-2 py-0.5 text-[10px] font-medium text-endo">PHI redacted</span>
                      {l.approved === null ? <span className="text-[10px] text-content-soft">advisory</span> : <span className="text-[10px] text-endo">approved</span>}
                      <span className="ml-auto text-[11px] text-content-soft tnum">{format(new Date(l.createdAt), "MMM d, h:mm a")}</span>
                    </div>
                    <pre className="mt-1.5 overflow-x-auto rounded-md bg-[var(--surface-2)] p-2 text-[11px] text-content-soft">{JSON.stringify(l.redactedInput)}</pre>
                  </div>
                ))}
                {audit.data?.logs.length === 0 && <div className="p-6 text-center text-[13px] text-content-soft">No AI interactions yet. Generate a SOAP draft or analyze an image.</div>}
              </div>
            </>
          )}

          {tab === "Config" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(config.data?.categories ?? []).map((c) => (
                <Panel key={c.id} icon={Sliders} title={c.label}>
                  {c.options.map((o) => <div key={o.id} className="border-b border-hairline py-1.5 text-[13px] last:border-0">{o.label}</div>)}
                </Panel>
              ))}
            </div>
          )}

          {tab === "AI prompts" && (
            <div className="space-y-3">
              {(config.data?.prompts ?? []).map((p) => (
                <Panel key={p.id} icon={Bot} title={p.label}>
                  <pre className="whitespace-pre-wrap text-[12px] text-content-soft">{p.template}</pre>
                </Panel>
              ))}
            </div>
          )}

          {tab === "Prediction weights" && (
            <Panel icon={Scale} title="Diagnosis predictor weights">
              <p className="mb-2 text-[12px] text-content-soft">Tune how strongly each finding drives the predicted diagnosis and prognosis. Higher weight, stronger influence.</p>
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-[11px] uppercase text-content-soft"><th className="py-1">Finding</th><th>Suggests</th><th className="text-right">Weight</th></tr></thead>
                <tbody>
                  {(config.data?.weights ?? []).map((w) => (
                    <tr key={w.id} className="border-t border-hairline">
                      <td className="py-1.5 capitalize">{w.finding}</td>
                      <td className="text-content-soft">{w.pulpalDiagnosis ?? w.apicalDiagnosis}</td>
                      <td className="text-right"><WeightInput id={w.id} value={w.weight} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function WeightInput({ id, value }: { id: number; value: number }) {
  const [v, setV] = useState(value);
  const save = useMutation({ mutationFn: (weight: number) => apiRequest("PATCH", `/api/admin/ai-weights/${id}`, { weight }) });
  return (
    <input
      type="number" step="0.5" value={v}
      onChange={(e) => setV(Number(e.target.value))}
      onBlur={() => v !== value && save.mutate(v)}
      className="w-16 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-0.5 text-right text-[12px] tnum outline-none focus:ring-2 focus:ring-sage"
    />
  );
}

function Panel({ icon: Icon, title, children }: { icon: typeof Sliders; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Icon className="h-4 w-4 text-endo" /> {title}</div>
      {children}
    </div>
  );
}
