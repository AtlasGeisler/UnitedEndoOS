import { useRef, useState, useEffect } from "react";
import { Eraser } from "lucide-react";

// A canvas e-signature pad. Captures the drawn signature as a PNG data URL.
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const moveDraw = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk) onChange(canvasRef.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={360}
        height={120}
        onPointerDown={start}
        onPointerMove={moveDraw}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full touch-none rounded-lg border border-hairline bg-white"
        style={{ cursor: "crosshair" }}
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-content-soft">
        <span>{hasInk ? "Signature captured" : "Sign above"}</span>
        <button onClick={clear} className="flex items-center gap-1 hover:text-content"><Eraser className="h-3 w-3" /> Clear</button>
      </div>
    </div>
  );
}
