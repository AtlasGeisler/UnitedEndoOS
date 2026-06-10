import { useMemo } from "react";
import { format } from "date-fns";
import { useQuickLook, type LightItem } from "@/components/QuickLook";
import { TYPE_GLYPH, SEQUENCE_LABELS, type StudyRow } from "@/lib/clinical-types";

// The Patient Filmstrip, the signature element: a persistent horizontal strip of
// the patient's images that docks to the bottom of every clinical view and
// scrubs through time like a video editor, grouped by capture date.
export function Filmstrip({ studies }: { studies: StudyRow[] }) {
  const sorted = useMemo(
    () => [...studies].sort((a, b) => +new Date(a.capturedAt) - +new Date(b.capturedAt)),
    [studies],
  );
  const { open } = useQuickLook();

  const light: LightItem[] = sorted.map((s) => ({
    originalAssetId: s.originalAssetId,
    thumbAssetId: s.thumbAssetId,
    label: `${TYPE_GLYPH[s.type] ?? s.type}${s.bodySite ? `, ${s.bodySite}` : ""}`,
    sublabel: `${s.sequenceRole ? SEQUENCE_LABELS[s.sequenceRole] + ", " : ""}${format(new Date(s.capturedAt), "MMM d, yyyy")}`,
  }));

  // Group by day to draw date separators along the strip.
  const groups: { day: string; items: { study: StudyRow; index: number }[] }[] = [];
  sorted.forEach((study, index) => {
    const day = format(new Date(study.capturedAt), "MMM d, yyyy");
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push({ study, index });
    else groups.push({ day, items: [{ study, index }] });
  });

  if (!sorted.length) {
    return (
      <div className="glass flex h-[92px] shrink-0 items-center justify-center border-t border-hairline text-[12px] text-content-soft">
        No images yet. Drag a file onto the chart to start the filmstrip.
      </div>
    );
  }

  return (
    <div className="glass shrink-0 border-t border-hairline">
      <div className="flex items-center gap-2 px-4 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-content-soft">
        Filmstrip
        <span className="font-normal normal-case text-content-soft/70">scrub through time</span>
      </div>
      <div className="flex items-stretch gap-4 overflow-x-auto px-4 pb-2.5 pt-1">
        {groups.map((g) => (
          <div key={g.day} className="flex shrink-0 flex-col">
            <div className="mb-1 text-[10px] text-content-soft tnum">{g.day}</div>
            <div className="flex gap-1.5">
              {g.items.map(({ study, index }) => (
                <button
                  key={study.id}
                  onClick={() => open(light, index)}
                  className="group relative h-14 w-11 shrink-0 overflow-hidden rounded border border-hairline bg-clay-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                  title={`${TYPE_GLYPH[study.type] ?? study.type}, ${g.day}`}
                >
                  {study.thumbAssetId != null && (
                    <img src={`/api/images/${study.thumbAssetId}`} alt={study.type} loading="lazy" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 text-center text-[8px] font-medium text-white">
                    {TYPE_GLYPH[study.type] ?? study.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
