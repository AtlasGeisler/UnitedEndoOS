import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, Plus, X, Copy, Trash2, GitMerge, AlertTriangle, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Profile {
  id: number; carrier: string; employer: string; groupNumber: string | null; planType: string | null;
  defaultCoveragePercent: number; deductibleCents: number; annualMaximumCents: number;
  advancedDeductibles: { byCategory?: { category: string; deductibleCents: number }[]; byCode?: { cdtCode: string; deductibleCents: number }[] } | null;
}
interface Exception { id?: number; cdtCode: string; coveragePercent: number }

// Insurance profiles management, adopted from EndoVision: carrier and employer
// plans with coverage, deductibles, per-code exceptions, create-from-existing, a
// duplicate warning, and combine.
export function InsuranceProfiles() {
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: ["/api/insurance-profiles"], queryFn: () => apiRequest<{ profiles: Profile[] }>("GET", "/api/insurance-profiles") });
  const profiles = list.data?.profiles ?? [];
  const activeId = selected ?? profiles[0]?.id ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-hairline px-6 py-4">
        <h1 className="text-[18px] font-semibold">Insurance profiles</h1>
        <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New profile</Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0 overflow-y-auto border-r border-hairline p-2">
          {profiles.map((p) => (
            <button key={p.id} onClick={() => setSelected(p.id)} className={cn("mb-1 block w-full rounded-md px-2.5 py-2 text-left", activeId === p.id ? "bg-endo/12" : "hover:bg-[var(--surface-2)]")}>
              <div className="truncate text-[13px] font-medium">{p.carrier}</div>
              <div className="truncate text-[11px] text-content-soft">{p.employer}{p.groupNumber ? `, grp ${p.groupNumber}` : ""}</div>
            </button>
          ))}
          {profiles.length === 0 && <div className="p-4 text-center text-[13px] text-content-soft">No profiles yet.</div>}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          {activeId ? <ProfileEditor id={activeId} all={profiles} onDeleted={() => setSelected(null)} /> : <div className="text-[13px] text-content-soft">Select or create a profile.</div>}
        </div>
      </div>
      {creating && <NewProfileDialog profiles={profiles} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setSelected(id); }} />}
    </div>
  );
}

