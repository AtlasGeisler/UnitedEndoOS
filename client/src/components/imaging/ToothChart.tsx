import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { StudyRow, VisitRow } from "@/lib/clinical-types";

// The interactive tooth chart is itself visual: each tooth shows a status and a
// badge with its image count. Clicking a tooth selects it, which the chart can
// use to filter the grid and the filmstrip. Universal and FDI numbering toggle.

const UPPER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const LOWER = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];

// Universal to FDI (ISO) crosswalk for adult dentition.
const FDI: Record<number, number> = {
  1: 18, 2: 17, 3: 16, 4: 15, 5: 14, 6: 13, 7: 12, 8: 11,
  9: 21, 10: 22, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28,
  17: 38, 18: 37, 19: 36, 20: 35, 21: 34, 22: 33, 23: 32, 24: 31,
  25: 41, 26: 42, 27: 43, 28: 44, 29: 45, 30: 46, 31: 47, 32: 48,
};

type Status = "none" | "completed" | "planned" | "watch";
const STATUS_COLOR: Record<Status, string> = {
  none: "bg-surface border-hairline text-content-soft",
  completed: "bg-endo/15 border-endo/40 text-endo",
  planned: "bg-caution/15 border-caution/40 text-caution",
  watch: "bg-info/15 border-info/40 text-info",
};

export function ToothChart({
  studies, visits, selected, onSelect,
}: {
  studies: StudyRow[];
  visits: VisitRow[];
  selected: number | null;
  onSelect: (tooth: number | null) => void;
}) {
  const [numbering, setNumbering] = useState<"universal" | "fdi">("universal");

  const imageCount = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of studies) for (const t of s.toothNumbers ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, [studies]);

  const status = useMemo(() => {
    const m = new Map<number, Status>();
    for (const v of visits) {
      if (v.toothNumber == null) continue;
      const next: Status = v.status === "signed" ? "completed" : "planned";
      const cur = m.get(v.toothNumber);
      if (cur !== "completed") m.set(v.toothNumber, next);
    }
    return m;
  }, [visits]);

  const label = (n: number) => (numbering === "fdi" ? FDI[n] : n);

  const renderRow = (row: number[]) => (
    <div className="flex justify-center gap-1">
      {row.map((n) => {
        const count = imageCount.get(n) ?? 0;
        const st = status.get(n) ?? "none";
        const active = selected === n;
        return (
          <button
            key={n}
            onClick={() => onSelect(active ? null : n)}
            className={cn(
              "relative flex h-11 w-9 flex-col items-center justify-center rounded-md border text-[11px] font-medium transition-transform hover:-translate-y-0.5",
              STATUS_COLOR[st],
              active && "ring-2 ring-sage",
            )}
            title={`Tooth ${label(n)}, ${count} image${count === 1 ? "" : "s"}`}
          >
            <span className="tnum">{label(n)}</span>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-endo px-1 text-[9px] font-semibold text-white tnum">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="text-[14px] font-semibold">Dentition</h3>
        <div className="ml-auto flex rounded-md border border-hairline text-[12px]">
          {(["universal", "fdi"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setNumbering(m)}
              className={cn("px-2.5 py-1 first:rounded-l-md last:rounded-r-md", numbering === m ? "bg-endo/12 text-endo" : "text-content-soft")}
            >
              {m === "universal" ? "Universal" : "FDI"}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-2 rounded-card border border-hairline bg-surface p-5 shadow-card">
        {renderRow(UPPER)}
        <div className="my-1 text-center text-[10px] uppercase tracking-wider text-content-soft">Maxillary, mandibular</div>
        {renderRow(LOWER)}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[11px] text-content-soft">
        <Legend color="bg-endo/40" label="Completed RCT" />
        <Legend color="bg-caution/40" label="Planned" />
        <Legend color="bg-info/40" label="Watch" />
        <span>Badge shows image count. Click a tooth to filter the chart.</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded", color)} />
      {label}
    </span>
  );
}
