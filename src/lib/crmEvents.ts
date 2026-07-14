/** Eventos leves entre CORD / Distribuição / Leads (mesma aba). */

export const CRM_CHANGED_EVENT = 'liqui:crm-changed'

export type CrmChangedDetail = {
  source?: string
  reason?: string
}

export function emitCrmChanged(detail: CrmChangedDetail = {}) {
  window.dispatchEvent(
    new CustomEvent(CRM_CHANGED_EVENT, { detail }),
  )
}

export function onCrmChanged(handler: (detail: CrmChangedDetail) => void) {
  function listener(ev: Event) {
    const ce = ev as CustomEvent<CrmChangedDetail>
    handler(ce.detail || {})
  }
  window.addEventListener(CRM_CHANGED_EVENT, listener)
  return () => window.removeEventListener(CRM_CHANGED_EVENT, listener)
}
