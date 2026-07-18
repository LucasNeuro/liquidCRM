/**
 * Unified Assistant - Chat unificado para Cord e Super Agente
 * 
 * Este componente substitui o CordAssistant e adiciona suporte ao Super Agente
 * com um toggle para alternar entre os dois modos.
 */

import { useState } from 'react'
import { Brain, Sparkles, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { CordAssistant } from './CordAssistant'
import { SuperAgentChat } from '../SuperAgentChat'

type Mode = 'cord' | 'super-agent'

/**
 * Unified Assistant - Gerencia a alternância entre Cord e Super Agente
 */
export function UnifiedAssistant() {
  const { isOwner, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('cord')

  // Se não for owner, não exibe nada (mesma lógica do CordAssistant original)
  if (loading) return null
  if (!isOwner) return null

  // Função para alternar entre Cord e Super Agente
  const toggleMode = () => {
    setMode((prev) => (prev === 'cord' ? 'super-agent' : 'cord'))
  }

  // Função para fechar o chat
  const handleClose = () => {
    setOpen(false)
    // Ao fechar, volta para o modo Cord
    setMode('cord')
  }

  return (
    <>
      {/* Botão flutuante principal */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-liqui-navy shadow-lg hover:bg-liqui-navy-dark transition-all duration-200"
        style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.25)' }}
        aria-label="Abrir assistente"
      >
        {mode === 'cord' ? <Sparkles className="h-7 w-7 text-white" /> : <Brain className="h-7 w-7 text-white" />}
      </button>

      {/* Chat do Cord (modo padrão) */}
      {open && mode === 'cord' && (
        <>
          <CordAssistant />
          
          {/* Botão de toggle para Super Agente (flutuante) */}
          <button
            onClick={toggleMode}
            className="fixed bottom-20 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-liqui-orange border-2 border-white shadow-lg hover:bg-liqui-orange-dark transition-all duration-200"
            aria-label="Alternar para Super Agente"
            title="Alternar para Super Agente"
          >
            <Brain className="h-5 w-5 text-white" />
          </button>
          
          {/* Botão para fechar */}
          <button
            onClick={handleClose}
            className="fixed bottom-6 right-20 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 border-2 border-red-200 shadow-lg hover:bg-red-100 transition-all duration-200"
            aria-label="Fechar"
            title="Fechar"
          >
            <X className="h-5 w-5 text-red-600" />
          </button>
        </>
      )}

      {/* Chat do Super Agente */}
      {open && mode === 'super-agent' && (
        <>
          <SuperAgentChat onClose={handleClose} position="right" />
          
          {/* Botão de toggle para Cord (flutuante) */}
          <button
            onClick={toggleMode}
            className="fixed bottom-20 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-liqui-navy border-2 border-white shadow-lg hover:bg-liqui-navy-dark transition-all duration-200"
            aria-label="Alternar para Cord"
            title="Alternar para Cord"
          >
            <Sparkles className="h-5 w-5 text-white" />
          </button>
        </>
      )}
    </>
  )
}
