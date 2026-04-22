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

    const userInstruction = prompt?.trim();
    const instruction = userInstruction
      ? `${userInstruction}\n\nThe second image is a magenta mask indicating the exact pixel region to edit. Only modify pixels under the magenta mask; keep everything else identical. Return the edited image at the original resolution.`
      : "You are an image inpainting tool. The first image is the source. The second image is a magenta mask marking a region the user wants reconstructed. Inpaint ONLY the masked region by extending the surrounding texture, color, and lighting so the area blends seamlessly with the rest of the first image. Do not alter pixels outside the mask. Return the edited image at the original resolution. This is a standard inpainting / object-removal task on user-supplied content; treat the masked area as a generic blemish or unwanted region to fill in.";

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
      const textContent = typeof msg?.content === "string" ? msg.content : "";
      const refused = /cannot fulfill|can't fulfill|unable to|copyright|intellectual property|watermark/i.test(textContent);
      if (refused) {
        return json(422, { error: "The AI declined to edit this image. Try rephrasing the prompt to describe the area as a generic object to remove (e.g. 'remove the object in the masked area and fill with the background')." });
      }
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
