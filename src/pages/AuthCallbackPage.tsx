import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Página de callback para autenticação do Supabase.
 * Captura o token da URL e redireciona para o dashboard.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#access_token=')) {
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      
      if (accessToken) {
        // Limpa o hash da URL
        window.history.replaceState({}, document.title, window.location.pathname)
        
        // Define a sessão manualmente
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        })
        
        // Redireciona para o dashboard após 1 segundo
        setTimeout(() => {
          navigate('/dashboard')
        }, 1000)
      } else {
        // Se não tiver token, redireciona para login
        navigate('/login')
      }
    } else {
      // Se não houver hash, redireciona para login
      navigate('/login')
    }
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-liqui-navy">
      <div className="text-center text-white">
        <p className="text-xl font-bold">Autenticando...</p>
        <p className="mt-2 text-sm text-liqui-orange">Aguarde um momento</p>
      </div>
    </div>
  )
}
