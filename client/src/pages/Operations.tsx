import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Users2, MapPin, ShieldAlert, Send, Activity, Shield } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/auth";

interface Ops {
  staff: { name: string; color: string; isProvider: boolean; role: string; email: string }[];
  clinics: { id: number; name: string; city: string; state: string }[];
  deliveries: { id: number; channel: string; status: string; createdAt: string; dentistName: string | null }[];
  ruleSettings: { releaseHour: number; managerOverride: boolean };
}

// Operations: staff and roles, locations, Thanksgiving Rule settings, and the
// report delivery log.
export function Operations() {
  const { data } = useQuery({ queryKey: ["/api/operations"], queryFn: () => apiRequest<Ops>("GET", "/api/operations") });
  if (!data) return <div className="flex h-full items-center justify-center text-[13px] text-content-soft">Loading...</div>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-hairline px-7 py-4">
        <h1 className="text-[18px] font-semibold">Operations</h1>
        <Link href="/insurance"><span className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1 text-[13px] text-content-soft hover:border-endo hover:text-endo"><Shield className="h-4 w-4" /> Insurance profiles</span></Link>
      </div>
      <div className="px-6 pt-6"><ContactTrace /></div>
      <div className="grid gap-5 p-6 lg:grid-cols-2">
        <Panel icon={Users2} title="Staff and roles">
          {data.staff.map((s) => (
            <div key={s.email} className="flex items-center gap-2 border-b border-hairline py-2 text-[13px] last:border-0">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="font-medium">{s.name}</span>
              <span className="ml-auto text-[12px] text-content-soft">{ROLE_LABELS[s.role] ?? s.role}</span>
            </div>
          ))}
        </Panel>
        <Panel icon={MapPin} title="Locations">
          {data.clinics.map((c) => (
            <div key={c.id} className="border-b border-hairline py-2 text-[13px] last:border-0">
              <div className="font-medium">{c.name}</div><div className="text-[12px] text-content-soft">{c.city}, {c.state}</div>
            </div>
          ))}
        </Panel>
        <Panel icon={ShieldAlert} title="Thanksgiving Rule">
          <div className="text-[13px]">Emergency slots release at <span className="font-semibold">{format(new Date(0, 0, 0, data.ruleSettings.releaseHour), "h a")}</span>.</div>
          <div className="mt-1 text-[12px] text-content-soft">Manager override {data.ruleSettings.managerOverride ? "enabled" : "disabled"}, with a logged reason. Same day emergencies are never refused.</div>
        </Panel>
        <Panel icon={Send} title="Report delivery log">
          <div className="max-h-56 overflow-y-auto">
            {data.deliveries.map((d) => (
              <div key={d.id} className="flex items-center gap-2 border-b border-hairline py-1.5 text-[12px] last:border-0">
                <span className="capitalize">{d.channel}</span>
                <span className="text-content-soft">{d.dentistName}</span>
                <span className="ml-auto text-content-soft tnum">{format(new Date(d.createdAt), "MMM d")}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

interface TraceResult {
  infected: { name: string; appointmentsInWindow: number };
  window: { from: string; to: string };
  exposed: { id: number; name: string; phone: string | null; email: string | null; overlappedAt: string }[];
}

// Contact tracing: find patients whose appointments overlapped an infected
// patient's, in the window two days before to fourteen days after a test date.
function ContactTrace() {
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const trace = useMutation({
    mutationFn: () => apiRequest<TraceResult>("POST", "/api/contact-trace", { lastName, dateOfBirth: dob || undefined, testDate }),
  });

  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold"><Activity className="h-4 w-4 text-endo" /> Contact tracing</div>
      <p className="mb-2 text-[12px] text-content-soft">Find patients whose visits overlapped an infected patient's, from two days before to fourteen days after the test date, any operatory.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5"><span className="text-[10px] uppercase tracking-wide text-content-soft">Patient last name</span><input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-40 rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-sage" /></label>
        <label className="flex flex-col gap-0.5"><span className="text-[10px] uppercase tracking-wide text-content-soft">DOB (optional)</span><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1 text-[12px] outline-none" /></label>
        <label className="flex flex-col gap-0.5"><span className="text-[10px] uppercase tracking-wide text-content-soft">Test date</span><input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-1 text-[12px] outline-none" /></label>
        <Button size="sm" onClick={() => trace.mutate()} disabled={!lastName || trace.isPending}><Activity className="h-3.5 w-3.5" /> {trace.isPending ? "Tracing..." : "Trace"}</Button>
      </div>
      {trace.isError && <div className="mt-2 text-[12px] text-urgent">{(trace.error as Error).message}</div>}
      {trace.data && (
        <div className="mt-3">
          <div className="mb-1 text-[12px] text-content-soft">{trace.data.infected.name}, {trace.data.infected.appointmentsInWindow} appointment(s) in window {trace.data.window.from} to {trace.data.window.to}. {trace.data.exposed.length} possible exposures.</div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-hairline">
            {trace.data.exposed.map((e) => (
              <div key={e.id} className="flex items-center gap-2 border-b border-hairline px-3 py-1.5 text-[12px] last:border-0">
                <span className="font-medium">{e.name}</span>
                <span className="text-content-soft">{e.phone}</span>
                <span className="ml-auto text-content-soft tnum">{format(new Date(e.overlappedAt), "MMM d, h:mm a")}</span>
              </div>
            ))}
            {trace.data.exposed.length === 0 && <div className="px-3 py-3 text-center text-[12px] text-content-soft">No overlapping appointments found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ icon: Icon, title, children }: { icon: typeof Users2; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Icon className="h-4 w-4 text-endo" /> {title}</div>
      {children}
    </div>
  );
}
