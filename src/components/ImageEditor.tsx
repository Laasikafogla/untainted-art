import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Brush, Eraser, Undo2, Trash2, Download, Upload, Sparkles,
  Loader2, ImageIcon, Wand2,
} from "lucide-react";

type Mode = "brush" | "erase";
type Stroke = { mode: Mode; size: number; points: { x: number; y: number }[] };

const MAX_DIM = 1536;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export const ImageEditor = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = useState<Mode>("brush");
  const [brush, setBrush] = useState(40);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");

  // Load image
  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Unsupported file", description: "Please upload an image." });
      return;
    }
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    let { naturalWidth: w, naturalHeight: h } = img;
    const ratio = Math.min(1, MAX_DIM / Math.max(w, h));
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/png");
    setImgSrc(dataUrl);
    setNaturalSize({ w, h });
    setStrokes([]);
    setResultSrc(null);
  };

  // Initialize canvases when image loads
  useEffect(() => {
    if (!imgSrc || !naturalSize) return;
    const { w, h } = naturalSize;
    const ic = imageCanvasRef.current!, mc = maskCanvasRef.current!, oc = overlayRef.current!;
    [ic, mc, oc].forEach(c => { c.width = w; c.height = h; });
    loadImage(imgSrc).then(img => {
      ic.getContext("2d")!.drawImage(img, 0, 0, w, h);
    });
    const mctx = mc.getContext("2d")!;
    mctx.fillStyle = "#000";
    mctx.fillRect(0, 0, w, h);
    oc.getContext("2d")!.clearRect(0, 0, w, h);
  }, [imgSrc, naturalSize]);

  // Redraw strokes when changed
  useEffect(() => {
    if (!naturalSize) return;
    const { w, h } = naturalSize;
    const mc = maskCanvasRef.current!, oc = overlayRef.current!;
    const mctx = mc.getContext("2d")!, octx = oc.getContext("2d")!;
    mctx.fillStyle = "#000"; mctx.fillRect(0, 0, w, h);
    octx.clearRect(0, 0, w, h);
    for (const s of strokes) {
      const isErase = s.mode === "erase";
      mctx.globalCompositeOperation = "source-over";
      mctx.strokeStyle = isErase ? "#000" : "#fff";
      mctx.fillStyle = isErase ? "#000" : "#fff";
      mctx.lineWidth = s.size;
      mctx.lineCap = "round"; mctx.lineJoin = "round";
      octx.globalCompositeOperation = isErase ? "destination-out" : "source-over";
      octx.strokeStyle = isErase ? "rgba(0,0,0,1)" : "rgba(236, 72, 153, 0.55)";
      octx.fillStyle = isErase ? "rgba(0,0,0,1)" : "rgba(236, 72, 153, 0.55)";
      octx.lineWidth = s.size;
      octx.lineCap = "round"; octx.lineJoin = "round";
      if (s.points.length === 1) {
        const p = s.points[0];
        mctx.beginPath(); mctx.arc(p.x, p.y, s.size / 2, 0, Math.PI * 2); mctx.fill();
        octx.beginPath(); octx.arc(p.x, p.y, s.size / 2, 0, Math.PI * 2); octx.fill();
      } else {
        mctx.beginPath(); octx.beginPath();
        s.points.forEach((p, i) => {
          if (i === 0) { mctx.moveTo(p.x, p.y); octx.moveTo(p.x, p.y); }
          else { mctx.lineTo(p.x, p.y); octx.lineTo(p.x, p.y); }
        });
        mctx.stroke();
        octx.stroke();
      }
    }
    octx.globalCompositeOperation = "source-over";
  }, [strokes, naturalSize]);

  const getPos = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    const sx = naturalSize!.w / rect.width;
    const sy = naturalSize!.h / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!naturalSize) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrawing(true);
    const p = getPos(e);
    setStrokes(prev => [...prev, { mode, size: brush * (naturalSize.w / overlayRef.current!.getBoundingClientRect().width), points: [p] }]);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing) return;
    const p = getPos(e);
    setStrokes(prev => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (!last) return prev;
      copy[copy.length - 1] = { ...last, points: [...last.points, p] };
      return copy;
    });
  };
  const onPointerUp = () => setDrawing(false);

  const undo = () => setStrokes(s => s.slice(0, -1));
  const clear = () => setStrokes([]);

  const runInpaint = useCallback(async () => {
    if (!imgSrc || !naturalSize) return;
    if (strokes.filter(s => s.mode === "brush").length === 0) {
      toast({ title: "No mask", description: "Brush over the watermark first." });
      return;
    }
    setBusy(true); setResultSrc(null);
    try {
      const image = imageCanvasRef.current!.toDataURL("image/png");
      // Build colored mask (magenta on black) for the model
      const { w, h } = naturalSize;
      const colored = document.createElement("canvas");
      colored.width = w; colored.height = h;
      const cctx = colored.getContext("2d")!;
      cctx.fillStyle = "#000"; cctx.fillRect(0, 0, w, h);
      const m = maskCanvasRef.current!;
      const mdata = m.getContext("2d")!.getImageData(0, 0, w, h);
      const out = cctx.getImageData(0, 0, w, h);
      for (let i = 0; i < mdata.data.length; i += 4) {
        if (mdata.data[i] > 128) {
          out.data[i] = 255; out.data[i+1] = 0; out.data[i+2] = 255; out.data[i+3] = 255;
        } else {
          out.data[i+3] = 255;
        }
      }
      cctx.putImageData(out, 0, 0);
      const mask = colored.toDataURL("image/png");

      const { data, error } = await supabase.functions.invoke("inpaint-image", {
        body: { image, mask, prompt },
      });
      if (error) throw error;
      if (!data?.image) throw new Error("No image returned");
      setResultSrc(data.image as string);
      toast({ title: "Done", description: "Watermark cleaned. Compare and download below." });
    } catch (e: any) {
      const msg = e?.message || "Failed";
      toast({ title: "Cleanup failed", description: msg });
    } finally {
      setBusy(false);
    }
  }, [imgSrc, naturalSize, strokes, prompt]);

  const downloadResult = () => {
    if (!resultSrc) return;
    const a = document.createElement("a");
    a.href = resultSrc; a.download = "unmark-cleaned.png"; a.click();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* Canvas area */}
      <div className="rounded-xl bg-panel shadow-panel p-3 flex flex-col">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-1 pb-3 border-b border-border">
          <Button size="sm" variant={mode === "brush" ? "default" : "secondary"} onClick={() => setMode("brush")}>
            <Brush className="h-4 w-4" /> Brush
          </Button>
          <Button size="sm" variant={mode === "erase" ? "default" : "secondary"} onClick={() => setMode("erase")}>
            <Eraser className="h-4 w-4" /> Erase
          </Button>
          <div className="flex items-center gap-2 px-3">
            <span className="text-xs text-muted-foreground w-10">Size</span>
            <Slider value={[brush]} min={5} max={120} step={1} onValueChange={(v) => setBrush(v[0])} className="w-32" />
            <span className="text-xs font-display w-8 text-right">{brush}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={undo} disabled={!strokes.length}>
            <Undo2 className="h-4 w-4" /> Undo
          </Button>
          <Button size="sm" variant="ghost" onClick={clear} disabled={!strokes.length}>
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> {imgSrc ? "Replace" : "Upload"}
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={wrapRef} className="relative mt-3 flex-1 min-h-[420px] rounded-lg checkerboard overflow-hidden grid place-items-center">
          {!imgSrc ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground transition-colors p-10 border-2 border-dashed border-border rounded-xl"
            >
              <ImageIcon className="h-10 w-10" />
              <div className="font-display text-sm">Drop or upload an image</div>
              <div className="text-xs">PNG, JPG, WEBP — up to {MAX_DIM}px will be processed</div>
            </button>
          ) : (
            <div className="relative max-h-full max-w-full" style={{ aspectRatio: naturalSize ? `${naturalSize.w}/${naturalSize.h}` : "1" }}>
              <canvas ref={imageCanvasRef} className="block max-h-[70vh] w-auto h-auto rounded-md" style={{ maxWidth: "100%" }} />
              <canvas ref={maskCanvasRef} className="hidden" />
              <canvas
                ref={overlayRef}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      <div className="rounded-xl bg-panel shadow-panel p-4 flex flex-col gap-4">
        <div>
          <h3 className="font-display text-sm font-bold flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" /> AI Inpaint
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Brush over the watermark, then run AI cleanup. The model rebuilds whatever should be underneath.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt" className="text-xs">Optional instruction</Label>
          <Input
            id="prompt"
            placeholder="e.g. remove the bottom-right logo"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <Button onClick={runInpaint} disabled={!imgSrc || busy} className="gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Cleaning…</> : <><Sparkles className="h-4 w-4" /> Remove watermark</>}
        </Button>

        <div className="pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2">Result</div>
          <div className="rounded-lg checkerboard min-h-[160px] grid place-items-center overflow-hidden">
            {resultSrc ? (
              <img src={resultSrc} alt="Cleaned result" className="max-h-[260px] w-auto" />
            ) : (
              <div className="text-xs text-muted-foreground p-6 text-center">No result yet</div>
            )}
          </div>
          <Button onClick={downloadResult} disabled={!resultSrc} variant="secondary" className="w-full mt-3">
            <Download className="h-4 w-4" /> Download PNG
          </Button>
        </div>

        <div className="mt-auto text-[11px] text-muted-foreground leading-relaxed">
          Only remove watermarks from content you own or have rights to. Don't use this to bypass attribution required by licenses.
        </div>
      </div>
    </div>
  );
};
