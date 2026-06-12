import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreditCard, Send, CheckCircle2, ShieldCheck, RefreshCw, X } from "lucide-react";
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

  const act = useMutation({
    mutationFn: (v: { id: number; action: string }) => apiRequest(`POST`, `/api/claims/${v.id}/${v.action}`),
    onSuccess: (r: any, v) => { queryClient.invalidateQueries({ queryKey: ["/api/claims"] }); if (v.action === "post-era") setToast(`ERA posted: insurance paid ${money(r.insurancePaid)}, patient portion ${money(r.patientPortion)}`); },
  });

  const counts = { total: claims.length, paid: claims.filter((c) => c.status === "paid").length, open: claims.filter((c) => c.status === "draft" || c.status === "submitted").length };
  const collected = claims.reduce((m, c) => m + c.paidCents, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hairline px-7 py-4"><h1 className="text-[18px] font-semibold">Billing</h1></div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Stat label="Claims" value={String(counts.total)} sub={`${counts.open} open`} />
            <Stat label="Paid" value={String(counts.paid)} sub="auto posted ERAs" />
            <Stat label="Insurance collected" value={money(collected)} sub="this period" />
          </div>

          {toast && <div className="mb-4 rounded-lg border border-endo/30 bg-endo/8 px-3 py-2 text-[13px] text-endo">{toast}</div>}

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
                {claims.slice(0, 40).map((c) => (
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
