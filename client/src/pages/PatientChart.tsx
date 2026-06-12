import { useState, useCallback } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronLeft, Upload, Stethoscope, CalendarPlus, CalendarDays, ImagePlus, ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { age, type PatientRow, type StudyRow, type VisitRow } from "@/lib/clinical-types";
import { ImagingGrid } from "@/components/imaging/ImagingGrid";
import { Filmstrip } from "@/components/imaging/Filmstrip";
import { ToothChart } from "@/components/imaging/ToothChart";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { ClipboardSignature, CreditCard, FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApptRow { id: number; startsAt: string; status: string; operatory: string | null; confirmed: boolean; typeName: string | null }

interface ChartDetail {
  patient: PatientRow;
  referrer: { fullName: string; practiceName: string } | null;
  provider: { fullName: string } | null;
  imageCount: number;
}

const TABS = ["Imaging", "Overview", "Tooth Chart", "Visits", "Plans", "Billing", "Documents", "Messages"] as const;
type Tab = (typeof TABS)[number];

// The Patient Chart. Its default tab is Imaging, the chart opens to a wall of
// images, not a form. The Filmstrip docks to the bottom across clinical tabs and
// dropping a file anywhere imports it into the active patient.
export function PatientChart() {
  const [, params] = useRoute("/patients/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);
  const [tab, setTab] = useState<Tab>("Imaging");
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);

  // Start a visit and jump straight into the cockpit.
  const startVisit = useMutation({
    mutationFn: () => apiRequest<{ visit: { id: number } }>("POST", "/api/visits", { patientId: id, type: "treatment" }),
    onSuccess: ({ visit }) => navigate(`/visits/${visit.id}`),
  });

  const detail = useQuery({
    queryKey: ["/api/patients", id],
    queryFn: () => apiRequest<ChartDetail>("GET", `/api/patients/${id}`),
  });
  const studiesQ = useQuery({
    queryKey: ["/api/patients", id, "studies"],
    queryFn: () => apiRequest<{ studies: StudyRow[] }>("GET", `/api/patients/${id}/studies`),
  });
  const visitsQ = useQuery({
    queryKey: ["/api/patients", id, "visits"],
    queryFn: () => apiRequest<{ visits: VisitRow[] }>("GET", `/api/patients/${id}/visits`),
  });

  const studies = studiesQ.data?.studies ?? [];
  const visits = visitsQ.data?.visits ?? [];

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      setImporting(true);
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(file);
      });
      await apiRequest("POST", "/api/studies/import", {
        patientId: id,
        dataUrl,
        type: "intraoral_photo",
        toothNumbers: selectedTooth ? [selectedTooth] : [],
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/patients", id, "studies"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/patients", id] });
      setImporting(false);
    },
    [id, selectedTooth],
  );

  if (detail.isLoading) {
    return <div className="flex h-full items-center justify-center text-[13px] text-content-soft">Loading chart...</div>;
  }
  if (!detail.data) {
    return <div className="flex h-full items-center justify-center text-[13px] text-content-soft">Patient not found.</div>;
  }
  const p = detail.data.patient;

  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="border-b border-hairline px-6 py-3">
        <Link href="/patients">
          <span className="mb-1 inline-flex cursor-pointer items-center gap-1 text-[12px] text-content-soft hover:text-content">
            <ChevronLeft className="h-3.5 w-3.5" /> Patients
          </span>
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-[19px] font-semibold">{p.firstName} {p.lastName}</h1>
          <span className="text-[13px] text-content-soft">
            Age {age(p.dateOfBirth)}, {p.sex}, DOB {format(new Date(p.dateOfBirth), "MMM d, yyyy")}
          </span>
          <span className="text-[13px] text-content-soft">{p.insuranceCarrier}</span>
          {detail.data.referrer && (
            <span className="text-[13px] text-content-soft">
              Referred by {detail.data.referrer.fullName}, {detail.data.referrer.practiceName}
            </span>
          )}
          <span className="ml-auto rounded-full bg-endo/12 px-2.5 py-0.5 text-[12px] font-medium text-endo tnum">
            {detail.data.imageCount} images
          </span>
        </div>

        {/* Quick actions, the chart is the hub */}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => startVisit.mutate()} disabled={startVisit.isPending}>
            <Stethoscope className="h-4 w-4" /> {startVisit.isPending ? "Starting..." : "Start visit"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/schedule")}>
            <CalendarPlus className="h-4 w-4" /> Schedule appointment
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setTab("Imaging"); }}>
            <ImagePlus className="h-4 w-4" /> Drop an image to import
          </Button>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-[13px] font-medium",
                tab === t ? "bg-endo/12 text-endo" : "text-content-soft hover:bg-[var(--surface-2)]",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "Imaging" && (
          <ImagingGrid key={selectedTooth ?? "all"} studies={studies} visits={visits} initialTooth={selectedTooth} />
        )}
        {tab === "Tooth Chart" && (
          <div className="h-full overflow-y-auto">
            <ToothChart
              studies={studies}
              visits={visits}
              selected={selectedTooth}
              onSelect={(t) => { setSelectedTooth(t); if (t) setTab("Imaging"); }}
            />
          </div>
        )}
        {tab === "Overview" && <Overview detail={detail.data} studies={studies} visits={visits} patientId={id} onOpenVisit={(vid) => navigate(`/visits/${vid}`)} />}
        {tab === "Visits" && <Visits visits={visits} onOpenVisit={(vid) => navigate(`/visits/${vid}`)} />}
        {tab === "Plans" && <PlaceholderPage icon={ClipboardSignature} title="Treatment Plans" blurb="Multi option plans with insurance estimates and canvas e-signature capture." phase="Phase 4" />}
        {tab === "Billing" && <PlaceholderPage icon={CreditCard} title="Billing" blurb="Claims, eligibility, statements, and payment plans for this patient." phase="Phase 5" />}
        {tab === "Documents" && <PlaceholderPage icon={FileText} title="Documents" blurb="Scanned forms, consents, and signed plan snapshots." phase="Phase 4" />}
        {tab === "Messages" && <PlaceholderPage icon={MessageSquare} title="Messages" blurb="Two way patient texting and secure messages." phase="Phase 5" />}
      </div>

      {/* Filmstrip docked to the bottom of clinical views */}
      <Filmstrip studies={studies} />

      {/* Drag and drop import overlay */}
      {(dragOver || importing) && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-endo/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 rounded-card border-2 border-dashed border-endo bg-surface px-8 py-6 shadow-panel">
            <Upload className="h-7 w-7 text-endo" />
            <div className="text-[14px] font-medium">{importing ? "Importing image..." : "Drop to import into this chart"}</div>
            {selectedTooth && <div className="text-[12px] text-content-soft">Will tag tooth {selectedTooth}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Overview({ detail, studies, visits, patientId, onOpenVisit }: { detail: ChartDetail; studies: StudyRow[]; visits: VisitRow[]; patientId: number; onOpenVisit: (id: number) => void }) {
  const signed = visits.filter((v) => v.status === "signed").length;
  const balance = detail.patient.balanceCents ?? 0;
  const appts = useQuery({
    queryKey: ["/api/patients", patientId, "appointments"],
    queryFn: () => apiRequest<{ appointments: ApptRow[] }>("GET", `/api/patients/${patientId}/appointments`),
  });
  const all = appts.data?.appointments ?? [];
  const upcoming = all.filter((a) => new Date(a.startsAt) >= new Date()).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const recentImages = [...studies].sort((a, b) => +new Date(b.capturedAt) - +new Date(a.capturedAt)).slice(0, 6);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Images" value={String(detail.imageCount)} />
          <Stat label="Visits" value={String(visits.length)} />
          <Stat label="Completed" value={String(signed)} />
          <Stat label="Balance" value={`$${(balance / 100).toFixed(2)}`} tone={balance > 0 ? "caution" : "ok"} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {/* Upcoming appointments */}
          <Card icon={CalendarDays} title="Upcoming appointments">
            {upcoming.length ? upcoming.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-2 border-b border-hairline py-2 text-[13px] last:border-0">
                <span className="tnum">{format(new Date(a.startsAt), "EEE MMM d, h:mm a")}</span>
                <span className="text-content-soft">{a.typeName}</span>
                <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px]", a.confirmed ? "bg-complete/20 text-endo" : "bg-caution/20 text-caution")}>{a.confirmed ? "confirmed" : "unconfirmed"}</span>
              </div>
            )) : <div className="text-[13px] text-content-soft">No upcoming appointments.</div>}
          </Card>

          {/* Recent images, links into the imaging grid */}
          <Card icon={ImagePlus} title="Recent imaging">
            {recentImages.length ? (
              <div className="grid grid-cols-6 gap-1.5">
                {recentImages.map((s) => (
                  <div key={s.id} className="aspect-[3/4] overflow-hidden rounded border border-hairline bg-clay-900">
                    {s.thumbAssetId && <img src={`/api/images/${s.thumbAssetId}`} alt={s.type} className="h-full w-full object-cover" loading="lazy" />}
                  </div>
                ))}
              </div>
            ) : <div className="text-[13px] text-content-soft">No images yet.</div>}
          </Card>
        </div>

        {/* Recent visits, each opens the cockpit */}
        <div className="mt-4 rounded-card border border-hairline bg-surface p-5 shadow-card">
          <h3 className="mb-3 text-[14px] font-semibold">Recent visits</h3>
          {visits.slice(0, 6).map((v) => (
            <button key={v.id} onClick={() => onOpenVisit(v.id)} className="group flex w-full items-center gap-3 border-b border-hairline py-2 text-left text-[13px] last:border-0 hover:text-endo">
              <span className="tnum text-content-soft">{format(new Date(v.visitDate), "MMM d, yyyy")}</span>
              <span className="font-medium">Tooth {v.toothNumber}</span>
              <span className="text-content-soft">{v.note?.pulpalDiagnosis}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px]", v.status === "signed" ? "bg-complete/20 text-endo" : "bg-caution/20 text-caution")}>{v.status}</span>
              <ArrowRight className="ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
          {visits.length === 0 && <div className="text-[13px] text-content-soft">No visits recorded.</div>}
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof CalendarDays; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Icon className="h-4 w-4 text-endo" /> {title}</div>
      {children}
    </div>
  );
}

