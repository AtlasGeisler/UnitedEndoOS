import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Check } from "lucide-react";
import { apiRequest } from "@/lib/api";
import {
  ETIOLOGY, FINDING_GROUPS, RADIOGRAPHIC, TREATMENT_PERFORMED, RECOMMENDATIONS,
  PROGNOSIS_OPTIONS, PROGNOSIS_FACTORS, SPECIAL_DIAGNOSES, PULPAL_DX, APICAL_DX,
  INSTRUMENT_SYSTEMS, INSTRUMENTATION_TYPES, NAOCL_CONCENTRATIONS, OBTURATION_TECHNIQUES,
  OBTURATION_MATERIALS, SEALER_TYPES, ANESTHETIC_AGENTS, TEMP_MATERIALS,
  type Flag, type FlagGroup,
} from "@/lib/endo";
import type { FlagMap } from "@/lib/clinical-types";
import { cn } from "@/lib/utils";

// The structured endodontic findings, adopted from the prototype and organized
// into Findings, Diagnosis, Procedure, and Prognosis. Flag groups render as
// toggle chips, procedure detail as selects. The model assists, the clinician
// records.
export interface StructuredValue {
  pulpalDiagnosis: string | null;
  apicalDiagnosis: string | null;
  etiology: FlagMap | null;
  clinicalFindings: FlagMap | null;
  radiographicFindings: FlagMap | null;
  treatmentPerformed: FlagMap | null;
  recommendations: FlagMap | null;
  prognosis: string | null;
  prognosisFactors: FlagMap | null;
  specialDiagnoses: FlagMap | null;
  procedureDetails: Record<string, unknown> | null;
}

const TABS = ["Findings", "Diagnosis", "Procedure", "Prognosis"] as const;
type Tab = (typeof TABS)[number];

