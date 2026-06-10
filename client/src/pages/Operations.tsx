import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Users2, MapPin, ShieldAlert, Send } from "lucide-react";
import { apiRequest } from "@/lib/api";
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
      <div className="border-b border-hairline px-7 py-4"><h1 className="text-[18px] font-semibold">Operations</h1></div>
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

function Panel({ icon: Icon, title, children }: { icon: typeof Users2; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Icon className="h-4 w-4 text-endo" /> {title}</div>
      {children}
    </div>
  );
}