function Visits({ visits, onOpenVisit }: { visits: VisitRow[]; onOpenVisit: (id: number) => void }) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-3">
        {visits.map((v) => (
          <div key={v.id} onClick={() => onOpenVisit(v.id)} className="cursor-pointer rounded-card border border-hairline bg-surface p-4 shadow-card transition-shadow hover:ring-2 hover:ring-sage">
            <div className="flex items-baseline gap-3">
              <span className="text-[14px] font-semibold">Tooth {v.toothNumber}</span>
              <span className="text-[12px] text-content-soft tnum">{format(new Date(v.visitDate), "EEEE, MMM d, yyyy")}</span>
              <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px]", v.status === "signed" ? "bg-complete/20 text-endo" : "bg-caution/20 text-caution")}>{v.status}</span>
            </div>
            {v.note && (
              <div className="mt-2 grid gap-1 text-[12px] text-content-soft sm:grid-cols-2">
                <div><span className="font-medium text-content">Pulpal:</span> {v.note.pulpalDiagnosis}</div>
                <div><span className="font-medium text-content">Apical:</span> {v.note.apicalDiagnosis}</div>
                {v.note.canals && (
                  <div className="sm:col-span-2">
                    <span className="font-medium text-content">Canals:</span>{" "}
                    {v.note.canals.map((c) => `${c.name} ${c.workingLengthMm}mm`).join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {visits.length === 0 && <div className="text-[13px] text-content-soft">No visits recorded.</div>}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "caution" }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
      <div className="text-[11px] uppercase tracking-wide text-content-soft">{label}</div>
      <div className={cn("mt-1 text-[24px] font-semibold tnum", tone === "caution" && "text-caution")}>{value}</div>
    </div>
  );
}
