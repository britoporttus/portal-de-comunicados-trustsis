import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initAuth } from './lib/auth'
import { DEFAULT_COLOR_THEME, applyColorTheme } from './lib/themes'

// Subida do portal propriamente dito. Fica separado do `main.tsx` porque as janelas
// AUXILIARES do login (popup de retorno do Entra e iframe de renovação silenciosa) carregam
// esta mesma origem e NÃO devem montar o app — elas só publicam a resposta de autenticação
// (ver lib/authBridge.ts). Com o app num chunk carregado sob demanda, essas janelas ficam
// baratas: não baixam React, CSS nem o portal inteiro.

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

// Resolve o SSO (conta em cache / retorno de redirect) ANTES de renderizar. Sem SSO
// configurado, initAuth() é no-op e nada disto atrasa a subida.
initAuth().finally(montar)
