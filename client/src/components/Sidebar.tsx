import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { MODULES, SECTION_ORDER } from "@/modules";
import { cn } from "@/lib/utils";

// A macOS source list: translucent, small-caps section headers, lucide glyphs,
// and a soft endo-tinted pill behind the active row.
export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="glass flex w-[228px] shrink-0 flex-col border-r border-hairline">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-endo text-[13px] font-bold text-white">
          UE
        </div>
        <div className="leading-tight">
          <div className="font-serif text-[15px] font-semibold">UnitedEndoOS</div>
          <div className="text-[10px] uppercase tracking-wide text-content-soft">
            Endodontic EDR
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {SECTION_ORDER.map((section) => {
          const items = MODULES.filter((m) => m.section === section);
          if (!items.length) return null;
          return (
            <div key={section} className="mb-3">
              <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-content-soft">
                {section}
              </div>
              {items.map((m) => {
                const active =
                  m.path === "/"
                    ? location === "/"
                    : location.startsWith(m.path);
                const Icon = m.icon;
                return (
                  <Link key={m.key} href={m.path}>
                    <div
                      className={cn(
                        "relative flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px]",
                        active ? "text-endo" : "text-content hover:bg-[var(--surface-2)]",
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="sidebar-pill"
                          className="absolute inset-0 rounded-md bg-endo/12"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <Icon className="relative h-4 w-4 shrink-0" />
                      <span className="relative truncate">{m.label}</span>
                      {m.hotkey && (
                        <kbd className="relative ml-auto text-[10px] text-content-soft opacity-0 group-hover:opacity-100">
                          ⌘{m.hotkey}
                        </kbd>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
