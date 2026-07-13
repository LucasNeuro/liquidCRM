const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY') || ''
const MISTRAL_EMBED_MODEL =
  Deno.env.get('MISTRAL_EMBED_MODEL') || 'mistral-embed'

export async function mistralEmbed(texts: string[]): Promise<number[][]> {
  if (!MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY ausente nos secrets')
  }
  if (!texts.length) return []

  const response = await fetch('https://api.mistral.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: MISTRAL_EMBED_MODEL,
      input: texts,
      encoding_format: 'float',
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(
      data?.message || data?.error?.message || `Mistral embed HTTP ${response.status}`,
    )
  }

  const rows = (data?.data || []) as Array<{ embedding: number[]; index: number }>
  rows.sort((a, b) => a.index - b.index)
  return rows.map((r) => r.embedding)
}

export { MISTRAL_EMBED_MODEL }
