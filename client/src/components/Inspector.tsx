import { AnimatePresence, motion } from "framer-motion";
import { Info } from "lucide-react";

// The right-hand Inspector, the contextual Info panel. In Phase 0 it is a
// skeleton that later views fill with details about the selected image,
// appointment, or patient.
export function Inspector({ open }: { open: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="glass shrink-0 overflow-hidden border-l border-hairline"
        >
          <div className="flex h-full w-[280px] flex-col">
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-3 text-[13px] font-semibold">
              <Info className="h-4 w-4 text-content-soft" />
              Inspector
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="text-[13px] text-content-soft">
                Select an image, appointment, or patient to see details here.
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
