import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, ClipboardSignature, Check } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/SignaturePad";
import type { PatientRow } from "@/lib/clinical-types";
import { cn } from "@/lib/utils";

interface Option { key: string; name: string; items: { cdt: string; description: string; feeCents: number }[]; insuranceEstimateCents: number }

// The default multi option endodontic plan: retreat, apico, or extract and refer
// back. Fees and insurance estimates per option, presented side by side.
const TEMPLATE: Option[] = [
  { key: "A", name: "Plan A, Nonsurgical retreatment", insuranceEstimateCents: 80000, items: [{ cdt: "D3346", description: "Retreatment, molar", feeCents: 152000 }, { cdt: "D2954", description: "Post and core", feeCents: 38000 }] },
  { key: "B", name: "Plan B, Apicoectomy", insuranceEstimateCents: 70000, items: [{ cdt: "D3425", description: "Apicoectomy, molar", feeCents: 135000 }, { cdt: "D3427", description: "Retrograde filling", feeCents: 32000 }] },
  { key: "C", name: "Plan C, Extract and refer back", insuranceEstimateCents: 20000, items: [{ cdt: "D7140", description: "Extraction", feeCents: 28000 }] },
];

export function Plans() {
  const [q, setQ] = useState("");
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [chosen, setChosen] = useState("A");
  const [sig, setSig] = useState<string | null>(null);
  const [snapshotId, setSnapshotId] = useState<number | null>(null);

  const search = useQuery({ queryKey: ["/api/patients", q], queryFn: () => apiRequest<{ patients: PatientRow[] }>("GET", `/api/patients?q=${encodeURIComponent(q)}`), enabled: q.length > 1 });

  const signPlan = useMutation({
    mutationFn: async () => {
      const { plan } = await apiRequest<{ plan: { id: number } }>("POST", "/api/plans", { patientId: patient!.id, title: `Endodontic treatment plan, ${patient!.firstName} ${patient!.lastName}`, options: TEMPLATE });
      await apiRequest("POST", `/api/plans/${plan.id}/sign`, { signatureDataUrl: sig, chosenOptionKey: chosen });
      return plan.id;
    },
    onSuccess: (id) => setSnapshotId(id),
  });

  const total = (o: Option) => o.items.reduce((m, it) => m + it.feeCents, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hairline px-7 py-4"><h1 className="text-[18px] font-semibold">Treatment Plans</h1></div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          {!patient ? (
            <div className="mx-auto max-w-md">
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-soft" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a patient to plan for..." className="w-full rounded-lg border border-hairline bg-[var(--surface-2)] py-2 pl-8 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-sage" />
              </div>
              <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
                {(search.data?.patients ?? []).slice(0, 8).map((p) => (
                  <button key={p.id} onClick={() => setPatient(p)} className="block w-full border-b border-hairline px-4 py-2 text-left text-[13px] last:border-0 hover:bg-[var(--surface-2)]">
                    {p.lastName}, {p.firstName}
                  </button>
                ))}
                {q.length <= 1 && <div className="px-4 py-6 text-center text-[13px] text-content-soft">Search for a patient to present a plan.</div>}
              </div>
            </div>
          ) : snapshotId ? (
            <div className="text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-complete/20 px-3 py-1 text-[13px] font-medium text-endo"><Check className="h-4 w-4" /> Plan signed</div>
              <div className="mx-auto max-w-xl overflow-hidden rounded-card border border-hairline shadow-card">
                <img src={`/api/plans/${snapshotId}/snapshot`} alt="Signed plan" className="w-full" />
              </div>
              <Button variant="outline" className="mt-4" onClick={() => { setPatient(null); setSnapshotId(null); setSig(null); setQ(""); }}>Plan for another patient</Button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2">
                <ClipboardSignature className="h-5 w-5 text-endo" />
                <h2 className="text-[16px] font-semibold">{patient.firstName} {patient.lastName}</h2>
                <button onClick={() => setPatient(null)} className="ml-auto text-[12px] text-content-soft hover:text-content">Change patient</button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {TEMPLATE.map((o) => (
                  <button key={o.key} onClick={() => setChosen(o.key)} className={cn("rounded-card border bg-surface p-4 text-left shadow-card", chosen === o.key ? "border-endo ring-1 ring-endo" : "border-hairline")}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold", chosen === o.key ? "border-endo bg-endo text-white" : "border-hairline text-content-soft")}>{o.key}</span>
                      <span className="text-[13px] font-semibold">{o.name.split(", ")[1]}</span>
                    </div>
                    {o.items.map((it) => (
                      <div key={it.cdt} className="flex justify-between text-[12px] text-content-soft"><span>{it.cdt} {it.description}</span><span className="tnum">${(it.feeCents / 100).toFixed(0)}</span></div>
                    ))}
                    <div className="mt-2 flex justify-between border-t border-hairline pt-1.5 text-[13px] font-semibold"><span>Total</span><span className="tnum">${(total(o) / 100).toFixed(2)}</span></div>
                    <div className="mt-0.5 flex justify-between text-[11px] text-content-soft"><span>Est. insurance</span><span className="tnum">${(o.insuranceEstimateCents / 100).toFixed(2)}</span></div>
                    <div className="mt-0.5 flex justify-between text-[12px] font-medium text-endo"><span>Patient portion</span><span className="tnum">${((total(o) - o.insuranceEstimateCents) / 100).toFixed(2)}</span></div>
                  </button>
                ))}
              </div>

              <div className="mt-5 mx-auto max-w-sm rounded-card border border-hairline bg-surface p-4 shadow-card">
                <div className="mb-2 text-[13px] font-semibold">Patient e-signature</div>
                <p className="mb-2 text-[12px] text-content-soft">I have reviewed and accept {TEMPLATE.find((o) => o.key === chosen)?.name}.</p>
                <SignaturePad onChange={setSig} />
                <Button className="mt-3 w-full" onClick={() => signPlan.mutate()} disabled={!sig || signPlan.isPending}>
                  {signPlan.isPending ? "Saving..." : "Sign and save plan"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
