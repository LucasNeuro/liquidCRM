import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react'
import { X, Paperclip, Send, Bot, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  text: string
  sender: 'user' | 'agent'
  timestamp: Date
  thought?: string
  action?: { type: string; data?: Record<string, unknown> }
  result?: { success: boolean; message: string; data?: Record<string, unknown>; error?: string }
  loading?: boolean
  error?: boolean
}

interface SuperAgentChatProps {
  onClose: () => void
  position?: 'left' | 'right'
}

export function SuperAgentChat({ onClose, position = 'right' }: SuperAgentChatProps) {
  const { session } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Mensagens de boas-vindas
  const welcomeMessages: Message[] = [
    {
      id: '1',
      text: 'Olá! Eu sou o **Super Agente**, seu assistente de CRM.',
      sender: 'agent',
      timestamp: new Date(),
    },
    {
      id: '2',
      text: 'Posso ajudar você com:',
      sender: 'agent',
      timestamp: new Date(),
    },
    {
      id: '3',
      text: '• Criar leads, negócios e usuários\n• Gerar relatórios diários/semanais\n• Buscar informações no CRM\n• Enviar dados para outras plataformas',
      sender: 'agent',
      timestamp: new Date(),
    },
    {
      id: '4',
      text: 'Tente: _"Crie um lead para João com email joao@teste.com"_ ou _"Gere um relatório diário de leads"_',
      sender: 'agent',
      timestamp: new Date(),
    },
  ]

  // Inicializa com mensagens de boas-vindas
  useEffect(() => {
    setMessages(welcomeMessages)
  }, [])

  // Rolagem automática para o final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Função para enviar mensagem
  async function handleSendMessage() {
    if (!inputValue.trim() || !session || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: inputValue.trim(),
      sender: 'user',
      timestamp: new Date(),
    }

    // Adiciona mensagem do usuário
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Adiciona placeholder de loading
    const loadingMessage: Message = {
      id: crypto.randomUUID(),
      text: '',
      sender: 'agent',
      timestamp: new Date(),
      loading: true,
    }
    setMessages((prev) => [...prev, loadingMessage])

    try {
      // Chama a Edge Function do Super Agente
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || 'https://nnhiyqtzzjfxnxgmufgo.supabase.co/functions/v1'}/super-agent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ command: inputValue.trim() }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Remove a mensagem de loading
      setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id))

      // Adiciona resposta do agente
      const agentMessage: Message = {
        id: crypto.randomUUID(),
        text: data.response || data.message || 'Não foi possível processar o comando',
        sender: 'agent',
        timestamp: new Date(),
        thought: data.thought,
        action: data.action,
        result: data.result,
      }
      setMessages((prev) => [...prev, agentMessage])

    } catch (error) {
      // Remove a mensagem de loading
      setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id))

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        text: `Erro: ${error instanceof Error ? error.message : 'Falha ao processar o comando'}`,
        sender: 'agent',
        timestamp: new Date(),
        error: true,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Envia mensagem com Enter
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Formata a mensagem do agente com dados adicionais
  function formatAgentMessage(msg: Message) {
    if (!msg.thought && !msg.action && !msg.result) {
      return msg.text
    }

    let formatted = msg.text

    // Adiciona thought (processamento interno)
    if (msg.thought && msg.thought !== msg.text) {
      formatted = `💭 *Processamento:* ${msg.thought}\n\n${formatted}`
    }

    // Adiciona ação executada
    if (msg.action) {
      formatted += `\n\n📋 *Ação:* \`${msg.action.type}\``
      if (msg.action.data && Object.keys(msg.action.data).length > 0) {
        formatted += `\n*Dados:* \`${JSON.stringify(msg.action.data, null, 2)}\``
      }
    }

    // Adiciona resultado
    if (msg.result) {
      formatted += `\n\n📊 *Resultado:*`
      if (msg.result.success) {
        formatted += ` ✅ ${msg.result.message}`
        if (msg.result.data && Object.keys(msg.result.data).length > 0) {
          formatted += `\n\`${JSON.stringify(msg.result.data, null, 2)}\``
        }
      } else {
        formatted += ` ❌ ${msg.result.message}`
        if (msg.result.error) {
          formatted += `\n*Erro:* ${msg.result.error}`
        }
      }
    }

    return formatted
  }

  // Formata timestamp
  function formatTime(date: Date) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      className={`fixed bottom-6 ${position === 'right' ? 'right-6' : 'left-6'} w-80 bg-white rounded-2xl shadow-2xl border border-zinc-200 z-50 max-w-[90vw] max-h-[80vh] flex flex-col`}
      style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-liqui-navy rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white">
            <Bot className="h-5 w-5 text-liqui-navy" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Super Agente</h3>
            <p className="text-xs text-liqui-orange-soft">Assistente de CRM</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-zinc-700 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${msg.sender === 'user' ? 'bg-liqui-navy text-white' : 'bg-white text-liqui-navy border border-zinc-200'}`}
            >
              <p className="text-sm whitespace-pre-wrap">
                {msg.sender === 'agent' ? formatAgentMessage(msg) : msg.text}
              </p>
              <p className={`text-[10px] mt-1 ${msg.sender === 'user' ? 'text-liqui-orange-soft' : 'text-zinc-400'}`}>
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-zinc-200 rounded-2xl px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-liqui-orange" />
                <span className="text-sm text-zinc-600">Processando...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-100 bg-white rounded-b-2xl">
        <div className="flex items-end gap-2">
          <button className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 disabled:opacity-50">
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={inputValue}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite um comando... (Ex: Crie um lead para João)"
            className="flex-1 resize-none rounded-xl border border-zinc-200 px-4 py-2 text-sm outline-none focus:border-liqui-orange min-h-[40px] max-h-[120px]"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-liqui-navy text-white hover:bg-liqui-navy-dark disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
