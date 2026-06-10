import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronLeft, Sparkles, PenLine, Send, Plus, Trash2, ShieldCheck, Lock,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Filmstrip } from "@/components/imaging/Filmstrip";
import { ImageAnalysis } from "@/components/imaging/ImageAnalysis";
import { StructuredFindings } from "@/components/clinical/StructuredFindings";
import {
  CANAL_PRESETS, FILE_SIZES, OBTURATIONS, CDT_OPTIONS, suggestCdt,
} from "@/lib/endo";
import { SEQUENCE_LABELS, type StudyRow, type CanalDoc, type FlagMap } from "@/lib/clinical-types";
import { cn } from "@/lib/utils";

interface VisitDetail {
  visit: { id: number; patientId: number; toothNumber: number | null; status: string; chiefComplaint: string | null; visitDate: string };
  patient: { id: number; firstName: string; lastName: string };
  note: NoteState & { signedAt: string | null };
  referrer: { fullName: string; practiceName: string } | null;
  report: { id: number; body: string; status: string; deliveredAt: string | null } | null;
  studies: StudyRow[];
}

interface NoteState {
  id: number;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  pulpalDiagnosis: string | null;
  apicalDiagnosis: string | null;
  diagnosticTests: Record<string, string> | null;
  canals: CanalDoc[] | null;
  cdtCodes: string[] | null;
  etiology: FlagMap | null;
  clinicalFindings: FlagMap | null;
  radiographicFindings: FlagMap | null;
  treatmentPerformed: FlagMap | null;
  recommendations: FlagMap | null;
  prognosis: string | null;
  prognosisFactors: FlagMap | null;
  procedureDetails: Record<string, unknown> | null;
  specialDiagnoses: FlagMap | null;
}

