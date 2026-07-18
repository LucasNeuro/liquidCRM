import { useState } from 'react'
import { Bot, MessageCircle } from 'lucide-react'
import { SuperAgentChat } from './SuperAgentChat'

interface SuperAgentButtonProps {
  position?: 'left' | 'right'
  buttonClassName?: string
}

export function SuperAgentButton({ position = 'right', buttonClassName = '' }: SuperAgentButtonProps) {
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <>
      {/* Botão Flutuante */}
      <button
        onClick={() => setIsChatOpen(true)}
        className={`fixed bottom-6 ${position === 'right' ? 'right-6' : 'left-6'} h-14 w-14 rounded-full bg-liqui-navy shadow-lg hover:bg-liqui-navy-dark transition-all duration-200 flex items-center justify-center text-white ${buttonClassName}`}
        style={{
          boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
          zIndex: 40,
        }}
        aria-label="Abrir Super Agente"
      >
        <Bot className="h-7 w-7" />
      </button>

      {/* Chat do Super Agente */}
      {isChatOpen && (
        <SuperAgentChat 
          onClose={() => setIsChatOpen(false)} 
          position={position}
        />
      )}
    </>
  )
}

// Versão alternativa com badges de notificação
export function SuperAgentButtonWithBadge({ position = 'right' }: { position?: 'left' | 'right' }) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  return (
    <>
      {/* Botão Flutuante com Badge */}
      <button
        onClick={() => setIsChatOpen(true)}
        className={`fixed bottom-6 ${position === 'right' ? 'right-6' : 'left-6'} h-14 w-14 rounded-full bg-liqui-navy shadow-lg hover:bg-liqui-navy-dark transition-all duration-200 flex items-center justify-center text-white relative`}
        style={{
          boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
          zIndex: 40,
        }}
        aria-label="Abrir Super Agente"
      >
        <Bot className="h-7 w-7" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-liqui-orange text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat do Super Agente */}
      {isChatOpen && (
        <SuperAgentChat 
          onClose={() => {
            setIsChatOpen(false)
            setUnreadCount(0)
          }} 
          position={position}
        />
      )}
    </>
  )
}

// Componente para integrar com o botão de chat existente
export function SuperAgentToggle({ 
  isOpen, 
  onToggle, 
  position = 'right' 
}: { 
  isOpen: boolean 
  onToggle: () => void 
  position?: 'left' | 'right' 
}) {
  return (
    <>
      <button
        onClick={onToggle}
        className={`fixed bottom-6 ${position === 'right' ? 'right-20' : 'left-6'} h-14 w-14 rounded-full bg-liqui-orange shadow-lg hover:bg-liqui-orange-dark transition-all duration-200 flex items-center justify-center text-white`}
        style={{
          boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
          zIndex: 40,
        }}
        aria-label="Abrir Super Agente"
      >
        <MessageCircle className="h-7 w-7" />
      </button>

      {isOpen && (
        <SuperAgentChat 
          onClose={() => onToggle()} 
          position={position}
        />
      )}
    </>
  )
}
