import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, ShieldAlert, Clock, Unlock, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { PatientRow } from "@/lib/clinical-types";

interface Appt {
  id: number;
  patientId: number | null;
  patientName: string | null;
  providerId: number | null;
  operatory: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  isProtected: boolean;
  confirmed: boolean;
  typeName: string | null;
  typeColor: string | null;
  isEmergencyType: boolean;
}
interface ScheduleData {
  date: string;
  clinicId: number;
  now: string;
  clockPinned: boolean;
  appointments: Appt[];
}

const OPS = ["Op 1", "Op 2", "Op 3", "Op 4"];
const START_HOUR = 8;
const END_HOUR = 17;
const ROW_MIN = 30;
const ROW_PX = 44;
const ROWS = ((END_HOUR - START_HOUR) * 60) / ROW_MIN;

// The Schedule: a day view with operatory columns, drag and drop rescheduling,
// emergency slot shading from the Thanksgiving Rule, and the booking flow that
// blocks a protected slot, allows a manager override, and frees slots at the 2 PM
// release. The clock is injectable so the release can be demonstrated.
export function Schedule() {
  const { user } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const clinicId = user?.clinicIds[0];
  const [booking, setBooking] = useState<Appt | null>(null);

  const { data } = useQuery({
    queryKey: ["/api/schedule", date, clinicId],
    queryFn: () => apiRequest<ScheduleData>("GET", `/api/schedule?date=${date}&clinicId=${clinicId}`),
  });

  const move = useMutation({
    mutationFn: (v: { id: number; startsAt: string; operatory: string }) => apiRequest("PATCH", `/api/appointments/${v.id}`, v),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/schedule"] }),
  });
  const release = useMutation({
    mutationFn: () => apiRequest<{ released: number }>("POST", "/api/schedule/release"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/schedule"] }),
  });
  const setClock = useMutation({
    mutationFn: (iso: string | null) => apiRequest("POST", "/api/dev/clock", { iso }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/schedule"] }),
  });

  const appts = data?.appointments ?? [];
  const nowDate = data ? new Date(data.now) : new Date();

  const topFor = (iso: string) => {
    const d = new Date(iso);
    return (((d.getHours() - START_HOUR) * 60 + d.getMinutes()) / ROW_MIN) * ROW_PX;
  };
  const heightFor = (a: Appt) => Math.max(ROW_PX - 4, ((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60000 / ROW_MIN) * ROW_PX - 4);

  const onDrop = (op: string, rowIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/appt"));
    if (!id) return;
    const start = new Date(`${date}T00:00:00`);
    start.setHours(START_HOUR, 0, 0, 0);
    start.setMinutes(start.getMinutes() + rowIndex * ROW_MIN);
    move.mutate({ id, startsAt: start.toISOString(), operatory: op });
  };

  const pinTo2pm = () => {
    const d = new Date(`${date}T14:05:00`);
    setClock.mutate(d.toISOString());
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-6 py-3">
        <h1 className="text-[18px] font-semibold">Schedule</h1>
        <div className="ml-2 flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setDate(format(addDays(new Date(date), -1), "yyyy-MM-dd"))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="subtle" size="sm" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>Today</Button>
          <Button variant="ghost" size="icon" onClick={() => setDate(format(addDays(new Date(date), 1), "yyyy-MM-dd"))}><ChevronRight className="h-4 w-4" /></Button>
          <span className="ml-2 text-[13px] font-medium">{format(new Date(`${date}T12:00`), "EEEE, MMMM d")}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px]", data?.clockPinned ? "border-caution text-caution" : "border-hairline text-content-soft")}>
            <Clock className="h-3.5 w-3.5" /> {format(nowDate, "h:mm a")} {data?.clockPinned && "(pinned)"}
          </div>
          <Button variant="outline" size="sm" onClick={pinTo2pm} title="Demo: pin the clock to 2:05 PM">Pin to 2 PM</Button>
          {data?.clockPinned && <Button variant="ghost" size="sm" onClick={() => setClock.mutate(null)}>Reset clock</Button>}
          <Button size="sm" onClick={() => release.mutate()} disabled={release.isPending}><Unlock className="h-4 w-4" /> Release slots</Button>
        </div>
      </div>

      {release.data && (
        <div className="bg-endo/8 px-6 py-1.5 text-[12px] text-endo">Released {release.data.released} protected slot{release.data.released === 1 ? "" : "s"} whose 2 PM hold has passed.</div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex">
          {/* Time gutter */}
          <div className="w-14 shrink-0">
            <div className="h-7" />
            {Array.from({ length: ROWS }).map((_, i) => (
              <div key={i} className="relative text-right" style={{ height: ROW_PX }}>
                {i % 2 === 0 && <span className="absolute -top-2 right-2 text-[10px] text-content-soft tnum">{format(new Date(0, 0, 0, START_HOUR + i / 2, 0), "h a")}</span>}
              </div>
            ))}
          </div>

          {/* Operatory columns */}
          {OPS.map((op) => (
            <div key={op} className="min-w-[150px] flex-1 border-l border-hairline">
              <div className="flex h-7 items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-content-soft">{op}</div>
              <div className="relative">
                {Array.from({ length: ROWS }).map((_, i) => (
                  <div key={i} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(op, i, e)} className={cn("border-b border-hairline", i % 2 === 1 && "border-b-transparent")} style={{ height: ROW_PX }} />
                ))}
                {appts.filter((a) => (a.operatory ?? "Op 1") === op).map((a) => {
                  const protectedOpen = a.isProtected && !a.patientId;
                  return (
                    <div
                      key={a.id}
                      draggable={!!a.patientId}
                      onDragStart={(e) => e.dataTransfer.setData("text/appt", String(a.id))}
                      onClick={() => protectedOpen && setBooking(a)}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md border px-2 py-1 text-[11px] shadow-sm",
                        protectedOpen
                          ? "cursor-pointer border-dashed border-urgent/50 bg-urgent/8 text-urgent"
                          : a.isEmergencyType
                            ? "border-urgent/40 bg-urgent/12 text-content"
                            : "cursor-grab border-hairline bg-surface text-content",
                      )}
                      style={{ top: topFor(a.startsAt) + 2, height: heightFor(a), borderLeftWidth: 3, borderLeftColor: a.typeColor ?? "#3A7D44" }}
                    >
                      {protectedOpen ? (
                        <div className="flex items-center gap-1 font-medium"><ShieldAlert className="h-3 w-3" /> Emergency hold</div>
                      ) : (
                        <>
                          <div className="truncate font-medium">{a.patientName ?? "Open"}</div>
                          <div className="truncate text-content-soft">{a.typeName}</div>
                        </>
                      )}
                      <div className="text-[10px] text-content-soft tnum">{format(new Date(a.startsAt), "h:mm a")}{!a.confirmed && a.patientId ? ", unconfirmed" : ""}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {booking && <BookDialog slot={booking} onClose={() => setBooking(null)} />}
    </div>
  );
}

// Booking into a protected slot. Front desk is blocked, a manager may override
// with a reason. An emergency booking is always allowed.
function BookDialog({ slot, onClose }: { slot: Appt; onClose: () => void }) {
  const { user } = useAuth();
  const isManager = user?.role === "office_manager" || user?.role === "practice_owner";
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PatientRow | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["/api/patients", q],
    queryFn: () => apiRequest<{ patients: PatientRow[] }>("GET", `/api/patients?q=${encodeURIComponent(q)}`),
    enabled: q.length > 1,
  });

  const book = useMutation({
    mutationFn: () => apiRequest("POST", `/api/appointments/${slot.id}/book`, { patientId: selected!.id, isEmergency: emergency, overrideReason: reason || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/schedule"] }); onClose(); },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-5 shadow-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-urgent" />
          <h2 className="text-[15px] font-semibold">Book protected emergency slot</h2>
          <button onClick={onClose} className="ml-auto text-content-soft hover:text-content"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 text-[12px] text-content-soft">{format(new Date(slot.startsAt), "EEEE h:mm a")}, {slot.operatory}. This slot is held for same day emergencies.</p>

        <input value={q} onChange={(e) => { setQ(e.target.value); setSelected(null); }} placeholder="Search patient by name..." className="mb-2 w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-sage" />
        {!selected && data?.patients?.length ? (
          <div className="mb-2 max-h-32 overflow-y-auto rounded-lg border border-hairline">
            {data.patients.slice(0, 6).map((p) => (
              <button key={p.id} onClick={() => { setSelected(p); setQ(`${p.firstName} ${p.lastName}`); }} className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-[var(--surface-2)]">
                {p.lastName}, {p.firstName}
              </button>
            ))}
          </div>
        ) : null}

        <label className="mb-2 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} className="accent-endo" />
          This is a same day emergency
        </label>

        {!emergency && (
          <div className="mb-2">
            <label className="mb-1 block text-[12px] text-content-soft">{isManager ? "Manager override reason (required to book a protected slot early)" : "Override reason"}</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} disabled={!isManager} placeholder={isManager ? "Reason for using the emergency hold" : "Managers only"} className="w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-sage disabled:opacity-60" />
          </div>
        )}

        {error && <div className="mb-2 rounded-md bg-urgent/10 px-3 py-2 text-[12px] text-urgent">{error}</div>}

        <Button className="w-full" disabled={!selected || book.isPending} onClick={() => { setError(null); book.mutate(); }}>
          {book.isPending ? "Booking..." : "Book into slot"}
        </Button>
        {!isManager && !emergency && <p className="mt-2 text-center text-[11px] text-content-soft">Front desk cannot book a protected slot early. Mark it an emergency, or ask a manager to override.</p>}
      </div>
    </div>
  );
}
