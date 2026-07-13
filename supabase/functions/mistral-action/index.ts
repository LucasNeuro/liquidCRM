import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY") ?? "";
const MISTRAL_MODEL = Deno.env.get("MISTRAL_MODEL") ?? "mistral-small-latest";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const recipes: Record<string, string> = {
  summarize:
    "Resuma em português, em no máximo 3 frases objetivas, o texto a seguir.",
  suggest_reply:
    "Você é um atendente waje. Sugira UMA resposta curta e profissional em português para WhatsApp.",
  draft_note:
    "Gere uma anotação interna curta (1-2 frases) para o CRM, em português.",
  enrich_lead:
    "Com base no texto, liste 3 próximos passos comerciais em bullet points curtos.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    if (!MISTRAL_API_KEY) {
      return json({ error: "MISTRAL_API_KEY não configurada" }, 500);
    }

    const { action = "summarize", text, context } = await req.json();
    if (!text || String(text).trim().length < 2) {
      return json({ error: "Campo text é obrigatório" }, 400);
    }

    const system = recipes[action] || recipes.summarize;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: context
              ? `Contexto: ${context}\n\nTexto:\n${text}`
              : String(text),
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return json(
        { error: data?.message || data?.error?.message || "Erro Mistral" },
        500,
      );
    }

    return json({
      action,
      content: data?.choices?.[0]?.message?.content || "",
      model_name: MISTRAL_MODEL,
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
