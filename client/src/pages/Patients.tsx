import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, LayoutGrid, List, ImageOff, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { age, patientAlerts, type PatientRow } from "@/lib/clinical-types";
import { cn } from "@/lib/utils";

// The patient directory: instant search, a list and a card view, and a hover
// preview of each patient's latest radiograph.
export function Patients() {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list" | "card">("list");
  const { data, isLoading } = useQuery({
    queryKey: ["/api/patients", q],
    queryFn: () => apiRequest<{ patients: PatientRow[] }>("GET", `/api/patients?q=${encodeURIComponent(q)}`),
  });
  const patients = data?.patients ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-hairline px-7 py-4">
        <h1 className="text-[18px] font-semibold">Patients</h1>
        <div className="relative ml-2 flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name..."
            className="w-full rounded-lg border border-hairline bg-[var(--surface-2)] py-1.5 pl-8 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-sage"
          />
        </div>
        <div className="ml-auto flex items-center gap-1 text-content-soft tnum">
          <span className="text-[12px]">{patients.length} patients</span>
          <div className="ml-2 flex rounded-md border border-hairline">
            <button onClick={() => setView("list")} className={cn("rounded-l-md p-1.5", view === "list" && "bg-endo/12 text-endo")}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setView("card")} className={cn("rounded-r-md p-1.5", view === "card" && "bg-endo/12 text-endo")}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="p-8 text-center text-[13px] text-content-soft">Loading patients...</div>
        ) : view === "list" ? (
          <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-content-soft">
                  <th className="px-4 py-2 font-medium">Patient</th>
                  <th className="px-4 py-2 font-medium">Age</th>
                  <th className="px-4 py-2 font-medium">Carrier</th>
                  <th className="px-4 py-2 font-medium">Balance</th>
                  <th className="px-4 py-2 font-medium">Latest image</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id} className="group border-b border-hairline last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-2">
                      <Link href={`/patients/${p.id}`}>
                        <span className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-content hover:text-endo">
                          {p.lastName}, {p.firstName}
                          <AlertChip alerts={patientAlerts(p)} />
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2 tnum text-content-soft">{age(p.dateOfBirth)}</td>
                    <td className="px-4 py-2 text-content-soft">{p.insuranceCarrier}</td>
                    <td className="px-4 py-2 tnum text-content-soft">
                      {p.balanceCents > 0 ? `$${(p.balanceCents / 100).toFixed(2)}` : "$0.00"}
                    </td>
                    <td className="px-4 py-2">
                      <Thumb assetId={p.latestThumbAssetId} small />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {patients.map((p) => (
              <Link key={p.id} href={`/patients/${p.id}`}>
                <div className="cursor-pointer overflow-hidden rounded-card border border-hairline bg-surface shadow-card transition-transform hover:-translate-y-0.5">
                  <div className="aspect-[4/3] bg-clay-900">
                    <Thumb assetId={p.latestThumbAssetId} />
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium">{p.lastName}, {p.firstName}</span>
                      <AlertChip alerts={patientAlerts(p)} />
                    </div>
                    <div className="text-[11px] text-content-soft">Age {age(p.dateOfBirth)}, {p.insuranceCarrier}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// A compact clinical-alert flag. Hover reveals the full allergy and alert list.
function AlertChip({ alerts }: { alerts: string[] }) {
  if (!alerts.length) return null;
  return (
    <span
      title={`Clinical alerts: ${alerts.join(", ")}`}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-urgent/12 px-1.5 py-0.5 text-[10px] font-semibold text-urgent"
    >
      <AlertTriangle className="h-3 w-3" />
      {alerts.length}
    </span>
  );
}

function Thumb({ assetId, small }: { assetId?: number | null; small?: boolean }) {
  if (!assetId) {
    return (
      <div className={cn("flex items-center justify-center text-content-soft", small ? "h-8 w-12 rounded bg-[var(--surface-2)]" : "h-full w-full")}>
        <ImageOff className={small ? "h-3.5 w-3.5" : "h-6 w-6"} />
      </div>
    );
  }
  return (
    <img
      src={`/api/images/${assetId}`}
      alt="Latest"
      className={cn("object-cover", small ? "h-8 w-12 rounded" : "h-full w-full")}
      loading="lazy"
    />
  );
}
