import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

interface Body {
  image: string;
  mask: string;
  prompt?: string;
}

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
const MAX_PROMPT = 500;
const DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // --- Auth check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json(401, { error: "Unauthorized" });
    }

    // --- Size check ---
    const raw = await req.arrayBuffer();
    if (raw.byteLength > MAX_BYTES) {
      return json(413, { error: "Payload too large" });
    }

    let body: Body;
    try {
      body = JSON.parse(new TextDecoder().decode(raw)) as Body;
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const { image, mask, prompt } = body;

    // --- Input validation ---
    if (!image || !mask) {
      return json(400, { error: "image and mask required" });
    }
    if (typeof image !== "string" || typeof mask !== "string" || !DATA_URL_RE.test(image) || !DATA_URL_RE.test(mask)) {
      return json(400, { error: "image and mask must be base64 image data URLs" });
    }
    if (prompt !== undefined && (typeof prompt !== "string" || prompt.length > MAX_PROMPT)) {
      return json(400, { error: `prompt must be a string up to ${MAX_PROMPT} characters` });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return json(500, { error: "Server configuration error" });
    }

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
        return json(429, { error: "Rate limit hit. Please wait a moment and try again." });
      }
      if (response.status === 402) {
        return json(402, { error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." });
      }
      return json(500, { error: "AI gateway failed" });
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
      return json(500, { error: "No image returned from AI" });
    }

    return json(200, { image: out });
  } catch (e) {
    console.error("inpaint-image error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
