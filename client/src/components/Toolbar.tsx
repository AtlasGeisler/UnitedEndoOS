import { Search, Camera, Moon, Sun, ChevronDown, LogOut, PanelRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Clinic {
  id: number;
  name: string;
  shortName: string;
}

// The slim macOS window toolbar: traffic lights at left, the active clinic and
// context in the center, global actions at right.
export function Toolbar({
  title,
  onOpenPalette,
  onToggleInspector,
}: {
  title: string;
  onOpenPalette: () => void;
  onToggleInspector: () => void;
}) {
  const { mode, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { data } = useQuery<{ clinics: Clinic[] }>({ queryKey: ["/api/clinics"] });
  const clinics = data?.clinics ?? [];
  const [activeClinic, setActiveClinic] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clinicOpen, setClinicOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeClinic == null && clinics.length) setActiveClinic(clinics[0].id);
  }, [clinics, activeClinic]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setClinicOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = clinics.find((c) => c.id === activeClinic);

  return (
    <header className="glass relative z-20 flex h-12 shrink-0 items-center border-b border-hairline px-3">
      <div className="flex items-center gap-2" aria-hidden>
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>

      <div className="ml-4 flex items-center gap-2" ref={menuRef}>
        <div className="relative">
          <button
            onClick={() => setClinicOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium hover:bg-[var(--surface-2)]"
          >
            <span className="h-2 w-2 rounded-full bg-endo" />
            {current?.shortName ?? "All Clinics"}
            <ChevronDown className="h-3.5 w-3.5 text-content-soft" />
          </button>
          {clinicOpen && (
            <div className="absolute left-0 top-9 w-56 rounded-lg border border-hairline bg-surface p-1 shadow-panel">
              {clinics.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveClinic(c.id);
                    setClinicOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--surface-2)]",
                    c.id === activeClinic && "text-endo",
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-endo/60" />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-content-soft">/</span>
        <span className="text-[13px] font-semibold">{title}</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-1 text-[12px] text-content-soft hover:text-content"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="rounded bg-[var(--surface-2)] px-1 text-[10px]">⌘K</kbd>
        </button>
        <Button variant="ghost" size="icon" title="Capture (Cmd+Shift+C)">
          <Camera className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleInspector} title="Inspector (Cmd+I)">
          <PanelRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
          {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-parchment"
            title={user?.fullName}
          >
            {initials(user?.fullName)}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-56 rounded-lg border border-hairline bg-surface p-1 shadow-panel">
              <div className="px-2 py-1.5">
                <div className="text-[13px] font-medium">{user?.fullName}</div>
                <div className="text-[11px] text-content-soft">
                  {user ? ROLE_LABELS[user.role] : ""}
                </div>
              </div>
              <div className="my-1 h-px bg-hairline" />
              <button
                onClick={() => logout()}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-urgent hover:bg-[var(--surface-2)]"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function initials(name?: string) {
  if (!name) return "UE";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
