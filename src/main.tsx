import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initAuth } from './lib/auth'

// Resolve o SSO silencioso (e um eventual retorno de redirect) ANTES de renderizar.
// No preview, initAuth() é no-op — então isto não atrasa nem quebra nada lá.
initAuth().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
})
