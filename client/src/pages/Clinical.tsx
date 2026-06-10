import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Stethoscope, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

interface VisitListRow {
  id: number;
  patientName: string;
  toothNumber: number | null;
  visitDate: string;
  status: string;
  chiefComplaint: string | null;
}

// The Clinical module landing: open visits to finish first, then recent signed
// work. Each row opens the Visit Workspace cockpit.
export function Clinical() {
  const { data } = useQuery({
    queryKey: ["/api/visits"],
    queryFn: () => apiRequest<{ visits: VisitListRow[] }>("GET", "/api/visits"),
  });
  const visits = data?.visits ?? [];
  const open = visits.filter((v) => v.status === "open");
  const signed = visits.filter((v) => v.status === "signed").slice(0, 12);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hairline px-7 py-4">
        <h1 className="text-[18px] font-semibold">Clinical</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <Section title="Open visits" subtitle="Finish documentation and sign">
            {open.length === 0 ? (
              <Empty label="No open visits. Start one from a patient chart." />
            ) : (
              open.map((v) => <Row key={v.id} v={v} accent />)
            )}
          </Section>
          <Section title="Recently signed">
            {signed.length === 0 ? <Empty label="No signed visits yet." /> : signed.map((v) => <Row key={v.id} v={v} />)}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {subtitle && <span className="text-[12px] text-content-soft">{subtitle}</span>}
      </div>
      <div className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">{children}</div>
    </div>
  );
}

function Row({ v, accent }: { v: VisitListRow; accent?: boolean }) {
  return (
    <Link href={`/visits/${v.id}`}>
      <div className="group flex cursor-pointer items-center gap-3 border-b border-hairline px-4 py-3 last:border-0 hover:bg-[var(--surface-2)]">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accent ? "bg-caution/15 text-caution" : "bg-endo/12 text-endo")}>
          <Stethoscope className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium">{v.patientName}, tooth {v.toothNumber ?? "?"}</div>
          <div className="truncate text-[12px] text-content-soft">{v.chiefComplaint ?? "No complaint recorded"}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[12px] text-content-soft tnum">{format(new Date(v.visitDate), "MMM d, yyyy")}</div>
          <span className={cn("text-[11px]", accent ? "text-caution" : "text-endo")}>{v.status}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-content-soft opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="px-4 py-6 text-center text-[13px] text-content-soft">{label}</div>;
}
