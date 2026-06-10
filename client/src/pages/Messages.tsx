import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Send, BellRing, MessageSquare } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Conv { id: number; patientName: string; preview: string; lastMessageAt: string | null; channel: string }
interface Msg { id: number; direction: string; body: string; createdAt: string }

// The patient texting inbox on a simulated SMS transport, plus internal threads.
// Outbound messages are the development outbox, no real SMS is sent.
export function Messages() {
  const [active, setActive] = useState<number | null>(null);
  const { data } = useQuery({ queryKey: ["/api/conversations"], queryFn: () => apiRequest<{ conversations: Conv[] }>("GET", "/api/conversations") });
  const convs = data?.conversations ?? [];
  const activeId = active ?? convs[0]?.id ?? null;

  const reminders = useMutation({
    mutationFn: () => apiRequest<{ sent: number }>("POST", "/api/reminders/run"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/conversations"] }),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-hairline px-6 py-4">
        <h1 className="text-[18px] font-semibold">Messages</h1>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => reminders.mutate()} disabled={reminders.isPending}>
          <BellRing className="h-4 w-4" /> {reminders.isPending ? "Sending..." : reminders.data ? `Queued ${reminders.data.sent} reminders` : "Run reminders"}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0 overflow-y-auto border-r border-hairline">
          {convs.map((c) => (
            <button key={c.id} onClick={() => setActive(c.id)} className={cn("flex w-full items-start gap-2 border-b border-hairline px-3 py-2.5 text-left", activeId === c.id ? "bg-endo/8" : "hover:bg-[var(--surface-2)]")}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-parchment">{(c.patientName || "?")[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-[13px] font-medium">{c.patientName}</span>
                  <span className="ml-auto text-[10px] text-content-soft tnum">{c.lastMessageAt ? format(new Date(c.lastMessageAt), "MMM d") : ""}</span>
                </div>
                <div className="truncate text-[12px] text-content-soft">{c.preview}</div>
              </div>
            </button>
          ))}
          {convs.length === 0 && <div className="p-4 text-center text-[13px] text-content-soft">No conversations yet.</div>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {activeId ? <Thread id={activeId} /> : <div className="flex flex-1 items-center justify-center text-content-soft"><MessageSquare className="mr-2 h-5 w-5" /> Select a conversation</div>}
        </div>
      </div>
    </div>
  );
}

function Thread({ id }: { id: number }) {
  const { data } = useQuery({ queryKey: ["/api/conversations", id], queryFn: () => apiRequest<{ patientName: string; messages: Msg[] }>("GET", `/api/conversations/${id}`) });
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: () => apiRequest("POST", `/api/conversations/${id}/messages`, { body: text }),
    onSuccess: () => { setText(""); queryClient.invalidateQueries({ queryKey: ["/api/conversations", id] }); queryClient.invalidateQueries({ queryKey: ["/api/conversations"] }); },
  });

  return (
    <>
      <div className="border-b border-hairline px-5 py-2.5 text-[13px] font-semibold">{data?.patientName}</div>
      <div className="flex-1 space-y-2 overflow-y-auto p-5">
        {(data?.messages ?? []).map((m) => (
          <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[70%] rounded-2xl px-3 py-2 text-[13px]", m.direction === "outbound" ? "bg-endo text-white" : "bg-[var(--surface-2)] text-content")}>
              {m.body}
              <div className={cn("mt-0.5 text-[10px]", m.direction === "outbound" ? "text-white/70" : "text-content-soft")}>{format(new Date(m.createdAt), "MMM d, h:mm a")}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-hairline p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && text.trim() && send.mutate()} placeholder="Type a message, simulated SMS..." className="flex-1 rounded-full border border-hairline bg-[var(--surface-2)] px-4 py-2 text-[13px] outline-none focus:ring-2 focus:ring-sage" />
        <Button size="icon" onClick={() => text.trim() && send.mutate()} disabled={send.isPending}><Send className="h-4 w-4" /></Button>
      </div>
    </>
  );
}
