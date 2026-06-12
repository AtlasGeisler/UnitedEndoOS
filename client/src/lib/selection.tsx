import { createContext, useContext, useState, useCallback } from "react";
import { format } from "date-fns";
import type { LightItem } from "@/components/QuickLook";
import type { StudyRow } from "@/lib/clinical-types";

// The shared selection. Clicking a patient, image, or appointment anywhere in
// the app sets this, and the right-hand Inspector renders its details. Payloads
// carry the data already in hand at the click site, so the Inspector needs no
// extra fetch and never goes stale against a separate request.
export interface InspectorField {
  label: string;
  value: string;
}

export interface Selection {
  kind: "patient" | "image" | "appointment" | "visit";
  title: string;
  subtitle?: string;
  alert?: string;
  fields: InspectorField[];
  thumbAssetId?: number | null;
  href?: string;
  hrefLabel?: string;
  // For images, the lightbox set to open in the full viewer.
  lightbox?: { items: LightItem[]; index: number };
}

interface SelectionCtx {
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;
  clear: () => void;
}

const Ctx = createContext<SelectionCtx | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelectionState] = useState<Selection | null>(null);
  const setSelection = useCallback((s: Selection | null) => setSelectionState(s), []);
  const clear = useCallback(() => setSelectionState(null), []);
  return (
    <Ctx.Provider value={{ selection, setSelection, clear }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSelection() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSelection must be used within SelectionProvider");
  return ctx;
}

const IMG_TYPE_LABEL: Record<string, string> = {
  periapical: "Periapical",
  bitewing: "Bitewing",
  panoramic: "Panoramic",
  cbct: "CBCT",
  intraoral_photo: "Intraoral photo",
};

// Build an image selection from a radiographic study, including the lightbox
// payload so the Inspector's "Open in viewer" reuses the QuickLook viewer.
export function studyToSelection(s: StudyRow): Selection {
  const typeLabel = IMG_TYPE_LABEL[s.type] ?? s.type;
  const captured = format(new Date(s.capturedAt), "MMM d, yyyy");
  const fields: InspectorField[] = [
    { label: "Type", value: typeLabel },
    { label: "Captured", value: captured },
  ];
  if (s.bodySite) fields.push({ label: "Site", value: s.bodySite });
  if (s.toothNumbers?.length) fields.push({ label: "Tooth", value: s.toothNumbers.join(", ") });
  if (s.deviceLabel) fields.push({ label: "Device", value: s.deviceLabel });
  fields.push({ label: "Status", value: s.status });
  return {
    kind: "image",
    title: `${typeLabel}${s.bodySite ? `, ${s.bodySite}` : ""}`,
    subtitle: format(new Date(s.capturedAt), "EEEE, MMM d, yyyy"),
    thumbAssetId: s.thumbAssetId,
    fields,
    lightbox: {
      items: [
        {
          originalAssetId: s.originalAssetId,
          thumbAssetId: s.thumbAssetId,
          label: typeLabel,
          sublabel: captured,
        },
      ],
      index: 0,
    },
  };
}
