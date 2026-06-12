import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreditCard, Send, CheckCircle2, ShieldCheck, RefreshCw, X, Search, Layers, History, ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Claim { id: number; patientId: number; patientName: string; carrier: string | null; totalCents: number; paidCents: number; status: string; preAuthNumber: string | null; submissionCount: number }

const money = (c: number) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS_TONE: Record<string, string> = {
  draft: "bg-[var(--surface-2)] text-content-soft", submitted: "bg-info/15 text-info",
  accepted: "bg-caution/15 text-caution", paid: "bg-complete/20 text-endo", denied: "bg-urgent/15 text-urgent",
};

// RCM lite: the claims lifecycle from draft to paid with auto posted ERAs, plus
// eligibility, patient payment collection, and pay by text, on a mock gateway.
export function Billing() {
  const { data } = useQuery({ queryKey: ["/api/claims"], queryFn: () => apiRequest<{ claims: Claim[] }>("GET", "/api/claims") });
  const claims = data?.claims ?? [];
  const [toast, setToast] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);

  const act = useMutation({
    mutationFn: (v: { id: number; action: string }) => apiRequest(`POST`, `/api/claims/${v.id}/${v.action}`),
    onSuccess: (r: any, v) => { queryClient.invalidateQueries({ queryKey: ["/api/claims"] }); if (v.action === "post-era") setToast(`ERA posted: insurance paid ${money(r.insurancePaid)}, patient portion ${money(r.patientPortion)}`); },
  });

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const counts = { total: claims.length, paid: claims.filter((c) => c.status === "paid").length, open: claims.filter((c) => c.status === "draft" || c.status === "submitted").length };
  const collected = claims.reduce((m, c) => m + c.paidCents, 0);
  const PIPELINE = ["draft", "submitted", "accepted", "paid", "denied"];
  const byStatus = (s: string) => claims.filter((c) => c.status === s).length;
  const shown = statusFilter === "all" ? claims : claims.filter((c) => c.status === statusFilter);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-hairline px-7 py-4">
        <h1 className="text-[18px] font-semibold">Billing</h1>
        <Button size="sm" className="ml-auto" onClick={() => setBulk(true)}><Layers className="h-4 w-4" /> Bulk insurance payment</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Stat label="Claims" value={String(counts.total)} sub={`${counts.open} open`} />
            <Stat label="Paid" value={String(counts.paid)} sub="auto posted ERAs" />
            <Stat label="Insurance collected" value={money(collected)} sub="this period" />
          </div>

          {toast && <div className="mb-4 rounded-lg border border-endo/30 bg-endo/8 px-3 py-2 text-[13px] text-endo">{toast}</div>}

          {/* Claims pipeline: filter the list by status, counts per stage. */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <PipeTab label="All" count={claims.length} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
            {PIPELINE.map((s) => (
              <PipeTab key={s} label={s} count={byStatus(s)} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
            ))}
          </div>

          <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-content-soft">
                  <th className="px-4 py-2 font-medium">Patient</th>
                  <th className="px-4 py-2 font-medium">Carrier</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                  <th className="px-4 py-2 font-medium">Paid</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-content-soft">No claims in this stage.</td></tr>
                )}
                {shown.slice(0, 40).map((c) => (
                  <tr key={c.id} className="border-b border-hairline last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-2 font-medium">{c.patientName}</td>
                    <td className="px-4 py-2 text-content-soft">{c.carrier}</td>
                    <td className="px-4 py-2 tnum">{money(c.totalCents)}</td>
                    <td className="px-4 py-2 tnum text-content-soft">{money(c.paidCents)}</td>
                    <td className="px-4 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] capitalize", STATUS_TONE[c.status])}>{c.status}</span>
                      {c.preAuthNumber && <span className="ml-1 text-[10px] text-content-soft">PA {c.preAuthNumber}</span>}
                      {c.submissionCount > 1 && <span className="ml-1 text-[10px] text-content-soft">x{c.submissionCount}</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {c.status === "draft" && <Button size="sm" variant="outline" onClick={() => act.mutate({ id: c.id, action: "submit" })}><Send className="h-3.5 w-3.5" /> Submit</Button>}
                      {(c.status === "submitted" || c.status === "accepted") && <Button size="sm" onClick={() => act.mutate({ id: c.id, action: "post-era" })}><ShieldCheck className="h-3.5 w-3.5" /> Post ERA</Button>}
                      {c.status === "paid" && <span className="inline-flex items-center gap-1 text-[12px] text-endo"><CheckCircle2 className="h-3.5 w-3.5" /> Paid</span>}
                      {c.status === "denied" && <div className="flex items-center justify-end gap-1.5"><ResubmitButton claimId={c.id} onDone={() => setToast("Claim resubmitted with the pre-authorization number.")} /><PatientPay patientId={c.patientId} onToast={setToast} /></div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ClaimHistory />
          <PaymentTracer />
        </div>
      </div>
      {bulk && <BulkPaymentDialog onClose={() => setBulk(false)} onDone={(n, t) => { setBulk(false); setToast(`Bulk payment posted: ${n} claims, ${money(t)} applied.`); queryClient.invalidateQueries({ queryKey: ["/api/claims"] }); }} />}
    </div>
  );
}

// A single stage in the claims pipeline, with its count.
function PipeTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] capitalize",
        active ? "border-endo bg-endo/10 text-endo" : "border-hairline text-content-soft hover:border-endo hover:text-endo",
      )}
    >
      {label}
      <span className={cn("rounded-full px-1.5 text-[11px] tnum", active ? "bg-endo/15" : "bg-[var(--surface-2)]")}>{count}</span>
    </button>
  );
}

