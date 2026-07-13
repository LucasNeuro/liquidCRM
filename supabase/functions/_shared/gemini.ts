export function extractJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('Resposta da IA sem JSON válido')
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
}

export async function runGeminiJson(input: {
  systemPrompt: string
  userPrompt: string
  temperature?: number
}): Promise<{ parsed: Record<string, unknown>; model: string; raw: unknown }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || ''
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY ausente nos secrets da Edge Function')
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
      generationConfig: {
        temperature: input.temperature ?? 0.2,
        responseMimeType: 'application/json',
      },
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`)
  }

  const rawText =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || '')
      .join('\n') || ''

  return {
    parsed: extractJsonObject(rawText),
    model,
    raw: data,
  }
}
