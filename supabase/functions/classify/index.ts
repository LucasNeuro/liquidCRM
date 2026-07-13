import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    if (!GEMINI_API_KEY) {
      return json({ error: "GEMINI_API_KEY não configurada" }, 500);
    }

    const { text, leadName } = await req.json();
    if (!text || String(text).trim().length < 2) {
      return json({ error: "Campo text é obrigatório" }, 400);
    }

    const prompt = `Você é o classificador de leads da plataforma waje.
Devolva APENAS JSON válido:
{"intent":"...","sentiment":"...","labels":[],"score":0,"summary":"...","confidence":0.0}
Lead: ${leadName || "desconhecido"}
Mensagem:
"""
${text}
"""`;

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return json({ error: data?.error?.message || "Erro Gemini" }, 500);
    }

    const rawText =
      data?.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join("\n") ||
      "{}";
    const cleaned = rawText.replace(/```json|```/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(cleaned.slice(start, end + 1));

    return json({
      intent: String(parsed.intent || "outro"),
      sentiment: String(parsed.sentiment || "neutro"),
      labels: Array.isArray(parsed.labels) ? parsed.labels : [],
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      summary: String(parsed.summary || ""),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      model_name: GEMINI_MODEL,
      raw_response: data,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      500,
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