interface ClaimEvent { id: number; claimId: number; fromStatus: string | null; toStatus: string; note: string | null; patientName: string; createdAt: string }

// The claim status-change feed: who moved which claim to which stage, and when.
function ClaimHistory() {
  const { data } = useQuery({ queryKey: ["/api/claims/events"], queryFn: () => apiRequest<{ events: ClaimEvent[] }>("GET", "/api/claims/events") });
  const events = data?.events ?? [];
  if (!events.length) return null;
  return (
    <div className="mt-6 rounded-card border border-hairline bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold"><History className="h-4 w-4 text-endo" /> Recent status changes</div>
      <div className="max-h-72 overflow-y-auto">
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-2 border-b border-hairline py-1.5 text-[12px] last:border-0">
            <span className="shrink-0 font-medium">{e.patientName}</span>
            <span className="flex shrink-0 items-center gap-1 text-content-soft">
              {e.fromStatus && <><span className="capitalize">{e.fromStatus}</span><ArrowRight className="h-3 w-3" /></>}
              <span className={cn("rounded-full px-1.5 py-0.5 capitalize", STATUS_TONE[e.toStatus])}>{e.toStatus}</span>
            </span>
            {e.note && <span className="truncate text-content-soft">{e.note}</span>}
            <span className="ml-auto shrink-0 text-content-soft tnum">{new Date(e.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PayableClaim { id: number; patientName: string; carrier: string | null; totalCents: number; insuranceCents: number }

// Bulk insurance payment: name a batch, set method and check number, select the
// payable claims it covers, and post them all at once.
function BulkPaymentDialog({ onClose, onDone }: { onClose: () => void; onDone: (count: number, totalCents: number) => void }) {
  const [name, setName] = useState("");
  const [method, setMethod] = useState("eft");
  const [checkNumber, setCheckNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const payable = useQuery({ queryKey: ["/api/claims/payable", carrier], queryFn: () => apiRequest<{ claims: PayableClaim[] }>("GET", `/api/claims/payable${carrier ? `?carrier=${encodeURIComponent(carrier)}` : ""}`) });
  const list = payable.data?.claims ?? [];
  const carriers = [...new Set(list.map((c) => c.carrier).filter(Boolean))] as string[];
  const chosen = list.filter((c) => sel[c.id]);
  const total = chosen.reduce((m, c) => m + c.insuranceCents, 0);

  const post = useMutation({
    mutationFn: () => apiRequest<{ applied: number; totalCents: number }>("POST", "/api/payment-batches", { name, method, checkNumber, carrier: carrier || null, claimIds: chosen.map((c) => c.id) }),
    onSuccess: (r) => onDone(r.applied, r.totalCents),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-hairline bg-surface p-5 shadow-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-endo" />
          <h2 className="text-[15px] font-semibold">Bulk insurance payment</h2>
          <button onClick={onClose} className="ml-auto text-content-soft hover:text-content"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Batch name" className="rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-sage" />
          <select value={carrier} onChange={(e) => { setCarrier(e.target.value); setSel({}); }} className="rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1.5 text-[12px] outline-none"><option value="">All carriers</option>{carriers.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1.5 text-[12px] outline-none"><option value="eft">EFT</option><option value="check">Check</option></select>
          <input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="Check / EFT #" className="rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1.5 text-[12px] outline-none" />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-hairline">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-hairline text-left text-[10px] uppercase text-content-soft"><th className="px-2 py-1"><input type="checkbox" checked={list.length > 0 && chosen.length === list.length} onChange={(e) => setSel(e.target.checked ? Object.fromEntries(list.map((c) => [c.id, true])) : {})} className="accent-endo" /></th><th className="px-2 py-1">Patient</th><th className="px-2 py-1">Carrier</th><th className="px-2 py-1 text-right">Total</th><th className="px-2 py-1 text-right">Insurance</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b border-hairline last:border-0">
                  <td className="px-2 py-1.5"><input type="checkbox" checked={!!sel[c.id]} onChange={(e) => setSel({ ...sel, [c.id]: e.target.checked })} className="accent-endo" /></td>
                  <td className="px-2 py-1.5 font-medium">{c.patientName}</td>
                  <td className="px-2 py-1.5 text-content-soft">{c.carrier}</td>
                  <td className="px-2 py-1.5 text-right tnum text-content-soft">{money(c.totalCents)}</td>
                  <td className="px-2 py-1.5 text-right tnum">{money(c.insuranceCents)}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-content-soft">No payable claims.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="text-[13px] text-content-soft">{chosen.length} selected, total <span className="font-semibold text-content tnum">{money(total)}</span></div>
          <Button className="ml-auto" disabled={!name || chosen.length === 0 || post.isPending} onClick={() => post.mutate()}><CheckCircle2 className="h-4 w-4" /> {post.isPending ? "Posting..." : "Post bulk payment"}</Button>
        </div>
      </div>
    </div>
  );
}

function PatientPay({ patientId, onToast }: { patientId: number; onToast: (s: string) => void }) {
  const statement = useQuery({ queryKey: ["/api/patients", patientId, "statement"], queryFn: () => apiRequest<{ balanceCents: number }>("GET", `/api/patients/${patientId}/statement`) });
  const bal = statement.data?.balanceCents ?? 0;
  const pay = useMutation({
    mutationFn: () => apiRequest<{ balanceCents: number }>("POST", `/api/patients/${patientId}/pay`, { amountCents: bal, method: "card" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "statement"] }); onToast("Patient balance collected on the mock gateway."); },
  });
  if (bal <= 0) return <span className="text-[12px] text-content-soft">Balance clear</span>;
  return <Button size="sm" variant="outline" onClick={() => pay.mutate()}><CreditCard className="h-3.5 w-3.5" /> Collect ${(bal / 100).toFixed(0)}</Button>;
}

interface FoundPayment { id: number; patientName: string; amountCents: number; method: string; reference: string | null; createdAt: string }

// Payment tracer: search payments by method, payor, amount range, and dates.
function PaymentTracer() {
  const [f, setF] = useState({ method: "", payor: "", min: "", max: "", from: "", to: "" });
  const [run, setRun] = useState(false);
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const search = useQuery({
    queryKey: ["/api/payments/search", q],
    queryFn: () => apiRequest<{ payments: FoundPayment[]; totalCents: number }>("GET", `/api/payments/search?${q}`),
    enabled: run,
  });

  return (
    <div className="mt-6 rounded-card border border-hairline bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold"><Search className="h-4 w-4 text-endo" /> Payment tracer</div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Method"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className="w-28 rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1 text-[12px] outline-none"><option value="">Any</option><option value="card">Card</option><option value="check">Check</option><option value="eft">EFT</option><option value="cash">Cash</option><option value="insurance">Insurance</option></select></Field>
        <Field label="Payor"><select value={f.payor} onChange={(e) => setF({ ...f, payor: e.target.value })} className="w-28 rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1 text-[12px] outline-none"><option value="">Any</option><option value="insurance">Insurance</option><option value="patient">Patient</option></select></Field>
        <Field label="Min $"><input value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} className="w-20 rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1 text-[12px] tnum outline-none" /></Field>
        <Field label="Max $"><input value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} className="w-20 rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1 text-[12px] tnum outline-none" /></Field>
        <Field label="From"><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1 text-[12px] outline-none" /></Field>
        <Field label="To"><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1 text-[12px] outline-none" /></Field>
        <Button size="sm" onClick={() => { setRun(true); search.refetch(); }}><Search className="h-3.5 w-3.5" /> Search</Button>
      </div>
      {run && (
        <div className="mt-3">
          <div className="mb-1 text-[12px] text-content-soft">{search.data?.payments.length ?? 0} payments, total {money(search.data?.totalCents ?? 0)}</div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-hairline">
            <table className="w-full text-[12px]">
              <tbody>
                {(search.data?.payments ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-hairline last:border-0">
                    <td className="px-3 py-1.5 tnum text-content-soft">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-1.5">{p.patientName}</td>
                    <td className="px-3 py-1.5 capitalize text-content-soft">{p.method}</td>
                    <td className="px-3 py-1.5 truncate text-content-soft">{p.reference}</td>
                    <td className="px-3 py-1.5 text-right tnum">{money(p.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-0.5"><span className="text-[10px] uppercase tracking-wide text-content-soft">{label}</span>{children}</label>;
}

// Resubmit a denied claim with a pre-authorization number.
function ResubmitButton({ claimId, onDone }: { claimId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pa, setPa] = useState("");
  const resubmit = useMutation({
    mutationFn: () => apiRequest("POST", `/api/claims/${claimId}/resubmit`, { preAuthNumber: pa }),
    onSuccess: () => { setOpen(false); setPa(""); queryClient.invalidateQueries({ queryKey: ["/api/claims"] }); onDone(); },
  });
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><RefreshCw className="h-3.5 w-3.5" /> Resubmit</Button>;
  return (
    <div className="flex items-center gap-1">
      <input autoFocus value={pa} onChange={(e) => setPa(e.target.value)} placeholder="Pre-auth #" className="w-24 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[11px] outline-none focus:ring-2 focus:ring-sage" />
      <Button size="sm" onClick={() => resubmit.mutate()} disabled={resubmit.isPending}>Send</Button>
      <button onClick={() => setOpen(false)} className="text-content-soft hover:text-content"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
      <div className="text-[12px] text-content-soft">{label}</div>
      <div className="mt-1 text-[24px] font-semibold tnum">{value}</div>
      <div className="text-[11px] text-content-soft">{sub}</div>
    </div>
  );
}