export function StructuredFindings({
  value, locked, onCommit,
}: {
  value: StructuredValue;
  locked: boolean;
  onCommit: (patch: Partial<StructuredValue>) => void;
}) {
  const [tab, setTab] = useState<Tab>("Findings");
  const pd = (value.procedureDetails ?? {}) as Record<string, unknown>;
  const setProc = (k: string, v: unknown) => onCommit({ procedureDetails: { ...pd, [k]: v } });

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-lg bg-[var(--surface-2)] p-0.5">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("flex-1 rounded-md px-2 py-1 text-[12px] font-medium", tab === t ? "bg-surface text-endo shadow-sm" : "text-content-soft")}>{t}</button>
        ))}
      </div>

      {tab === "Findings" && (
        <>
          <Chips title="Etiology" flags={ETIOLOGY} map={value.etiology} locked={locked} onToggle={(m) => onCommit({ etiology: m })} />
          {FINDING_GROUPS.map((g: FlagGroup) => (
            <Chips key={g.key} title={g.label} flags={g.flags} map={value.clinicalFindings} locked={locked} onToggle={(m) => onCommit({ clinicalFindings: m })} />
          ))}
          <Chips title="Radiographic findings" flags={RADIOGRAPHIC} map={value.radiographicFindings} locked={locked} onToggle={(m) => onCommit({ radiographicFindings: m })} />
        </>
      )}

      {tab === "Diagnosis" && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Select label="Pulpal" value={value.pulpalDiagnosis ?? ""} options={PULPAL_DX} disabled={locked} onChange={(v) => onCommit({ pulpalDiagnosis: v })} />
            <Select label="Apical" value={value.apicalDiagnosis ?? ""} options={APICAL_DX} disabled={locked} onChange={(v) => onCommit({ apicalDiagnosis: v })} />
          </div>
          {!locked && <Predictor value={value} onCommit={onCommit} />}
          <Chips title="Special diagnoses" flags={SPECIAL_DIAGNOSES} map={value.specialDiagnoses} locked={locked} onToggle={(m) => onCommit({ specialDiagnoses: m })} />
        </>
      )}

      {tab === "Procedure" && (
        <>
          <Chips title="Treatment performed" flags={TREATMENT_PERFORMED} map={value.treatmentPerformed} locked={locked} onToggle={(m) => onCommit({ treatmentPerformed: m })} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Select label="Anesthetic" value={String(pd.anesthesiaAgent ?? "")} options={ANESTHETIC_AGENTS} disabled={locked} onChange={(v) => setProc("anesthesiaAgent", v)} />
            <Select label="Instrument system" value={String(pd.instrumentSystem ?? "")} options={INSTRUMENT_SYSTEMS} disabled={locked} onChange={(v) => setProc("instrumentSystem", v)} />
            <Select label="Instrumentation" value={String(pd.instrumentationType ?? "")} options={INSTRUMENTATION_TYPES} disabled={locked} onChange={(v) => setProc("instrumentationType", v)} />
            <Select label="NaOCl" value={String(pd.naOClConcentration ?? "")} options={NAOCL_CONCENTRATIONS} disabled={locked} onChange={(v) => setProc("naOClConcentration", v)} />
            <Select label="Obturation" value={String(pd.obturationTechnique ?? "")} options={OBTURATION_TECHNIQUES} disabled={locked} onChange={(v) => setProc("obturationTechnique", v)} />
            <Select label="Material" value={String(pd.obturationMaterial ?? "")} options={OBTURATION_MATERIALS} disabled={locked} onChange={(v) => setProc("obturationMaterial", v)} />
            <Select label="Sealer" value={String(pd.sealerType ?? "")} options={SEALER_TYPES} disabled={locked} onChange={(v) => setProc("sealerType", v)} />
            <Select label="Temporary" value={String(pd.tempMaterial ?? "")} options={TEMP_MATERIALS} disabled={locked} onChange={(v) => setProc("tempMaterial", v)} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Toggle label="Rubber dam" on={!!pd.rubberDamPlaced} locked={locked} onClick={() => setProc("rubberDamPlaced", !pd.rubberDamPlaced)} />
            <Toggle label="Glide path" on={!!pd.glidePathEstablished} locked={locked} onClick={() => setProc("glidePathEstablished", !pd.glidePathEstablished)} />
            <Toggle label="Ultrasonic activation" on={!!pd.ultrasonicActivation} locked={locked} onClick={() => setProc("ultrasonicActivation", !pd.ultrasonicActivation)} />
            <Toggle label="EDTA" on={!!pd.irrigationEDTA} locked={locked} onClick={() => setProc("irrigationEDTA", !pd.irrigationEDTA)} />
            <Toggle label="Separated instrument" on={!!pd.separatedInstrument} locked={locked} tone="urgent" onClick={() => setProc("separatedInstrument", !pd.separatedInstrument)} />
            <Toggle label="Perforation" on={!!pd.perforation} locked={locked} tone="urgent" onClick={() => setProc("perforation", !pd.perforation)} />
            <Toggle label="Treatment complete" on={!!pd.treatmentComplete} locked={locked} tone="endo" onClick={() => setProc("treatmentComplete", !pd.treatmentComplete)} />
          </div>
        </>
      )}

      {tab === "Prognosis" && (
        <>
          <Select label="Prognosis" value={value.prognosis ?? ""} options={PROGNOSIS_OPTIONS} disabled={locked} onChange={(v) => onCommit({ prognosis: v })} />
          <div className="mt-2">
            <Chips title="Prognosis factors" flags={PROGNOSIS_FACTORS} map={value.prognosisFactors} locked={locked} onToggle={(m) => onCommit({ prognosisFactors: m })} />
          </div>
          <Chips title="Recommendations" flags={RECOMMENDATIONS} map={value.recommendations} locked={locked} onToggle={(m) => onCommit({ recommendations: m })} />
        </>
      )}
    </div>
  );
}

interface Prediction {
  diagnosis: { pulpalDiagnosis: string; apicalDiagnosis: string; confidence: number; findings: string[] };
  prognosis: { prognosis: string; confidence: number; factors: string[] };
}

