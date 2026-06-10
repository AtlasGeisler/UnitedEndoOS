import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, ZoomIn, ZoomOut, RotateCw, FlipHorizontal2, Contrast, Sun,
  Aperture, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";

// A macOS-style instant lightbox. Space opens it on the focused image, and it
// supports zoom, pan, rotate, flip, window-level style brightness and contrast,
// invert, and stepping through a set with J and K or the arrow keys.
export interface LightItem {
  originalAssetId: number | null;
  thumbAssetId: number | null;
  label: string;
  sublabel?: string;
}

interface QuickLookCtx {
  open: (items: LightItem[], index: number) => void;
  close: () => void;
}
const Ctx = createContext<QuickLookCtx | null>(null);

const DEFAULTS = { zoom: 1, x: 0, y: 0, rotate: 0, flip: 1, brightness: 100, contrast: 100, invert: 0 };

export function QuickLookProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<LightItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [t, setT] = useState({ ...DEFAULTS });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const open = useCallback((list: LightItem[], i: number) => {
    setItems(list);
    setIndex(i);
    setT({ ...DEFAULTS });
  }, []);
  const close = useCallback(() => setItems(null), []);

  const step = useCallback(
    (d: number) => {
      setItems((cur) => {
        if (!cur) return cur;
        setIndex((i) => (i + d + cur.length) % cur.length);
        setT({ ...DEFAULTS });
        return cur;
      });
    },
    [],
  );

  useEffect(() => {
    if (!items) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key.toLowerCase() === "k") step(1);
      else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "j") step(-1);
      else if (e.key === "0") setT({ ...DEFAULTS });
      else if (e.key === "+" || e.key === "=") setT((p) => ({ ...p, zoom: Math.min(6, p.zoom + 0.25) }));
      else if (e.key === "-") setT((p) => ({ ...p, zoom: Math.max(1, p.zoom - 0.25) }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, step, close]);

  const current = items?.[index];

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      <AnimatePresence>
        {items && current && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col bg-black/85 backdrop-blur-sm"
          >
            {/* Top bar */}
            <div className="flex items-center gap-3 px-4 py-3 text-white">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium">{current.label}</div>
                {current.sublabel && (
                  <div className="truncate text-[12px] text-white/60">{current.sublabel}</div>
                )}
              </div>
              <div className="ml-auto text-[12px] text-white/60 tnum">
                {index + 1} of {items.length}
              </div>
              <button onClick={close} className="rounded-md p-1.5 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stage */}
            <div
              className="relative flex flex-1 items-center justify-center overflow-hidden"
              onClick={(e) => {
                if (e.target === e.currentTarget) close();
              }}
              onWheel={(e) =>
                setT((p) => ({ ...p, zoom: Math.min(6, Math.max(1, p.zoom - e.deltaY * 0.002)) }))
              }
              onMouseDown={(e) => {
                drag.current = { x: e.clientX, y: e.clientY, ox: t.x, oy: t.y };
              }}
              onMouseMove={(e) => {
                if (!drag.current) return;
                setT((p) => ({
                  ...p,
                  x: drag.current!.ox + (e.clientX - drag.current!.x),
                  y: drag.current!.oy + (e.clientY - drag.current!.y),
                }));
              }}
              onMouseUp={() => (drag.current = null)}
              onMouseLeave={() => (drag.current = null)}
            >
              <button
                onClick={() => step(-1)}
                className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {current.originalAssetId != null ? (
                <img
                  src={`/api/images/${current.originalAssetId}`}
                  alt={current.label}
                  draggable={false}
                  className="max-h-full max-w-full select-none"
                  style={{
                    transform: `translate(${t.x}px, ${t.y}px) scale(${t.zoom}) rotate(${t.rotate}deg) scaleX(${t.flip})`,
                    filter: `brightness(${t.brightness}%) contrast(${t.contrast}%) invert(${t.invert})`,
                    transition: drag.current ? "none" : "transform 0.12s ease-out",
                    cursor: t.zoom > 1 ? "grab" : "default",
                  }}
                />
              ) : (
                <div className="text-white/60">No image</div>
              )}
              <button
                onClick={() => step(1)}
                className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-center gap-4 px-4 py-3 text-white">
              <Tool icon={ZoomOut} onClick={() => setT((p) => ({ ...p, zoom: Math.max(1, p.zoom - 0.25) }))} />
              <span className="w-10 text-center text-[12px] tnum">{Math.round(t.zoom * 100)}%</span>
              <Tool icon={ZoomIn} onClick={() => setT((p) => ({ ...p, zoom: Math.min(6, p.zoom + 0.25) }))} />
              <Tool icon={RotateCw} onClick={() => setT((p) => ({ ...p, rotate: p.rotate + 90 }))} />
              <Tool icon={FlipHorizontal2} onClick={() => setT((p) => ({ ...p, flip: p.flip * -1 }))} />
              <Slider icon={Sun} value={t.brightness} min={40} max={180} onChange={(v) => setT((p) => ({ ...p, brightness: v }))} />
              <Slider icon={Contrast} value={t.contrast} min={40} max={220} onChange={(v) => setT((p) => ({ ...p, contrast: v }))} />
              <Tool icon={Aperture} active={t.invert > 0} onClick={() => setT((p) => ({ ...p, invert: p.invert > 0 ? 0 : 1 }))} />
              <Tool icon={RefreshCw} onClick={() => setT({ ...DEFAULTS })} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

function Tool({ icon: Icon, onClick, active }: { icon: typeof ZoomIn; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md p-2 hover:bg-white/15 ${active ? "bg-endo text-white" : "text-white/80"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Slider({ icon: Icon, value, min, max, onChange }: { icon: typeof Sun; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-white/80">
      <Icon className="h-4 w-4" />
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-20 cursor-pointer accent-endo"
      />
    </div>
  );
}

export function useQuickLook() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useQuickLook must be used within QuickLookProvider");
  return ctx;
}
