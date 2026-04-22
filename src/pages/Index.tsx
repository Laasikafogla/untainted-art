import { useState } from "react";
import { Logo } from "@/components/Logo";
import { ImageEditor } from "@/components/ImageEditor";
import { TextCleaner } from "@/components/TextCleaner";
import { ImageIcon, Type, Github } from "lucide-react";

type Tab = "image" | "text";

const tabs: { id: Tab; label: string; icon: typeof ImageIcon; desc: string }[] = [
  { id: "image", label: "Image", icon: ImageIcon, desc: "Brush + AI inpaint" },
  { id: "text", label: "Text", icon: Type, desc: "Phrases + invisible chars" },
];

const Index = () => {
  const [tab, setTab] = useState<Tab>("image");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-toolbar flex items-center px-4 gap-4 shrink-0">
        <Logo />
        <div className="hidden md:block text-xs text-muted-foreground border-l border-border pl-4">
          AI watermark remover · images, text & invisible markers
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a
            href="https://docs.lovable.dev/features/cloud"
            target="_blank" rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            <Github className="h-4 w-4 inline mr-1" /> Docs
          </a>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border bg-panel/60 p-3 flex flex-col gap-1 shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-2">
            Tools
          </div>
          {tabs.map(({ id, label, icon: Icon, desc }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`group flex items-start gap-3 rounded-lg p-3 text-left transition border ${
                  active
                    ? "bg-secondary border-border shadow-panel"
                    : "border-transparent hover:bg-secondary/60"
                }`}
              >
                <div className={`h-8 w-8 rounded-md grid place-items-center ${active ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground group-hover:text-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold leading-tight">{label}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{desc}</div>
                </div>
              </button>
            );
          })}

          <div className="mt-auto rounded-lg border border-border bg-background/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
            <div className="font-display text-foreground text-xs mb-1">How it works</div>
            Images use AI inpainting on the area you brush. Text removes filler patterns and zero-width characters used as invisible watermarks.
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 lg:p-6 bg-canvas overflow-auto">
          <h1 className="sr-only">AI Watermark Remover — images, text and invisible markers</h1>
          {tab === "image" ? <ImageEditor /> : <TextCleaner />}
        </main>
      </div>
    </div>
  );
};

export default Index;
