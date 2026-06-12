import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { Info, X, ArrowRight, Maximize2, User, Image as ImageIcon, CalendarDays } from "lucide-react";
import { useSelection } from "@/lib/selection";
import { useQuickLook } from "@/components/QuickLook";

// The right-hand Inspector, the contextual Info panel. It reflects the shared
// selection: pick a patient, image, or appointment anywhere in the app and its
// details land here, with a thumbnail, fields, and quick actions.
const KIND_ICON = {
  patient: User,
  image: ImageIcon,
  appointment: CalendarDays,
  visit: CalendarDays,
} as const;

const KIND_LABEL = {
  patient: "Patient",
  image: "Image",
  appointment: "Appointment",
  visit: "Visit",
} as const;

export function Inspector({ open }: { open: boolean }) {
  const { selection, clear } = useSelection();
  const { open: openLightbox } = useQuickLook();
  const [, navigate] = useLocation();

  const KindIcon = selection ? KIND_ICON[selection.kind] : Info;

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
              <KindIcon className="h-4 w-4 text-content-soft" />
              {selection ? KIND_LABEL[selection.kind] : "Inspector"}
              {selection && (
                <button
                  onClick={clear}
                  title="Clear selection"
                  className="ml-auto rounded-md p-1 text-content-soft hover:bg-[var(--surface-2)] hover:text-content"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {!selection ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="text-[13px] text-content-soft">
                  Select an image, appointment, or patient to see details here.
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
                {/* Thumbnail, when the selection has a preview. */}
                {selection.thumbAssetId != null && (
                  <div className="mb-3 overflow-hidden rounded-card border border-hairline bg-clay-900">
                    <img
                      src={`/api/images/${selection.thumbAssetId}`}
                      alt={selection.title}
                      className={
                        selection.kind === "image"
                          ? "aspect-[4/3] w-full object-contain"
                          : "aspect-[4/3] w-full object-cover"
                      }
                    />
                  </div>
                )}

                <div className="font-serif text-[16px] font-semibold leading-snug">
                  {selection.title}
                </div>
                {selection.subtitle && (
                  <div className="mt-0.5 text-[12px] text-content-soft">
                    {selection.subtitle}
                  </div>
                )}

                {/* Fields */}
                <dl className="mt-3 space-y-1.5">
                  {selection.fields.map((f, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-[12px]">
                      <dt className="w-24 shrink-0 text-content-soft">{f.label}</dt>
                      <dd className="min-w-0 flex-1 break-words font-medium">{f.value}</dd>
                    </div>
                  ))}
                </dl>

                {/* Actions */}
                <div className="mt-4 flex flex-col gap-2">
                  {selection.lightbox && (
                    <button
                      onClick={() =>
                        openLightbox(selection.lightbox!.items, selection.lightbox!.index)
                      }
                      className="flex items-center justify-center gap-1.5 rounded-md bg-endo px-3 py-1.5 text-[12px] font-medium text-white hover:bg-endo/90"
                    >
                      <Maximize2 className="h-3.5 w-3.5" /> Open in viewer
                    </button>
                  )}
                  {selection.href && (
                    <button
                      onClick={() => navigate(selection.href!)}
                      className="flex items-center justify-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-[12px] font-medium text-content hover:border-endo hover:text-endo"
                    >
                      {selection.hrefLabel ?? "Open"} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
