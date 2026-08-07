import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initAuth } from './lib/auth'
import { processarRetornoDePopup } from './lib/authBridge'
import { DEFAULT_COLOR_THEME, applyColorTheme } from './lib/themes'

// Aplica o tema de cor salvo ANTES de renderizar, evitando flash da paleta antiga.
applyColorTheme(
  localStorage.getItem('ts-color') || DEFAULT_COLOR_THEME,
  (localStorage.getItem('ts-theme') as 'light' | 'dark') || 'dark',
)

function montar() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

// Bootstrap:
// 1) Esta página é o POPUP de retorno do Entra? Então ela só publica a resposta para a
//    janela principal (redirect bridge do msal v5) e se encerra — não monta o portal.
// 2) Caso normal: resolve o SSO (conta em cache / retorno de redirect) ANTES de renderizar.
//    Sem SSO configurado, initAuth() é no-op e nada disto atrasa a subida.
processarRetornoDePopup().then((eraPopup) => {
  if (eraPopup) return
  initAuth().finally(montar)
})
