import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";

// The kiosk route for the office iPad. A patient self checks in by last name and
// date of birth, no login.
export function Kiosk() {
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");

  const checkin = useMutation({
    mutationFn: () => apiRequest<{ firstName: string; message: string; appointmentTime: string }>("POST", "/api/kiosk/checkin", { lastName, dateOfBirth: dob || undefined }),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-forest p-6">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-panel">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-endo text-lg font-bold text-white">UE</div>
          <div>
            <div className="font-serif text-[20px] font-semibold">Welcome to United Endodontics</div>
            <div className="text-[13px] text-content-soft">Check in for your appointment</div>
          </div>
        </div>

        {checkin.isSuccess ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-endo" />
            <div className="text-[17px] font-semibold">You are checked in</div>
            <p className="mx-auto mt-2 max-w-xs text-[14px] text-content-soft">{checkin.data.message}</p>
            <div className="mt-3 text-[13px] text-content-soft">Appointment at {format(new Date(checkin.data.appointmentTime), "h:mm a")}</div>
            <Button variant="outline" className="mt-5" onClick={() => checkin.reset()}>Check in another patient</Button>
          </div>
        ) : (
          <>
            <label className="mb-1 block text-[13px] font-medium text-content-soft">Last name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mb-3 w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-3 py-3 text-[16px] outline-none focus:ring-2 focus:ring-sage" autoFocus />
            <label className="mb-1 block text-[13px] font-medium text-content-soft">Date of birth (optional)</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="mb-4 w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-3 py-3 text-[16px] outline-none focus:ring-2 focus:ring-sage" />
            {checkin.isError && <div className="mb-3 rounded-lg bg-urgent/10 px-3 py-2 text-[13px] text-urgent">{(checkin.error as Error).message}</div>}
            <Button className="w-full py-3 text-[15px]" onClick={() => checkin.mutate()} disabled={!lastName || checkin.isPending}>
              {checkin.isPending ? "Checking in..." : "Check in"} <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
