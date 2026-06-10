import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, ZoomIn, ZoomOut, RotateCw, FlipHorizontal2, Contrast, Sun,
  Aperture, RefreshCw, ChevronLeft, ChevronRight, Columns2, Ruler,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

// A macOS-style instant lightbox. Space opens it on the focused image. It
// supports zoom, pan, rotate, flip, window-level brightness and contrast, and
// invert, steps through a set with J and K, compares two images side by side or
// with an opacity swipe, and measures a calibrated length saved as overlay
// geometry. Originals are never mutated, annotations live as overlays.
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
type Pt = { x: number; y: number };

export function QuickLookProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<LightItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [t, setT] = useState({ ...DEFAULTS });
  const [compare, setCompare] = useState<"off" | "side" | "overlay">("off");
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [measure, setMeasure] = useState(false);
  const [pts, setPts] = useState<Pt[]>([]);
  const [mm, setMm] = useState("");
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const imgWrap = useRef<HTMLDivElement>(null);

  const reset = () => { setT({ ...DEFAULTS }); setPts([]); setMm(""); };
  const open = useCallback((list: LightItem[], i: number) => {
    setItems(list); setIndex(i); setCompare("off"); setMeasure(false);
    setT({ ...DEFAULTS }); setPts([]); setMm("");
  }, []);
  const close = useCallback(() => setItems(null), []);

  const step = useCallback((d: number) => {
    setItems((cur) => {
      if (!cur) return cur;
      setIndex((i) => (i + d + cur.length) % cur.length);
      setT({ ...DEFAULTS }); setPts([]); setMm("");
      return cur;
    });
  }, []);

  useEffect(() => {
    if (!items) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (measure) setMeasure(false); else close(); }
      else if (e.key === "ArrowRight" || e.key.toLowerCase() === "k") step(1);
      else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "j") step(-1);
      else if (e.key === "0") reset();
      else if (e.key === "+" || e.key === "=") setT((p) => ({ ...p, zoom: Math.min(6, p.zoom + 0.25) }));
      else if (e.key === "-") setT((p) => ({ ...p, zoom: Math.max(1, p.zoom - 0.25) }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, step, close, measure]);

  const current = items?.[index];
  const other = items && items.length > 1 ? items[index > 0 ? index - 1 : 1] : null;
  const filter = `brightness(${t.brightness}%) contrast(${t.contrast}%) invert(${t.invert})`;
  const transform = `translate(${t.x}px, ${t.y}px) scale(${t.zoom}) rotate(${t.rotate}deg) scaleX(${t.flip})`;

  const onMeasureClick = (e: React.MouseEvent) => {
    if (!measure || !imgWrap.current) return;
    const r = imgWrap.current.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    setPts((cur) => (cur.length >= 2 ? [p] : [...cur, p]));
  };

  const saveMeasurement = async () => {
    if (pts.length < 2 || !current?.originalAssetId) return;
    const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
    const fracLen = Math.hypot(dx, dy);
    await apiRequest("POST", `/api/assets/${current.originalAssetId}/annotations`, {
      type: "length_measurement",
      geometryJson: { points: pts },
      label: mm ? `${mm} mm` : "length",
      calibrationMmPerPx: mm ? Number(mm) / fracLen : null,
    });
    setMeasure(false);
  };

  const img = (item: LightItem | null, opacity = 1) =>
    item?.originalAssetId != null ? (
      <img src={`/api/images/${item.originalAssetId}`} alt={item.label} draggable={false}
        className="max-h-full max-w-full select-none" style={{ transform, filter, opacity, transition: drag.current ? "none" : "transform 0.12s" }} />
    ) : <div className="text-white/60">No image</div>;

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      <AnimatePresence>
        {items && current && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col bg-black/85 backdrop-blur-sm">
            {/* Top bar */}
            <div className="flex items-center gap-3 px-4 py-3 text-white">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium">{current.label}</div>
                {current.sublabel && <div className="truncate text-[12px] text-white/60">{current.sublabel}</div>}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {other && (
                  <button onClick={() => setCompare((c) => (c === "off" ? "side" : c === "side" ? "overlay" : "off"))}
                    className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] ${compare !== "off" ? "bg-endo text-white" : "text-white/80 hover:bg-white/10"}`}>
                    <Columns2 className="h-4 w-4" /> {compare === "off" ? "Compare" : compare === "side" ? "Side by side" : "Overlay"}
                  </button>
                )}
                <button onClick={() => { setMeasure((m) => !m); setPts([]); }}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] ${measure ? "bg-endo text-white" : "text-white/80 hover:bg-white/10"}`}>
                  <Ruler className="h-4 w-4" /> Measure
                </button>
                <span className="text-[12px] text-white/60 tnum">{index + 1} of {items.length}</span>
                <button onClick={close} className="rounded-md p-1.5 hover:bg-white/10"><X className="h-5 w-5" /></button>
              </div>
            </div>

            {/* Stage */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden"
              onClick={(e) => { if (e.target === e.currentTarget && !measure) close(); }}
              onWheel={(e) => setT((p) => ({ ...p, zoom: Math.min(6, Math.max(1, p.zoom - e.deltaY * 0.002)) }))}
              onMouseDown={(e) => { if (!measure && compare === "off") drag.current = { x: e.clientX, y: e.clientY, ox: t.x, oy: t.y }; }}
              onMouseMove={(e) => { if (drag.current) setT((p) => ({ ...p, x: drag.current!.ox + (e.clientX - drag.current!.x), y: drag.current!.oy + (e.clientY - drag.current!.y) })); }}
              onMouseUp={() => (drag.current = null)} onMouseLeave={() => (drag.current = null)}>
              {compare === "off" && <button onClick={() => step(-1)} className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronLeft className="h-5 w-5" /></button>}

              {compare === "side" ? (
                <div className="flex h-full w-full items-center justify-center gap-2 px-3">
                  <div className="flex h-full flex-1 items-center justify-center overflow-hidden">{img(other)}</div>
                  <div className="h-full w-px bg-white/20" />
                  <div className="flex h-full flex-1 items-center justify-center overflow-hidden">{img(current)}</div>
                </div>
              ) : (
                <div ref={imgWrap} className="relative flex items-center justify-center" onClick={onMeasureClick} style={{ cursor: measure ? "crosshair" : t.zoom > 1 ? "grab" : "default" }}>
                  {compare === "overlay" && other && <div className="absolute inset-0 flex items-center justify-center">{img(other)}</div>}
                  {compare === "overlay" ? img(current, overlayOpacity / 100) : img(current)}
                  {/* Measurement overlay */}
                  {pts.length > 0 && (
                    <svg className="pointer-events-none absolute inset-0 h-full w-full">
                      {pts.map((p, i) => <circle key={i} cx={`${p.x * 100}%`} cy={`${p.y * 100}%`} r="4" fill="#7CB68A" />)}
                      {pts.length === 2 && <line x1={`${pts[0].x * 100}%`} y1={`${pts[0].y * 100}%`} x2={`${pts[1].x * 100}%`} y2={`${pts[1].y * 100}%`} stroke="#7CB68A" strokeWidth="2" />}
                    </svg>
                  )}
                </div>
              )}

              {compare === "off" && <button onClick={() => step(1)} className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronRight className="h-5 w-5" /></button>}
            </div>

            {/* Measurement bar */}
            {measure && (
              <div className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-2 text-[12px] text-white">
                <span className="text-white/70">{pts.length < 2 ? "Click two points to measure" : "Set the real length"}</span>
                {pts.length === 2 && (
                  <>
                    <input value={mm} onChange={(e) => setMm(e.target.value)} placeholder="mm" className="w-20 rounded-md bg-white/10 px-2 py-1 text-white outline-none" />
                    <button onClick={saveMeasurement} className="rounded-md bg-endo px-3 py-1 font-medium text-white">Save measurement</button>
                  </>
                )}
              </div>
            )}

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
              {compare === "overlay" && <Slider icon={Columns2} value={overlayOpacity} min={0} max={100} onChange={setOverlayOpacity} />}
              <Tool icon={RefreshCw} onClick={reset} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

function Tool({ icon: Icon, onClick, active }: { icon: typeof ZoomIn; onClick: () => void; active?: boolean }) {
  return <button onClick={onClick} className={`rounded-md p-2 hover:bg-white/15 ${active ? "bg-endo text-white" : "text-white/80"}`}><Icon className="h-4 w-4" /></button>;
}

function Slider({ icon: Icon, value, min, max, onChange }: { icon: typeof Sun; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-white/80">
      <Icon className="h-4 w-4" />
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 w-20 cursor-pointer accent-endo" />
    </div>
  );
}

export function useQuickLook() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useQuickLook must be used within QuickLookProvider");
  return ctx;
}