// The diagnosis and prognosis predictor: scores the structured findings and
// offers a predicted pulpal and apical diagnosis and prognosis to apply.
function Predictor({ value, onCommit }: { value: StructuredValue; onCommit: (patch: Partial<StructuredValue>) => void }) {
  const [pred, setPred] = useState<Prediction | null>(null);
  const predict = useMutation({
    mutationFn: () => apiRequest<Prediction>("POST", "/api/predict", { clinicalFindings: value.clinicalFindings ?? {}, prognosisFactors: value.prognosisFactors ?? {} }),
    onSuccess: setPred,
  });

  return (
    <div className="mb-3 rounded-lg border border-endo/25 bg-endo/6 p-2.5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-endo" />
        <span className="text-[12px] font-semibold text-endo">Diagnosis predictor</span>
        <button onClick={() => predict.mutate()} disabled={predict.isPending} className="ml-auto rounded-md bg-endo/12 px-2 py-0.5 text-[11px] font-medium text-endo">
          {predict.isPending ? "Scoring..." : "Predict from findings"}
        </button>
      </div>
      {pred && (
        <div className="mt-2 space-y-1.5 text-[12px]">
          <PredRow label="Pulpal" value={pred.diagnosis.pulpalDiagnosis} conf={pred.diagnosis.confidence} onApply={() => onCommit({ pulpalDiagnosis: pred.diagnosis.pulpalDiagnosis })} />
          <PredRow label="Apical" value={pred.diagnosis.apicalDiagnosis} conf={pred.diagnosis.confidence} onApply={() => onCommit({ apicalDiagnosis: pred.diagnosis.apicalDiagnosis })} />
          <PredRow label="Prognosis" value={pred.prognosis.prognosis} conf={pred.prognosis.confidence} onApply={() => onCommit({ prognosis: pred.prognosis.prognosis })} />
          {pred.diagnosis.findings.length > 0 && <div className="text-[11px] text-content-soft">Drivers: {pred.diagnosis.findings.join(", ")}</div>}
          <div className="text-[10px] text-content-soft">Advisory, confirm before signing.</div>
        </div>
      )}
    </div>
  );
}

function PredRow({ label, value, conf, onApply }: { label: string; value: string; conf: number; onApply: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-content-soft">{label}</span>
      <span className="font-medium">{value}</span>
      <span className="text-[10px] text-content-soft tnum">{Math.round(conf * 100)}%</span>
      <button onClick={onApply} className="ml-auto flex items-center gap-1 rounded bg-endo/12 px-1.5 py-0.5 text-[10px] text-endo"><Check className="h-3 w-3" /> Apply</button>
    </div>
  );
}

function Chips({ title, flags, map, locked, onToggle }: { title: string; flags: Flag[]; map: FlagMap | null; locked: boolean; onToggle: (m: FlagMap) => void }) {
  const m = map ?? {};
  return (
    <div className="mb-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-content-soft">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {flags.map((f) => (
          <button
            key={f.key}
            disabled={locked}
            onClick={() => onToggle({ ...m, [f.key]: !m[f.key] })}
            className={cn("rounded-full border px-2.5 py-1 text-[11px]", m[f.key] ? "border-endo bg-endo/12 text-endo" : "border-hairline text-content-soft hover:border-endo/50", locked && "opacity-70")}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, on, locked, onClick, tone = "default" }: { label: string; on: boolean; locked: boolean; onClick: () => void; tone?: "default" | "urgent" | "endo" }) {
  const onClass = tone === "urgent" ? "border-urgent bg-urgent/12 text-urgent" : tone === "endo" ? "border-endo bg-endo/12 text-endo" : "border-endo bg-endo/12 text-endo";
  return (
    <button disabled={locked} onClick={onClick} className={cn("rounded-full border px-2.5 py-1 text-[11px]", on ? onClass : "border-hairline text-content-soft hover:border-endo/50", locked && "opacity-70")}>
      {label}
    </button>
  );
}

function Select({ label, value, options, onChange, disabled }: { label: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-content-soft">{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-sage disabled:opacity-70">
        <option value="">Select...</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
