import { supabase } from './supabase'
import { classifyLead, type ClassificationResult } from './ai'

export async function classifyAndPersistLead(input: {
  leadId: number
  text: string
  leadName?: string
}) {
  const classification = await classifyLead({
    text: input.text,
    leadName: input.leadName,
  })

  await persistClassification({
    leadId: input.leadId,
    sourceText: input.text,
    classification,
  })

  return classification
}

export async function persistClassification(input: {
  leadId: number
  sourceText: string
  classification: ClassificationResult
}) {
  const { classification } = input

  const { error: insertError } = await supabase.from('classifications').insert({
    id_lead: input.leadId,
    source_text: input.sourceText,
    intent: classification.intent,
    sentiment: classification.sentiment,
    labels: classification.labels,
    confidence: classification.confidence,
    score: classification.score,
    model_name: classification.model_name,
    raw_response: classification.raw_response ?? classification,
  })

  if (insertError) {
    throw new Error(insertError.message)
  }

  const { error: updateError } = await supabase
    .from('leads')
    .update({
      score_gemini: classification.score,
      intent_gemini: classification.intent,
      labels_gemini: classification.labels,
    })
    .eq('id_lead', input.leadId)

  if (updateError) {
    throw new Error(updateError.message)
  }
}
