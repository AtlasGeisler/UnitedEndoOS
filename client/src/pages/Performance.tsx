import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

interface Perf {
  providers: { name: string; color: string; cases: number; completed: number; productionCents: number; reportTurnaroundHours: number; emergencyAcceptanceRate: number; chairUtilization: number }[];
}
const money = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

// Performance: provider production, case mix, chair time utilization, report
// turnaround, and emergency acceptance rate.
export function Performance() {
  const { data } = useQuery({ queryKey: ["/api/performance"], queryFn: () => apiRequest<Perf>("GET", "/api/performance") });
  const rows = data?.providers ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-hairline px-7 py-4"><h1 className="text-[18px] font-semibold">Performance</h1></div>
      <div className="p-6">
        <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-content-soft">
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 font-medium">Production</th>
                <th className="px-4 py-2 font-medium">Cases</th>
                <th className="px-4 py-2 font-medium">Completed</th>
                <th className="px-4 py-2 font-medium">Chair use</th>
                <th className="px-4 py-2 font-medium">Report turnaround</th>
                <th className="px-4 py-2 font-medium">Emergency acceptance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.name} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.name}</span></td>
                  <td className="px-4 py-2.5 tnum">{money(p.productionCents)}</td>
                  <td className="px-4 py-2.5 tnum">{p.cases}</td>
                  <td className="px-4 py-2.5 tnum">{p.completed}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full bg-endo" style={{ width: `${p.chairUtilization}%` }} /></div><span className="tnum text-content-soft">{p.chairUtilization}%</span></div>
                  </td>
                  <td className="px-4 py-2.5 tnum">{p.reportTurnaroundHours}h</td>
                  <td className="px-4 py-2.5"><span className={p.emergencyAcceptanceRate >= 90 ? "text-endo" : "text-caution"}>{p.emergencyAcceptanceRate}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-content-soft">Emergency acceptance reflects the Thanksgiving Rule, never refuse a same day emergency.</p>
      </div>
    </div>
  );
}