// The Visit Workspace clinical cockpit. Left: SOAP and structured findings.
// Center: tooth and canal documentation and the radiograph sequence. Right: the
// Inspector with AI image findings and the referral report. Bottom: the filmstrip
// filtered to this visit. The model assists, the clinician authors and signs.
export function VisitWorkspace() {
  const [, params] = useRoute("/visits/:id");
  const id = Number(params?.id);
  const { data, isLoading } = useQuery({
    queryKey: ["/api/visits", id],
    queryFn: () => apiRequest<VisitDetail>("GET", `/api/visits/${id}`),
  });

  const [note, setNote] = useState<NoteState | null>(null);
  const [aiBanner, setAiBanner] = useState(false);
  const [selectedStudy, setSelectedStudy] = useState<StudyRow | null>(null);
  useEffect(() => {
    if (data?.note) setNote(data.note);
    if (data?.studies?.length && !selectedStudy) {
      setSelectedStudy(data.studies.find((s) => s.sequenceRole === "pre_op") ?? data.studies[0]);
    }
  }, [data]);

  const locked = !!data?.note.signedAt;

  const save = useMutation({
    mutationFn: (patch: Partial<NoteState>) => apiRequest("PATCH", `/api/visits/${id}/note`, patch),
  });
  const aiDraft = useMutation({
    mutationFn: () => apiRequest<{ draft: { subjective: string; objective: string; assessment: string; plan: string; provider: string } }>("POST", `/api/visits/${id}/ai-soap`, {}),
    onSuccess: ({ draft }) => {
      setNote((n) => (n ? { ...n, subjective: draft.subjective, objective: draft.objective, assessment: draft.assessment, plan: draft.plan } : n));
      setAiBanner(true);
      save.mutate({ subjective: draft.subjective, objective: draft.objective, assessment: draft.assessment, plan: draft.plan });
    },
  });
  const sign = useMutation({
    mutationFn: () => apiRequest("POST", `/api/visits/${id}/sign`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/visits", id] }),
  });
  const genReport = useMutation({
    mutationFn: () => apiRequest("POST", `/api/visits/${id}/report`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/visits", id] }),
  });
  const deliver = useMutation({
    mutationFn: (channel: string) => apiRequest("POST", `/api/reports/${data!.report!.id}/deliver`, { channel }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/visits", id] }),
  });

  if (isLoading || !data || !note) {
    return <div className="flex h-full items-center justify-center text-[13px] text-content-soft">Loading visit...</div>;
  }

  const update = (patch: Partial<NoteState>) => {
    const next = { ...note, ...patch };
    setNote(next);
  };
  const commit = (patch: Partial<NoteState>) => save.mutate(patch);

  const setCanal = (i: number, patch: Partial<CanalDoc>) => {
    const canals = [...(note.canals ?? [])];
    canals[i] = { ...canals[i], ...patch };
    update({ canals });
    commit({ canals });
  };
  const addCanal = () => {
    const canals = [...(note.canals ?? []), { name: CANAL_PRESETS[(note.canals?.length ?? 0) % CANAL_PRESETS.length], workingLengthMm: "21.0", reference: "Cusp tip", fileSize: "25/.04", obturation: OBTURATIONS[0] }];
    update({ canals });
    commit({ canals });
  };
  const removeCanal = (i: number) => {
    const canals = (note.canals ?? []).filter((_, j) => j !== i);
    update({ canals });
    commit({ canals });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-6 py-3">
        <div>
          <Link href={`/patients/${data.patient.id}`}>
            <span className="mb-0.5 inline-flex cursor-pointer items-center gap-1 text-[12px] text-content-soft hover:text-content">
              <ChevronLeft className="h-3.5 w-3.5" /> {data.patient.firstName} {data.patient.lastName}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-[17px] font-semibold">Tooth {data.visit.toothNumber ?? "?"}</h1>
            {locked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-complete/20 px-2 py-0.5 text-[11px] font-medium text-endo">
                <Lock className="h-3 w-3" /> Signed
              </span>
            ) : (
              <span className="rounded-full bg-caution/15 px-2 py-0.5 text-[11px] font-medium text-caution">Open</span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!locked && (
            <Button variant="outline" size="sm" onClick={() => aiDraft.mutate()} disabled={aiDraft.isPending}>
              <Sparkles className="h-4 w-4 text-endo" /> {aiDraft.isPending ? "Drafting..." : "AI draft note"}
            </Button>
          )}
          {!locked && (
            <Button size="sm" onClick={() => { if (confirm("Sign and lock this note? After signing only dated addenda are allowed.")) sign.mutate(); }} disabled={sign.isPending}>
              <PenLine className="h-4 w-4" /> Sign and lock
            </Button>
          )}
          {locked && !data.report && (
            <Button size="sm" onClick={() => genReport.mutate()} disabled={genReport.isPending}>
              <Sparkles className="h-4 w-4" /> {genReport.isPending ? "Generating..." : "Generate referral report"}
            </Button>
          )}
        </div>
      </div>

      {/* Three columns */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_1fr_300px]">
        {/* Left: SOAP and structured findings */}
        <div className="min-h-0 overflow-y-auto border-r border-hairline p-5">
          {aiBanner && !locked && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-endo/30 bg-endo/8 px-3 py-2 text-[12px] text-endo">
              <Sparkles className="h-3.5 w-3.5" /> AI draft, provider review required. Edit before signing.
            </div>
          )}
          <StructuredFindings
            value={note}
            locked={locked}
            onCommit={(patch) => { update(patch as Partial<NoteState>); commit(patch as Partial<NoteState>); }}
          />

          <h3 className="mb-2 mt-4 text-[13px] font-semibold uppercase tracking-wide text-content-soft">SOAP note</h3>
          {(["subjective", "objective", "assessment", "plan"] as const).map((f) => (
            <Field key={f} label={f[0].toUpperCase() + f.slice(1)} value={(note[f] as string) ?? ""} disabled={locked} onChange={(v) => update({ [f]: v } as Partial<NoteState>)} onBlur={(v) => commit({ [f]: v } as Partial<NoteState>)} />
          ))}
        </div>

        {/* Center: tooth, canals, and the radiograph sequence */}
        <div className="min-h-0 overflow-y-auto border-r border-hairline p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-content-soft">Canal documentation</h3>
            {!locked && (
              <Button variant="subtle" size="sm" onClick={addCanal}><Plus className="h-3.5 w-3.5" /> Add canal</Button>
            )}
          </div>
          <div className="space-y-2">
            {(note.canals ?? []).length === 0 && <div className="rounded-lg border border-dashed border-hairline px-3 py-4 text-center text-[12px] text-content-soft">No canals documented yet.</div>}
            {(note.canals ?? []).map((c, i) => (
              <div key={i} className="rounded-lg border border-hairline bg-surface p-2.5">
                <div className="flex items-center gap-2">
                  <select disabled={locked} value={c.name} onChange={(e) => setCanal(i, { name: e.target.value })} className="w-16 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[12px] font-medium outline-none">
                    {CANAL_PRESETS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-[11px] text-content-soft">
                    WL
                    <input disabled={locked} value={c.workingLengthMm} onChange={(e) => setCanal(i, { workingLengthMm: e.target.value })} className="w-14 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[12px] tnum outline-none" />
                    mm
                  </label>
                  <select disabled={locked} value={c.fileSize} onChange={(e) => setCanal(i, { fileSize: e.target.value })} className="rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[12px] outline-none">
                    {FILE_SIZES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                  {!locked && <button onClick={() => removeCanal(i)} className="ml-auto text-content-soft hover:text-urgent"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input disabled={locked} value={c.reference} onChange={(e) => setCanal(i, { reference: e.target.value })} placeholder="Reference" className="w-28 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[11px] outline-none" />
                  <select disabled={locked} value={c.obturation} onChange={(e) => setCanal(i, { obturation: e.target.value })} className="flex-1 rounded-md border border-hairline bg-[var(--surface-2)] px-1.5 py-1 text-[11px] outline-none">
                    {OBTURATIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-2 mt-5 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-content-soft">CDT codes</h3>
            {!locked && (
              <Button variant="subtle" size="sm" onClick={() => {
                const suggested = suggestCdt(data.visit.toothNumber, (note.treatmentPerformed ?? {}) as { retreatment?: boolean; apicalSurgery?: boolean });
                const cdtCodes = [...new Set([...(note.cdtCodes ?? []), ...suggested])];
                update({ cdtCodes });
                commit({ cdtCodes });
              }}>
                <Sparkles className="h-3.5 w-3.5 text-endo" /> Suggest
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CDT_OPTIONS.map((c) => {
              const on = (note.cdtCodes ?? []).includes(c.code);
              return (
                <button
                  key={c.code}
                  disabled={locked}
                  onClick={() => {
                    const set = new Set(note.cdtCodes ?? []);
                    on ? set.delete(c.code) : set.add(c.code);
                    const cdtCodes = [...set];
                    update({ cdtCodes });
                    commit({ cdtCodes });
                  }}
                  className={cn("rounded-full border px-2.5 py-1 text-[11px]", on ? "border-endo bg-endo/12 text-endo" : "border-hairline text-content-soft hover:border-endo/50")}
                  title={c.label}
                >
                  {c.code}
                </button>
              );
            })}
          </div>

          <h3 className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-wide text-content-soft">Radiograph sequence</h3>
          <div className="grid grid-cols-4 gap-2">
            {(["pre_op", "working_length", "master_cone", "post_op"] as const).map((role) => {
              const st = data.studies.find((s) => s.sequenceRole === role);
              return (
                <button key={role} onClick={() => st && setSelectedStudy(st)} className={cn("text-left", selectedStudy?.id === st?.id && "ring-2 ring-sage rounded-lg")}>
                  <div className="mb-1 text-[10px] font-medium text-content-soft">{SEQUENCE_LABELS[role]}</div>
                  {st?.thumbAssetId ? (
                    <img src={`/api/images/${st.thumbAssetId}`} alt={role} className="aspect-[3/4] w-full rounded-lg border border-hairline object-cover" />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-hairline bg-[var(--surface-2)] text-[10px] text-content-soft">Empty</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Inspector with AI findings and the report */}
        <div className="hidden min-h-0 overflow-y-auto bg-[var(--surface-2)] p-4 lg:block">
          <ImageAnalysis study={selectedStudy} />

          {data.report && (
            <div className="mt-4 rounded-card border border-hairline bg-surface p-3 shadow-card">
              <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold">
                <Send className="h-3.5 w-3.5 text-endo" /> Referral report
                <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px]", data.report.status === "delivered" ? "bg-complete/20 text-endo" : "bg-caution/20 text-caution")}>{data.report.status}</span>
              </div>
              {data.referrer && <div className="mb-2 text-[11px] text-content-soft">To {data.referrer.fullName}, {data.referrer.practiceName}</div>}
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-[var(--surface-2)] p-2 text-[11px] leading-relaxed text-content">{data.report.body}</pre>
              {data.report.status !== "delivered" ? (
                <div className="mt-2 flex gap-1.5">
                  {["portal", "fax", "email"].map((ch) => (
                    <Button key={ch} size="sm" variant={ch === "portal" ? "primary" : "outline"} onClick={() => deliver.mutate(ch)} disabled={deliver.isPending}>
                      Send {ch}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-endo">
                  <ShieldCheck className="h-3.5 w-3.5" /> Delivered {data.report.deliveredAt ? format(new Date(data.report.deliveredAt), "MMM d, h:mm a") : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Filmstrip studies={data.studies} />
    </div>
  );
}

function Field({ label, value, onChange, onBlur, disabled }: { label: string; value: string; onChange: (v: string) => void; onBlur: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="mb-2.5">
      <label className="mb-1 block text-[11px] font-medium text-content-soft">{label}</label>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
        rows={2}
        className="w-full resize-y rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-sage disabled:opacity-70"
      />
    </div>
  );
}

function Select({ label, value, options, onChange, disabled }: { label: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-content-soft">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-sage disabled:opacity-70"
      >
        <option value="">Select...</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
