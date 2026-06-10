import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

// Empty states are invitations with one clear next step, never sad
// illustrations. Each module renders this until its phase fills it in.
export function PlaceholderPage({
  icon: Icon,
  title,
  blurb,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  blurb: string;
  phase: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hairline px-7 py-4">
        <h1 className="text-[18px] font-semibold">{title}</h1>
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="max-w-md rounded-card border border-hairline bg-surface p-8 text-center shadow-card"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-endo/12 text-endo">
            <Icon className="h-6 w-6" />
          </div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-content-soft">
            {blurb}
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-content-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-caution" />
            Arrives in {phase}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
