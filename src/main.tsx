import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initAuth } from './lib/auth'
import { DEFAULT_COLOR_THEME, applyColorTheme } from './lib/themes'

// Aplica o tema de cor salvo ANTES de renderizar, evitando flash da paleta antiga.
applyColorTheme(
  localStorage.getItem('ts-color') || DEFAULT_COLOR_THEME,
  (localStorage.getItem('ts-theme') as 'light' | 'dark') || 'dark',
)

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
