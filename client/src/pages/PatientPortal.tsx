import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, ClipboardCheck, CreditCard, MessageSquare } from "lucide-react";
import { apiRequest } from "@/lib/api";

interface PortalData {
  patient: { firstName: string; lastName: string; balanceCents: number };
  upcoming: { id: number; startsAt: string; status: string }[];
  plans: { id: number; title: string; signedAt: string | null }[];
  messages: { id: number; direction: string; body: string; createdAt: string }[];
}

// The read-only patient portal: upcoming visits, signed plans, balance, and
// secure messages, reached with a per patient token.
export function PatientPortal() {
  const token = new URLSearchParams(location.search).get("token") ?? "";
  const { data, isError } = useQuery({ queryKey: ["patient-portal", token], queryFn: () => apiRequest<PortalData>("GET", `/api/patient-portal?token=${token}`), retry: false });

  if (isError || !token) return <div className="flex min-h-screen items-center justify-center bg-canvas text-content-soft text-[14px]">Invalid portal link.</div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-canvas text-content-soft text-[13px]">Loading...</div>;

  return (
    <div className="min-h-screen bg-canvas text-content">
      <header className="bg-forest px-6 py-5 text-parchment">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-endo text-[15px] font-bold text-white">UE</div>
          <div>
            <div className="font-serif text-[20px] font-semibold">Hello, {data.patient.firstName}</div>
            <div className="text-[12px] text-parchment/70">Your United Endodontics portal</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <Card icon={CreditCard} title="Account balance">
          <div className="text-[22px] font-semibold tnum">${(data.patient.balanceCents / 100).toFixed(2)}</div>
          {data.patient.balanceCents > 0 && <div className="text-[12px] text-content-soft">Tap the pay by text link we sent to settle your balance.</div>}
        </Card>
        <Card icon={CalendarDays} title="Upcoming visits">
          {data.upcoming.length ? data.upcoming.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b border-hairline py-1.5 text-[13px] last:border-0">
              <span>{format(new Date(a.startsAt), "EEEE, MMM d, h:mm a")}</span>
              <span className="capitalize text-content-soft">{a.status}</span>
            </div>
          )) : <div className="text-[13px] text-content-soft">No upcoming visits.</div>}
        </Card>
        <Card icon={ClipboardCheck} title="Signed plans">
          {data.plans.length ? data.plans.map((p) => <div key={p.id} className="text-[13px]">{p.title}</div>) : <div className="text-[13px] text-content-soft">No signed plans.</div>}
        </Card>
        <Card icon={MessageSquare} title="Secure messages">
          {data.messages.length ? data.messages.slice(0, 5).map((m) => (
            <div key={m.id} className="border-b border-hairline py-1.5 text-[13px] last:border-0"><span className="text-content-soft">{m.direction === "outbound" ? "From the office: " : "You: "}</span>{m.body}</div>
          )) : <div className="text-[13px] text-content-soft">No messages.</div>}
        </Card>
      </main>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof CreditCard; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Icon className="h-4 w-4 text-endo" /> {title}</div>
      {children}
    </div>
  );
}
