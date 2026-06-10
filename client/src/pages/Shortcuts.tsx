import { Keyboard } from "lucide-react";

// The keyboard map sheet. Documents the app's shortcuts for power users.
const GROUPS: { title: string; keys: [string, string][] }[] = [
  { title: "Navigation", keys: [["⌘K", "Command palette"], ["⌘1 to ⌘9", "Switch modules"], ["⌘I", "Toggle the Inspector"], ["Esc", "Close panels"]] },
  { title: "Images and Quick Look", keys: [["Space", "Quick Look on a focused image"], ["J, K", "Previous, next image"], ["+, -", "Zoom in, out"], ["0", "Reset the view"]] },
  { title: "Capture", keys: [["⌘⇧C", "Open the capture sheet"], ["Drag and drop", "Import an image onto a chart"]] },
];

export function Shortcuts() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-hairline px-7 py-4">
        <h1 className="flex items-center gap-2 text-[18px] font-semibold"><Keyboard className="h-5 w-5 text-endo" /> Keyboard shortcuts</h1>
      </div>
      <div className="grid gap-5 p-6 md:grid-cols-3">
        {GROUPS.map((g) => (
          <div key={g.title} className="rounded-card border border-hairline bg-surface p-4 shadow-card">
            <div className="mb-3 text-[13px] font-semibold">{g.title}</div>
            {g.keys.map(([k, label]) => (
              <div key={k} className="flex items-center justify-between border-b border-hairline py-2 text-[13px] last:border-0">
                <span className="text-content-soft">{label}</span>
                <kbd className="rounded-md border border-hairline bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium">{k}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
