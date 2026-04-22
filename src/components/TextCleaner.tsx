import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cleanText, ZERO_WIDTH_REGEX } from "@/lib/textClean";
import { Copy, Eraser, FileText, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const TextCleaner = () => {
  const [input, setInput] = useState("");
  const [phrases, setPhrases] = useState(true);
  const [invisible, setInvisible] = useState(true);
  const [tidy, setTidy] = useState(true);

  const result = useMemo(
    () => cleanText(input, { phrases, invisible, tidy }),
    [input, phrases, invisible, tidy]
  );

  const invisibleCount = useMemo(() => (input.match(ZERO_WIDTH_REGEX) || []).length, [input]);

  const highlighted = useMemo(() => {
    const parts: { t: string; hidden: boolean }[] = [];
    let buf = "";
    for (const ch of input) {
      if (ZERO_WIDTH_REGEX.test(ch)) {
        ZERO_WIDTH_REGEX.lastIndex = 0;
        if (buf) { parts.push({ t: buf, hidden: false }); buf = ""; }
        parts.push({ t: "·", hidden: true });
      } else {
        buf += ch;
      }
      ZERO_WIDTH_REGEX.lastIndex = 0;
    }
    if (buf) parts.push({ t: buf, hidden: false });
    return parts;
  }, [input]);

  const copy = async () => {
    await navigator.clipboard.writeText(result.cleaned);
    toast({ title: "Copied", description: "Cleaned text on your clipboard." });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl bg-panel shadow-panel p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Input
          </h3>
          <Button size="sm" variant="ghost" onClick={() => setInput("")}>
            <Eraser className="h-4 w-4" /> Clear
          </Button>
        </div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste AI-generated text here. We'll strip filler phrases and invisible watermark characters."
          className="min-h-[280px] bg-background/40 font-mono text-sm"
        />

        <div className="grid gap-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <Label htmlFor="phrases" className="text-xs">Strip AI filler phrases</Label>
            <Switch id="phrases" checked={phrases} onCheckedChange={setPhrases} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="invisible" className="text-xs">Remove invisible characters</Label>
            <Switch id="invisible" checked={invisible} onCheckedChange={setInvisible} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="tidy" className="text-xs">Normalize whitespace</Label>
            <Switch id="tidy" checked={tidy} onCheckedChange={setTidy} />
          </div>
        </div>

        {invisibleCount > 0 && (
          <div className="rounded-md bg-accent/10 border border-accent/30 p-3 text-xs flex items-start gap-2">
            <Eye className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-foreground">
                {invisibleCount} invisible character{invisibleCount === 1 ? "" : "s"} detected
              </div>
              <div className="text-muted-foreground mt-1 font-mono break-all leading-relaxed">
                {highlighted.map((p, i) =>
                  p.hidden ? <span key={i} className="bg-accent/30 text-accent px-0.5 rounded">{p.t}</span> : <span key={i}>{p.t.length > 60 ? p.t.slice(0, 60) + "…" : p.t}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-panel shadow-panel p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary shadow-glow" /> Cleaned
          </h3>
          <Button size="sm" variant="secondary" onClick={copy} disabled={!result.cleaned}>
            <Copy className="h-4 w-4" /> Copy
          </Button>
        </div>
        <Textarea readOnly value={result.cleaned} className="min-h-[280px] bg-background/40 font-mono text-sm" />

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <Stat label="Filler phrases" value={result.removed.phrases} />
          <Stat label="Invisible chars" value={result.removed.zeroWidth} />
          <Stat label="Whitespace trimmed" value={result.removed.extraSpaces} />
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-md bg-background/40 border border-border p-2 text-center">
    <div className="font-display text-lg font-bold text-primary">{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);
