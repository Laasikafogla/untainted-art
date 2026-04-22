import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface Body {
  image: string; // data URL
  mask: string;  // data URL (white = remove)
  prompt?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { image, mask, prompt } = (await req.json()) as Body;
    if (!image || !mask) {
      return new Response(JSON.stringify({ error: "image and mask required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const instruction =
      (prompt?.trim() || "Remove the watermark, logo, signature, or text overlay highlighted by the magenta mask in the second image. Reconstruct the area underneath so it seamlessly matches the surrounding texture, lighting, and content of the first image. Output a clean, watermark-free version of the original image at the same resolution.");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: image } },
              { type: "image_url", image_url: { url: mask } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit hit. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "AI gateway failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    console.log("AI gateway response keys:", Object.keys(data?.choices?.[0]?.message ?? {}));
    const msg = data.choices?.[0]?.message;
    const out =
      msg?.images?.[0]?.image_url?.url ||
      msg?.images?.[0]?.url ||
      (typeof msg?.content === "string" ? null : msg?.content?.find?.((c: any) => c.type === "image_url")?.image_url?.url);
    if (!out) {
      console.error("No image in response:", JSON.stringify(data).slice(0, 1000));
      return new Response(JSON.stringify({ error: "No image returned from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ image: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inpaint-image error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
