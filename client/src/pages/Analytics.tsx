import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/api";

interface Analytics {
  caseCompletion: { completed: number; planned: number };
  revenue: { month: string; actualCents: number }[];
  projection: { month: string; projectedCents: number }[];
  referrerPerformance: { name: string; count: number }[];
  restorative: { patientId: number; patientName: string; toothNumber: number | null; daysSince: number }[];
}

const money = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

// Configurable analytics: case completion, referrer performance, a three month
// revenue projection, and the restorative follow-up tracker.
export function Analytics() {
  const { data } = useQuery({ queryKey: ["/api/analytics"], queryFn: () => apiRequest<Analytics>("GET", "/api/analytics") });
  if (!data) return <div className="flex h-full items-center justify-center text-[13px] text-content-soft">Loading analytics...</div>;

  const revenueData = [
    ...data.revenue.map((r) => ({ month: r.month, actual: Math.round(r.actualCents / 100), projected: null as number | null })),
    ...data.projection.map((p) => ({ month: p.month, actual: null as number | null, projected: Math.round(p.projectedCents / 100) })),
  ];
  const completionRate = Math.round((data.caseCompletion.completed / Math.max(1, data.caseCompletion.completed + data.caseCompletion.planned)) * 100);

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-hairline px-7 py-4"><h1 className="text-[18px] font-semibold">Analytics</h1></div>
      <div className="space-y-5 p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-card border border-hairline bg-surface p-4 shadow-card lg:col-span-2">
            <div className="mb-3 text-[13px] font-semibold">Revenue, last six months and projection</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData} margin={{ left: -10, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3A7D44" stopOpacity={0.5} /><stop offset="100%" stopColor="#3A7D44" stopOpacity={0} /></linearGradient>
                  <linearGradient id="proj" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7CB68A" stopOpacity={0.4} /><stop offset="100%" stopColor="#7CB68A" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--content-soft)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--content-soft)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip formatter={(v: number) => `$${v?.toLocaleString()}`} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--hairline)", background: "var(--surface)" }} />
                <Area type="monotone" dataKey="actual" stroke="#3A7D44" strokeWidth={2} fill="url(#rev)" connectNulls />
                <Area type="monotone" dataKey="projected" stroke="#7CB68A" strokeWidth={2} strokeDasharray="4 3" fill="url(#proj)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
            <div className="mb-2 text-[13px] font-semibold">Case completion</div>
            <div className="text-[40px] font-semibold text-endo tnum">{completionRate}%</div>
            <div className="text-[12px] text-content-soft">{data.caseCompletion.completed} completed, {data.caseCompletion.planned} planned</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full bg-endo" style={{ width: `${completionRate}%` }} /></div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
            <div className="mb-3 text-[13px] font-semibold">Top referrers</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.referrerPerformance} layout="vertical" margin={{ left: 40, right: 12 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--content-soft)" }} axisLine={false} tickLine={false} width={120} tickFormatter={(v) => v.replace("Dr. ", "")} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--hairline)", background: "var(--surface)" }} />
                <Bar dataKey="count" fill="#3A7D44" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><AlertTriangle className="h-4 w-4 text-caution" /> Restorative follow-up tracker</div>
            <p className="mb-2 text-[11px] text-content-soft">Completed RCTs without a permanent restoration after 30 days. The coronal seal is the survival variable.</p>
            <div className="max-h-44 overflow-y-auto">
              {data.restorative.length === 0 ? <div className="py-6 text-center text-[12px] text-content-soft">All completed cases are restored. Excellent.</div> : data.restorative.map((r) => (
                <Link key={`${r.patientId}-${r.toothNumber}`} href={`/patients/${r.patientId}`}>
                  <div className="flex cursor-pointer items-center gap-2 border-b border-hairline py-1.5 text-[12px] last:border-0 hover:text-endo">
                    <span className="font-medium">{r.patientName}</span><span className="text-content-soft">tooth {r.toothNumber}</span>
                    <span className="ml-auto rounded-full bg-caution/15 px-2 py-0.5 text-[11px] text-caution tnum">{r.daysSince}d</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
