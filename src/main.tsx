import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { SessionGuard } from './components/SessionGuard'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary name="root" fallbackTitle="Falha ao iniciar o LIQUI">
      <BrowserRouter>
        <AuthProvider>
          <SessionGuard>
            <App />
          </SessionGuard>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
