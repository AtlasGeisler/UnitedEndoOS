import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, X, ArrowUpRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Referral {
  id: number;
  status: string;
  reason: string | null;
  urgency: string;
  toothNumbers: number[] | null;
  dentistName: string | null;
  practiceName: string | null;
  submittedVia: string;
}
interface Dentist { id: number; fullName: string; practiceName: string }

const STAGES: { key: string; label: string }[] = [
  { key: "received", label: "Received" },
  { key: "scheduled", label: "Scheduled" },
  { key: "in_treatment", label: "In treatment" },
  { key: "report_due", label: "Report due" },
  { key: "closed", label: "Closed" },
];

// The Referrals pipeline, a kanban from received to closed. Cards drag between
// stages, and the intake form mirrors the referring doctor portal.
export function Referrals() {
  const [intake, setIntake] = useState(false);
  const { data } = useQuery({ queryKey: ["/api/referrals"], queryFn: () => apiRequest<{ referrals: Referral[] }>("GET", "/api/referrals") });
  const refs = data?.referrals ?? [];

  const move = useMutation({
    mutationFn: (v: { id: number; status: string }) => apiRequest("PATCH", `/api/referrals/${v.id}`, { status: v.status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/referrals"] }),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-hairline px-6 py-4">
        <h1 className="text-[18px] font-semibold">Referrals</h1>
        <span className="text-[12px] text-content-soft tnum">{refs.length} in pipeline</span>
        <Button size="sm" className="ml-auto" onClick={() => setIntake(true)}><Plus className="h-4 w-4" /> New referral</Button>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto p-4">
        <div className="flex h-full gap-3">
          {STAGES.map((stage) => {
            const items = refs.filter((r) => r.status === stage.key);
            return (
              <div
                key={stage.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { const id = Number(e.dataTransfer.getData("text/ref")); if (id) move.mutate({ id, status: stage.key }); }}
                className="flex w-64 shrink-0 flex-col rounded-card border border-hairline bg-[var(--surface-2)]"
              >
                <div className="flex items-center gap-2 px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-content-soft">
                  {stage.label}
                  <span className="ml-auto rounded-full bg-surface px-1.5 text-[11px] tnum">{items.length}</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-2">
                  {items.map((r) => (
                    <div
                      key={r.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/ref", String(r.id))}
                      className="cursor-grab rounded-lg border border-hairline bg-surface p-2.5 shadow-sm"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium">Tooth {r.toothNumbers?.[0] ?? "?"}</span>
                        {r.urgency === "urgent" && <span className="rounded-full bg-urgent/15 px-1.5 text-[10px] font-medium text-urgent">Urgent</span>}
                        {r.submittedVia === "portal" && <span className="ml-auto rounded-full bg-endo/12 px-1.5 text-[10px] font-medium text-endo">Portal</span>}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[12px] text-content-soft">{r.reason}</div>
                      <div className="mt-1.5 text-[11px] text-content-soft">{r.dentistName ?? "Unassigned"}</div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="rounded-lg border border-dashed border-hairline px-2 py-6 text-center text-[11px] text-content-soft">Drop here</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {intake && <IntakeForm onClose={() => setIntake(false)} />}
    </div>
  );
}

function IntakeForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ["/api/referring-doctors"], queryFn: () => apiRequest<{ dentists: Dentist[] }>("GET", "/api/referring-doctors") });
  const [dentistId, setDentistId] = useState("");
  const [tooth, setTooth] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState("routine");

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/referrals", {
      clinicId: user!.clinicIds[0], referringDentistId: dentistId ? Number(dentistId) : null,
      toothNumbers: tooth ? [Number(tooth)] : [], reason, urgency,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/referrals"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-5 shadow-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[15px] font-semibold">New referral</h2>
          <button onClick={onClose} className="ml-auto text-content-soft hover:text-content"><X className="h-4 w-4" /></button>
        </div>
        <label className="mb-1 block text-[12px] text-content-soft">Referring dentist</label>
        <select value={dentistId} onChange={(e) => setDentistId(e.target.value)} className="mb-2 w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-2 py-2 text-[13px] outline-none">
          <option value="">Select...</option>
          {(data?.dentists ?? []).map((d) => <option key={d.id} value={d.id}>{d.fullName}, {d.practiceName}</option>)}
        </select>
        <div className="mb-2 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[12px] text-content-soft">Tooth</label>
            <input value={tooth} onChange={(e) => setTooth(e.target.value)} className="w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-2 py-2 text-[13px] outline-none" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[12px] text-content-soft">Urgency</label>
            <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-2 py-2 text-[13px] outline-none">
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <label className="mb-1 block text-[12px] text-content-soft">Reason</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mb-3 w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-2 py-2 text-[13px] outline-none" />
        <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
          <ArrowUpRight className="h-4 w-4" /> Add to pipeline
        </Button>
      </div>
    </div>
  );
}
