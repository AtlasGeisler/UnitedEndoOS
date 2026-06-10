import { useMemo, useState, useRef } from "react";
import { format } from "date-fns";
import { useQuickLook, type LightItem } from "@/components/QuickLook";
import {
  TYPE_GLYPH, SEQUENCE_ROLES, SEQUENCE_LABELS,
  type StudyRow, type VisitRow,
} from "@/lib/clinical-types";
import { cn } from "@/lib/utils";
import { ImagePlus } from "lucide-react";

// The image-first chart surface: a Photos-style grid grouped by visit, a
// timeline rail on the left, and filters by tooth, type, and status. Visits with
// a tooth show their required RCT radiograph sequence as named slots, and a
// missing slot renders as a visible empty frame the provider is nudged to fill.

interface Group {
  key: string;
  label: string;
  sublabel: string;
  date: Date;
  visit: VisitRow | null;
  studies: StudyRow[];
}

export function ImagingGrid({
  studies, visits, onPick, initialTooth,
}: {
  studies: StudyRow[];
  visits: VisitRow[];
  onPick?: (s: StudyRow) => void;
  initialTooth?: number | null;
}) {
  const { open } = useQuickLook();
  const [tooth, setTooth] = useState<number | "all">(initialTooth ?? "all");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const railRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const visitById = useMemo(() => new Map(visits.map((v) => [v.id, v])), [visits]);

  const filtered = studies.filter(
    (s) =>
      (tooth === "all" || (s.toothNumbers ?? []).includes(tooth)) &&
      (type === "all" || s.type === type) &&
      (status === "all" || s.status === status),
  );

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const s of filtered) {
      const key = s.visitId ? `v${s.visitId}` : "baseline";
      const visit = s.visitId ? visitById.get(s.visitId) ?? null : null;
      if (!map.has(key)) {
        const date = new Date(visit?.visitDate ?? s.capturedAt);
        map.set(key, {
          key,
          label: visit
            ? `Tooth ${visit.toothNumber}, ${visit.type}`
            : "Baseline and imports",
          sublabel: format(date, "EEEE, MMM d, yyyy"),
          date,
          visit,
          studies: [],
        });
      }
      map.get(key)!.studies.push(s);
    }
    return [...map.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filtered, visitById]);

  const allTeeth = useMemo(
    () => [...new Set(studies.flatMap((s) => s.toothNumbers ?? []))].sort((a, b) => a - b),
    [studies],
  );
  const allTypes = useMemo(() => [...new Set(studies.map((s) => s.type))], [studies]);

  const toLight = (list: StudyRow[]): LightItem[] =>
    list.map((s) => ({
      originalAssetId: s.originalAssetId,
      thumbAssetId: s.thumbAssetId,
      label: `${TYPE_GLYPH[s.type] ?? s.type}${s.bodySite ? `, ${s.bodySite}` : ""}`,
      sublabel: `${s.sequenceRole ? SEQUENCE_LABELS[s.sequenceRole] + ", " : ""}${format(new Date(s.capturedAt), "MMM d, yyyy")}`,
    }));

  return (
    <div className="flex h-full min-h-0">
      {/* Timeline rail */}
      <div className="hidden w-44 shrink-0 overflow-y-auto border-r border-hairline px-3 py-4 md:block">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-content-soft">
          Timeline
        </div>
        {groups.map((g) => (
          <button
            key={g.key}
            onClick={() => railRefs.current[g.key]?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="mb-1 block w-full rounded-md px-2 py-1.5 text-left text-[12px] text-content-soft hover:bg-[var(--surface-2)] hover:text-content"
          >
            <div className="font-medium text-content">{format(g.date, "MMM yyyy")}</div>
            <div className="truncate">{g.label}</div>
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-2.5">
          <Filter label="Tooth" value={tooth === "all" ? "all" : String(tooth)} onChange={(v) => setTooth(v === "all" ? "all" : Number(v))} options={[["all", "All teeth"], ...allTeeth.map((t) => [String(t), `Tooth ${t}`] as [string, string])]} />
          <Filter label="Type" value={type} onChange={setType} options={[["all", "All types"], ...allTypes.map((t) => [t, TYPE_GLYPH[t] ?? t] as [string, string])]} />
          <Filter label="Status" value={status} onChange={setStatus} options={[["all", "Any status"], ["unreviewed", "Unreviewed"], ["reviewed", "Reviewed"], ["flagged", "Flagged"]]} />
          <span className="ml-auto text-[12px] text-content-soft tnum">{filtered.length} images</span>
        </div>

        {/* Grouped grid */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {groups.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-content-soft">
              <ImagePlus className="h-7 w-7" />
              <div className="text-[13px]">No images match these filters. Drag a file onto the chart to import.</div>
            </div>
          )}
          {groups.map((g) => {
            const light = toLight(g.studies);
            const sequence = g.visit?.toothNumber != null;
            const byRole = new Map(g.studies.filter((s) => s.sequenceRole).map((s) => [s.sequenceRole!, s]));
            const others = g.studies.filter((s) => !s.sequenceRole);
            return (
              <div key={g.key} ref={(el) => (railRefs.current[g.key] = el)} className="mb-7 scroll-mt-4">
                <div className="mb-2 flex items-baseline gap-2">
                  <h3 className="text-[14px] font-semibold">{g.label}</h3>
                  <span className="text-[12px] text-content-soft">{g.sublabel}</span>
                </div>

                {sequence && (
                  <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {SEQUENCE_ROLES.map((role) => {
                      const st = byRole.get(role);
                      const idx = st ? g.studies.indexOf(st) : -1;
                      return (
                        <div key={role}>
                          <div className="mb-1 text-[11px] font-medium text-content-soft">{SEQUENCE_LABELS[role]}</div>
                          {st ? (
                            <Tile study={st} onOpen={() => { open(light, idx); onPick?.(st); }} />
                          ) : (
                            <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-hairline bg-[var(--surface-2)] text-[11px] text-content-soft">
                              Empty
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {others.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {others.map((st) => {
                      const idx = g.studies.indexOf(st);
                      return <Tile key={st.id} study={st} onOpen={() => { open(light, idx); onPick?.(st); }} />;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Tile({ study, onOpen }: { study: StudyRow; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group relative block aspect-[3/4] w-full overflow-hidden rounded-lg border border-hairline bg-clay-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
      title="Open Quick Look, or press Space"
    >
      {study.thumbAssetId != null ? (
        <img src={`/api/images/${study.thumbAssetId}`} alt={study.type} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
      ) : (
        <div className="flex h-full items-center justify-center text-clay-400">No image</div>
      )}
      <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {TYPE_GLYPH[study.type] ?? study.type}
      </span>
      {study.status === "reviewed" && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-complete" title="Reviewed" />
      )}
    </button>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex items-center gap-1.5 text-[12px]">
      <span className="text-content-soft">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-sage"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
