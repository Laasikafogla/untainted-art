import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { Logo } from "@/components/Logo";
import { ImageEditor } from "@/components/ImageEditor";
import { TextCleaner } from "@/components/TextCleaner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon, Type, LogIn, LogOut, Lock } from "lucide-react";

type Tab = "image" | "text";

const tabs: { id: Tab; label: string; icon: typeof ImageIcon; desc: string }[] = [
  { id: "image", label: "Image", icon: ImageIcon, desc: "Brush + AI inpaint" },
  { id: "text", label: "Text", icon: Type, desc: "Phrases + invisible chars" },
];

const Index = () => {
  const [tab, setTab] = useState<Tab>("image");
  const [session, setSession] = useState<Session | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-toolbar flex items-center px-4 gap-4 shrink-0">
        <Logo />
        <div className="hidden md:block text-xs text-muted-foreground border-l border-border pl-4">
          AI watermark remover · images, text & invisible markers
        </div>
        <div className="ml-auto flex items-center gap-3">
          {session ? (
            <>
              <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[180px]">
                {session.user.email}
              </span>
              <Button size="sm" variant="ghost" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => nav("/auth")}>
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          )}
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
          {tab === "image" ? (
            session ? (
              <ImageEditor />
            ) : (
              <div className="grid place-items-center h-full">
                <div className="rounded-xl bg-panel shadow-panel p-8 max-w-md text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full gradient-primary grid place-items-center">
                    <Lock className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h2 className="font-display text-lg font-bold">Sign in to use AI image cleanup</h2>
                  <p className="text-xs text-muted-foreground">
                    AI inpainting uses credits, so we require an account. Text cleaning works without signing in.
                  </p>
                  <Button asChild className="gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
                    <Link to="/auth"><LogIn className="h-4 w-4" /> Sign in or create account</Link>
                  </Button>
                </div>
              </div>
            )
          ) : (
            <TextCleaner />
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