function ProfileEditor({ id, all, onDeleted }: { id: number; all: Profile[]; onDeleted: () => void }) {
  const detail = useQuery({ queryKey: ["/api/insurance-profiles", id], queryFn: () => apiRequest<{ profile: Profile; exceptions: Exception[] }>("GET", `/api/insurance-profiles/${id}`) });
  const profile = detail.data?.profile;
  const [exceptions, setExceptions] = useState<Exception[] | null>(null);
  const rows = exceptions ?? detail.data?.exceptions ?? [];

  const patch = useMutation({ mutationFn: (p: Partial<Profile>) => apiRequest("PATCH", `/api/insurance-profiles/${id}`, p), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/insurance-profiles"] }) });
  const saveExceptions = useMutation({ mutationFn: (list: Exception[]) => apiRequest("PUT", `/api/insurance-profiles/${id}/exceptions`, { exceptions: list }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/insurance-profiles", id] }) });
  const combine = useMutation({ mutationFn: (dropId: number) => apiRequest("POST", "/api/insurance-profiles/combine", { keepId: id, dropId }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/insurance-profiles"] }); } });

  if (!profile) return <div className="text-[13px] text-content-soft">Loading...</div>;

  const updateExc = (next: Exception[]) => { setExceptions(next); saveExceptions.mutate(next); };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-endo" />
        <div><div className="text-[16px] font-semibold">{profile.carrier}</div><div className="text-[12px] text-content-soft">{profile.employer}</div></div>
        <select onChange={(e) => { if (e.target.value) combine.mutate(Number(e.target.value)); }} defaultValue="" className="ml-auto rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] outline-none" title="Combine another profile into this one">
          <option value="">Combine with...</option>
          {all.filter((p) => p.id !== id).map((p) => <option key={p.id} value={p.id}>{p.carrier}, {p.employer}</option>)}
        </select>
      </div>

      <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
        <div className="mb-2 text-[12px] font-semibold text-content-soft">Coverage and limits</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Num label="Default coverage %" value={profile.defaultCoveragePercent} onSave={(v) => patch.mutate({ defaultCoveragePercent: v })} />
          <Num label="Deductible $" value={profile.deductibleCents / 100} step={5} onSave={(v) => patch.mutate({ deductibleCents: Math.round(v * 100) })} />
          <Num label="Annual max $" value={profile.annualMaximumCents / 100} step={100} onSave={(v) => patch.mutate({ annualMaximumCents: Math.round(v * 100) })} />
          <Text label="Group #" value={profile.groupNumber ?? ""} onSave={(v) => patch.mutate({ groupNumber: v })} />
        </div>
      </div>

      <AdvancedDeductibles profile={profile} onSave={(adv) => patch.mutate({ advancedDeductibles: adv })} />

      <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-content-soft">Coverage exceptions by code
          <Button size="sm" variant="subtle" className="ml-auto" onClick={() => updateExc([...rows, { cdtCode: "", coveragePercent: profile.defaultCoveragePercent }])}><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {rows.map((e, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-hairline py-1.5 last:border-0">
              <input value={e.cdtCode} onChange={(ev) => { const n = [...rows]; n[i] = { ...e, cdtCode: ev.target.value }; setExceptions(n); }} onBlur={() => updateExc(rows)} placeholder="CDT" className="w-20 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[12px] outline-none" />
              <input type="number" value={e.coveragePercent} onChange={(ev) => { const n = [...rows]; n[i] = { ...e, coveragePercent: Number(ev.target.value) }; setExceptions(n); }} onBlur={() => updateExc(rows)} className="w-16 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[12px] tnum outline-none" />
              <span className="text-[11px] text-content-soft">% covered</span>
              <button onClick={() => updateExc(rows.filter((_, j) => j !== i))} className="ml-auto text-content-soft hover:text-urgent"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {rows.length === 0 && <div className="py-2 text-[12px] text-content-soft">No exceptions. The default percentage applies to every code.</div>}
        </div>
      </div>
    </div>
  );
}

function AdvancedDeductibles({ profile, onSave }: { profile: Profile; onSave: (adv: Profile["advancedDeductibles"]) => void }) {
  const adv = profile.advancedDeductibles ?? {};
  const byCategory = adv.byCategory ?? [];
  const byCode = adv.byCode ?? [];
  const save = (next: Profile["advancedDeductibles"]) => onSave(next);
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
      <div className="mb-2 text-[12px] font-semibold text-content-soft">Advanced deductibles</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-content-soft">By category<button onClick={() => save({ ...adv, byCategory: [...byCategory, { category: "", deductibleCents: 0 }] })} className="ml-auto text-endo"><Plus className="h-3.5 w-3.5" /></button></div>
          {byCategory.map((d, i) => (
            <div key={i} className="mb-1 flex items-center gap-1.5">
              <input defaultValue={d.category} onBlur={(e) => { const n = [...byCategory]; n[i] = { ...d, category: e.target.value }; save({ ...adv, byCategory: n }); }} placeholder="Category" className="flex-1 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[12px] outline-none" />
              <input type="number" defaultValue={d.deductibleCents / 100} onBlur={(e) => { const n = [...byCategory]; n[i] = { ...d, deductibleCents: Math.round(Number(e.target.value) * 100) }; save({ ...adv, byCategory: n }); }} className="w-16 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[12px] tnum outline-none" />
              <button onClick={() => save({ ...adv, byCategory: byCategory.filter((_, j) => j !== i) })} className="text-content-soft hover:text-urgent"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          {byCategory.length === 0 && <div className="text-[11px] text-content-soft">None.</div>}
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-content-soft">By code<button onClick={() => save({ ...adv, byCode: [...byCode, { cdtCode: "", deductibleCents: 0 }] })} className="ml-auto text-endo"><Plus className="h-3.5 w-3.5" /></button></div>
          {byCode.map((d, i) => (
            <div key={i} className="mb-1 flex items-center gap-1.5">
              <input defaultValue={d.cdtCode} onBlur={(e) => { const n = [...byCode]; n[i] = { ...d, cdtCode: e.target.value }; save({ ...adv, byCode: n }); }} placeholder="CDT" className="flex-1 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[12px] outline-none" />
              <input type="number" defaultValue={d.deductibleCents / 100} onBlur={(e) => { const n = [...byCode]; n[i] = { ...d, deductibleCents: Math.round(Number(e.target.value) * 100) }; save({ ...adv, byCode: n }); }} className="w-16 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[12px] tnum outline-none" />
              <button onClick={() => save({ ...adv, byCode: byCode.filter((_, j) => j !== i) })} className="text-content-soft hover:text-urgent"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          {byCode.length === 0 && <div className="text-[11px] text-content-soft">None.</div>}
        </div>
      </div>
    </div>
  );
}

function NewProfileDialog({ profiles, onClose, onCreated }: { profiles: Profile[]; onClose: () => void; onCreated: (id: number) => void }) {
  const [carrier, setCarrier] = useState("");
  const [employer, setEmployer] = useState("");
  const [copyFromId, setCopyFromId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dup = useQuery({
    queryKey: ["/api/insurance-profiles/check", carrier, employer],
    queryFn: () => apiRequest<{ exists: boolean }>("GET", `/api/insurance-profiles/check?carrier=${encodeURIComponent(carrier)}&employer=${encodeURIComponent(employer)}`),
    enabled: carrier.length > 1 && employer.length > 1,
  });
  const create = useMutation({
    mutationFn: () => apiRequest<{ profile: Profile }>("POST", "/api/insurance-profiles", { carrier, employer, copyFromId: copyFromId || undefined }),
    onSuccess: ({ profile }) => { queryClient.invalidateQueries({ queryKey: ["/api/insurance-profiles"] }); onCreated(profile.id); },
    onError: (e) => setError((e as Error).message),
  });
  const isDup = dup.data?.exists;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-5 shadow-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><Shield className="h-4 w-4 text-endo" /><h2 className="text-[15px] font-semibold">New insurance profile</h2><button onClick={onClose} className="ml-auto text-content-soft hover:text-content"><X className="h-4 w-4" /></button></div>
        <label className="mb-1 block text-[12px] text-content-soft">Carrier</label>
        <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="mb-2 w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-sage" />
        <label className="mb-1 block text-[12px] text-content-soft">Employer</label>
        <input value={employer} onChange={(e) => setEmployer(e.target.value)} className="mb-2 w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-sage" />
        {isDup && <div className="mb-2 flex items-center gap-1.5 rounded-md bg-urgent/10 px-3 py-2 text-[12px] text-urgent"><AlertTriangle className="h-3.5 w-3.5" /> That carrier and employer combination already exists.</div>}
        <label className="mb-1 block text-[12px] text-content-soft">Copy from existing (optional)</label>
        <select value={copyFromId} onChange={(e) => setCopyFromId(e.target.value)} className="mb-3 w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-2 py-2 text-[13px] outline-none">
          <option value="">Start blank</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.carrier}, {p.employer}</option>)}
        </select>
        {error && <div className="mb-2 text-[12px] text-urgent">{error}</div>}
        <Button className="w-full" disabled={!carrier || !employer || isDup || create.isPending} onClick={() => { setError(null); create.mutate(); }}>
          {copyFromId ? <Copy className="h-4 w-4" /> : <Check className="h-4 w-4" />} {create.isPending ? "Creating..." : "Create profile"}
        </Button>
      </div>
    </div>
  );
}

function Num({ label, value, step, onSave }: { label: string; value: number; step?: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(value);
  return <label className="flex flex-col gap-0.5"><span className="text-[10px] uppercase tracking-wide text-content-soft">{label}</span><input type="number" step={step ?? 1} value={v} onChange={(e) => setV(Number(e.target.value))} onBlur={() => v !== value && onSave(v)} className="rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1 text-[12px] tnum outline-none focus:ring-2 focus:ring-sage" /></label>;
}
function Text({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return <label className="flex flex-col gap-0.5"><span className="text-[10px] uppercase tracking-wide text-content-soft">{label}</span><input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} className="rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-sage" /></label>;
}
