import { Command } from "cmdk";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { MODULES } from "@/modules";
import { useTheme } from "@/lib/theme";
import { Moon, ArrowRight, Keyboard } from "lucide-react";

// The Cmd+K command palette, the app's front door. In Phase 0 it jumps to any
// module and toggles the theme. Later phases register patients, images, and
// actions into the same palette.
export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const { toggle } = useTheme();
  if (!open) return null;

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[14vh]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.97, opacity: 0, y: -8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] overflow-hidden rounded-xl border border-hairline bg-surface shadow-panel"
      >
        <Command label="Command palette">
          <Command.Input
            autoFocus
            placeholder="Jump to a module, patient, or action..."
            className="w-full border-b border-hairline bg-transparent px-4 py-3.5 text-[14px] outline-none placeholder:text-content-soft"
          />
          <Command.List className="max-h-[340px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-[13px] text-content-soft">
              No results.
            </Command.Empty>
            <Command.Group
              heading="Modules"
              className="px-1 text-[10px] font-semibold uppercase tracking-wider text-content-soft [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
            >
              {MODULES.map((m) => {
                const Icon = m.icon;
                return (
                  <Command.Item
                    key={m.key}
                    value={m.label}
                    onSelect={() => go(m.path)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] text-content data-[selected=true]:bg-endo/12 data-[selected=true]:text-endo"
                  >
                    <Icon className="h-4 w-4" />
                    {m.label}
                    <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-0 data-[selected=true]:opacity-100" />
                  </Command.Item>
                );
              })}
            </Command.Group>
            <Command.Group
              heading="Actions"
              className="px-1 text-[10px] font-semibold uppercase tracking-wider text-content-soft [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
            >
              <Command.Item
                value="Toggle theme dark light"
                onSelect={() => {
                  toggle();
                  onClose();
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] text-content data-[selected=true]:bg-endo/12 data-[selected=true]:text-endo"
              >
                <Moon className="h-4 w-4" /> Toggle light and dark mode
              </Command.Item>
              <Command.Item
                value="Keyboard shortcuts help"
                onSelect={() => go("/shortcuts")}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] text-content data-[selected=true]:bg-endo/12 data-[selected=true]:text-endo"
              >
                <Keyboard className="h-4 w-4" /> Keyboard shortcuts
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </motion.div>
    </div>
  );
}
