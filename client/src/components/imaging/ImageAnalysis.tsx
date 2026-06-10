import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Check, X } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { StudyRow } from "@/lib/clinical-types";
import { cn } from "@/lib/utils";

interface Finding {
  label: string;
  detail: string;
  confidence: number;
  x: number;
  y: number;
}
type Verdict = "pending" | "accepted" | "dismissed";

// Chair-side AI insights. Analyze sends a PHI-redacted payload and returns
// advisory findings rendered as toggleable overlay pins and a list. Every finding
// is watermarked and requires explicit accept or dismiss. Nothing alters the
// record on its own.
export function ImageAnalysis({ study }: { study: StudyRow | null }) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [verdicts, setVerdicts] = useState<Record<number, Verdict>>({});
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    setFindings([]);
    setVerdicts({});
    setActive(null);
  }, [study?.id]);

  const analyze = useMutation({
    mutationFn: () => apiRequest<{ findings: Finding[] }>("POST", `/api/studies/${study!.id}/analyze`),
    onSuccess: ({ findings }) => {
      setFindings(findings);
      setVerdicts(Object.fromEntries(findings.map((_, i) => [i, "pending"])));
    },
  });

  if (!study) {
    return <div className="rounded-card border border-hairline bg-surface p-3 text-center text-[12px] text-content-soft shadow-card">Select a radiograph to analyze.</div>;
  }

  return (
    <div className="rounded-card border border-hairline bg-surface p-3 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold">
        <Sparkles className="h-3.5 w-3.5 text-endo" /> Image analysis
      </div>

      <div className="relative overflow-hidden rounded-lg border border-hairline bg-clay-900">
        {study.originalAssetId != null && (
          <img src={`/api/images/${study.originalAssetId}`} alt="Study" className="w-full" />
        )}
        {findings.map((f, i) =>
          verdicts[i] === "dismissed" ? null : (
            <button
              key={i}
              onClick={() => setActive(active === i ? null : i)}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 text-[10px] font-bold",
                verdicts[i] === "accepted" ? "border-endo bg-endo text-white" : "border-caution bg-caution/80 text-white",
                active === i ? "h-6 w-6 ring-2 ring-white" : "h-5 w-5",
              )}
              style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
              title={f.label}
            >
              {i + 1}
            </button>
          ),
        )}
        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
          AI draft, provider review required
        </span>
      </div>

      {findings.length === 0 ? (
        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
          <Sparkles className="h-3.5 w-3.5 text-endo" /> {analyze.isPending ? "Analyzing..." : "Analyze"}
        </Button>
      ) : (
        <div className="mt-2 space-y-1.5">
          {findings.map((f, i) => (
            <div key={i} className={cn("rounded-lg border p-2", verdicts[i] === "dismissed" ? "border-hairline opacity-50" : active === i ? "border-endo/50 bg-endo/5" : "border-hairline")}>
              <div className="flex items-start gap-1.5">
                <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white", verdicts[i] === "accepted" ? "bg-endo" : "bg-caution")}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[12px] font-medium">
                    {f.label}
                    <span className="ml-auto text-[10px] text-content-soft tnum">{Math.round(f.confidence * 100)}%</span>
                  </div>
                  <div className="text-[11px] text-content-soft">{f.detail}</div>
                  {verdicts[i] === "pending" && (
                    <div className="mt-1 flex gap-1">
                      <button onClick={() => setVerdicts((v) => ({ ...v, [i]: "accepted" }))} className="flex items-center gap-1 rounded bg-endo/12 px-1.5 py-0.5 text-[10px] text-endo"><Check className="h-3 w-3" /> Accept</button>
                      <button onClick={() => setVerdicts((v) => ({ ...v, [i]: "dismissed" }))} className="flex items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-content-soft"><X className="h-3 w-3" /> Dismiss</button>
                    </div>
                  )}
                  {verdicts[i] === "accepted" && <div className="mt-0.5 text-[10px] text-endo">Accepted</div>}
                  {verdicts[i] === "dismissed" && <div className="mt-0.5 text-[10px] text-content-soft">Dismissed</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
