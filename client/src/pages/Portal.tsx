import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Stethoscope, Download, CheckCircle2, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PortalReferral { id: number; status: string; reason: string | null; urgency: string; toothNumbers: number[] | null; patientName: string; reportId: number | null }

const STATUS_LABEL: Record<string, string> = {
  received: "Received", scheduled: "Scheduled", in_treatment: "In treatment", report_due: "Report due", closed: "Closed",
};

// The tokenized referring doctor portal, served outside the app shell with no
// login. A GP submits a referral, watches its status, and downloads the finished
// report. This closes the referral loop.
export function Portal() {
  const token = new URLSearchParams(location.search).get("token") ?? "";
  const me = useQuery({ queryKey: ["portal-me", token], queryFn: () => apiRequest<{ dentist: { fullName: string; practiceName: string } }>("GET", `/api/portal/me?token=${token}`), retry: false });
  const list = useQuery({ queryKey: ["portal-refs", token], queryFn: () => apiRequest<{ referrals: PortalReferral[] }>("GET", `/api/portal/referrals?token=${token}`), enabled: !!me.data });

  const [form, setForm] = useState({ firstName: "", lastName: "", dateOfBirth: "", tooth: "", reason: "", urgency: "routine" });
  const submit = useMutation({
    mutationFn: () => apiRequest("POST", "/api/portal/referrals", { token, ...form, toothNumbers: form.tooth ? [Number(form.tooth)] : [] }),
    onSuccess: () => { setForm({ firstName: "", lastName: "", dateOfBirth: "", tooth: "", reason: "", urgency: "routine" }); queryClient.invalidateQueries({ queryKey: ["portal-refs", token] }); },
  });

  if (me.isError || !token) {
    return <div className="flex min-h-screen items-center justify-center bg-canvas text-content"><div className="text-center"><div className="text-[15px] font-medium">Invalid portal link</div><div className="mt-1 text-[13px] text-content-soft">Ask United Endodontics for your referral link.</div></div></div>;
  }

  return (
    <div className="min-h-screen bg-canvas text-content">
      <header className="bg-forest px-6 py-5 text-parchment">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-endo text-[15px] font-bold text-white">UE</div>
          <div>
            <div className="font-serif text-[20px] font-semibold">United Endodontics</div>
            <div className="text-[12px] text-parchment/70">Referring doctor portal{me.data && `, ${me.data.dentist.fullName}`}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-6 p-6 md:grid-cols-2">
        {/* Submit */}
        <section className="rounded-card border border-hairline bg-surface p-5 shadow-card">
          <h2 className="mb-3 text-[15px] font-semibold">Submit a referral</h2>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Patient first name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
            <Input label="Patient last name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
            <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} />
            <Input label="Tooth" value={form.tooth} onChange={(v) => setForm({ ...form, tooth: v })} />
          </div>
          <label className="mb-1 mt-2 block text-[12px] text-content-soft">Reason for referral</label>
          <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} className="mb-2 w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-2 py-2 text-[13px] outline-none focus:ring-2 focus:ring-sage" />
          <label className="mb-1 block text-[12px] text-content-soft">Urgency</label>
          <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })} className="mb-3 w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-2 py-2 text-[13px] outline-none">
            <option value="routine">Routine</option>
            <option value="urgent">Urgent, same day if possible</option>
          </select>
          <Button className="w-full" onClick={() => submit.mutate()} disabled={!form.firstName || !form.lastName || submit.isPending}>
            {submit.isPending ? "Submitting..." : "Submit referral"}
          </Button>
          {submit.isSuccess && <div className="mt-2 text-center text-[12px] text-endo">Referral received. Thank you.</div>}
        </section>

        {/* Track */}
        <section>
          <h2 className="mb-3 text-[15px] font-semibold">Your referrals</h2>
          <div className="space-y-2">
            {(list.data?.referrals ?? []).map((r) => (
              <div key={r.id} className="rounded-card border border-hairline bg-surface p-3 shadow-card">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-endo" />
                  <span className="text-[13px] font-medium">{r.patientName}, tooth {r.toothNumbers?.[0] ?? "?"}</span>
                  <span className={cn("ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]", r.status === "closed" ? "bg-complete/20 text-endo" : "bg-[var(--surface-2)] text-content-soft")}>
                    {r.status === "closed" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                {r.reason && <div className="mt-1 text-[12px] text-content-soft">{r.reason}</div>}
                {r.reportId && (
                  <a href={`/api/portal/reports/${r.reportId}?token=${token}&format=txt`} className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-endo hover:underline">
                    <Download className="h-3.5 w-3.5" /> Download report
                  </a>
                )}
              </div>
            ))}
            {list.data && list.data.referrals.length === 0 && <div className="rounded-card border border-dashed border-hairline px-3 py-8 text-center text-[13px] text-content-soft">No referrals yet. Submit one to get started.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}

function Input({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-content-soft">{label}</span>
      <input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-2 py-2 text-[13px] outline-none focus:ring-2 focus:ring-sage" />
    </label>
  );
}
