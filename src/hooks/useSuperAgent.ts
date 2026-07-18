import { useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface SuperAgentMessage {
  text: string
  sender: 'user' | 'agent'
  timestamp: Date
  thought?: string
  action?: { type: string; data?: Record<string, unknown> }
  result?: { success: boolean; message: string; data?: Record<string, unknown>; error?: string }
}

interface SuperAgentResponse {
  thought: string
  action?: { type: string; data?: Record<string, unknown> }
  response: string
  result?: { success: boolean; message: string; data?: Record<string, unknown>; error?: string }
}

/**
 * Hook para interagir com o Super Agente
 */
export function useSuperAgent() {
  const { session } = useAuth()
  const [messages, setMessages] = useState<SuperAgentMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Envia um comando para o Super Agente
   */
  const sendCommand = useCallback(
    async (command: string): Promise<SuperAgentResponse | null> => {
      if (!session) {
        setError('Não autenticado')
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || 'https://nnhiyqtzzjfxnxgmufgo.supabase.co/functions/v1'}/super-agent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ command }),
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: SuperAgentResponse = await response.json()
        
        // Adiciona mensagem do usuário
        setMessages((prev) => [
          ...prev,
          {
            text: command,
            sender: 'user',
            timestamp: new Date(),
          },
        ])

        // Adiciona resposta do agente
        setMessages((prev) => [
          ...prev,
          {
            text: data.response || data.message || 'Não foi possível processar o comando',
            sender: 'agent',
            timestamp: new Date(),
            thought: data.thought,
            action: data.action,
            result: data.result,
          },
        ])

        return data

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Falha ao processar o comando'
        setError(errorMessage)
        
        // Adiciona mensagem de erro
        setMessages((prev) => [
          ...prev,
          {
            text: command,
            sender: 'user',
            timestamp: new Date(),
          },
          {
            text: `Erro: ${errorMessage}`,
            sender: 'agent',
            timestamp: new Date(),
            result: { success: false, message: errorMessage, error: errorMessage },
          },
        ])
        
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [session]
  )

  /**
   * Limpa as mensagens
   */
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  /**
   * Obtém sugestões de comandos
   */
  const getSuggestions = useCallback((): string[] => {
    return [
      'Crie um lead para João com email joao@teste.com',
      'Atualize o lead 123 com status qualificado',
      'Crie um negócio Venda para João para o lead 123',
      'Gere um relatório diário de leads',
      'Mostre as estatísticas do sistema',
      'Busque leads com status qualificado',
      'Crie um usuário para maria@empresa.com com role consultor',
    ]
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendCommand,
    clearMessages,
    getSuggestions,
  }
}

/**
 * Hook para gerar relatórios
 */
export function useSuperAgentReports() {
  const { session } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Gera um relatório
   */
  const generateReport = useCallback(
    async (type: string, webhookUrl?: string): Promise<any | null> => {
      if (!session) {
        setError('Não autenticado')
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const command = webhookUrl
          ? `Gere um relatório ${type} e envie para ${webhookUrl}`
          : `Gere um relatório ${type}`

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || 'https://nnhiyqtzzjfxnxgmufgo.supabase.co/functions/v1'}/super-agent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ command }),
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        return await response.json()

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao gerar relatório')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [session]
  )

  return {
    generateReport,
    isLoading,
    error,
  }
}

/**
 * Hook para enviar dados via webhook
 */
export function useSuperAgentWebhooks() {
  const { session } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Envia dados para um webhook
   */
  const sendToWebhook = useCallback(
    async (url: string, data: Record<string, unknown>): Promise<any | null> => {
      if (!session) {
        setError('Não autenticado')
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || 'https://nnhiyqtzzjfxnxgmufgo.supabase.co/functions/v1'}/super-agent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              command: `Enviar para webhook ${url} com body ${JSON.stringify(data)}`,
            }),
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        return await response.json()

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao enviar para webhook')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [session]
  )

  return {
    sendToWebhook,
    isLoading,
    error,
  }
}
