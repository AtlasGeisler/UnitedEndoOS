import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { Inspector } from "./Inspector";
import { CommandPalette } from "./CommandPalette";
import { MODULES } from "@/modules";

// The app frame. Holds the global keyboard map (Cmd+K palette, Cmd+I inspector,
// Cmd+1..9 module switch, Esc to close panels) and arranges the macOS layout.
export function AppShell({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const active = MODULES.find((m) =>
    m.path === "/" ? location === "/" : location.startsWith(m.path),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (meta && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setInspectorOpen((v) => !v);
        return;
      }
      if (meta && /^[1-9]$/.test(e.key)) {
        const target = MODULES.find((m) => m.hotkey === Number(e.key));
        if (target) {
          e.preventDefault();
          navigate(target.path);
        }
        return;
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-content">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar
          title={active?.label ?? "UnitedEndoOS"}
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleInspector={() => setInspectorOpen((v) => !v)}
        />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
          <Inspector open={inspectorOpen} />
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
