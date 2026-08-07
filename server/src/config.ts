// Configuração central do backend. Nunca dá FATAL por falta de env.
//
// A fonte da verdade da INTEGRAÇÃO (SSO/Entra, Graph, políticas, ITSM) é settings.ts —
// que lê o que o admin salvou na tela de Administração e cai no .env como BOOTSTRAP.
// Aqui expomos isso no formato que o resto do backend já consome (`config.entra.clientId`…).
//
// Os campos de `config` são GETTERS: cada leitura reflete a configuração ATUAL, então
// salvar na tela passa a valer sem reiniciar o processo (os call sites leem dentro de
// funções, no momento do uso).
import { integracao, graphAtivo, itsmAtivo, aoMudarIntegracao } from "./settings.js";

export const config = {
  apiPort: Number(process.env.API_PORT ?? 8000),
  entra: {
    get clientId() { return integracao().clientId; },
    get tenantId() { return integracao().tenantId; },
    get clientSecret() { return integracao().clientSecret; },
    get adminGroupId() { return integracao().adminGroupId; },
    get demoUserUpn() { return integracao().demoUserUpn; },
  },
  // Integração com a plataforma de chamados trustsis-itsm (server-to-server, app-only).
  // O portal é o BALCÃO: usuário abre/acompanha aqui; a gestão detalhada roda no ITSM.
  itsm: {
    get baseUrl() { return integracao().itsmBaseUrl; },
    get apiScope() { return integracao().itsmApiScope; },
    get tenantSubdomain() { return integracao().itsmTenantSubdomain; },
  },
  // Políticas internas: link de COMPARTILHAMENTO da pasta do SharePoint/OneDrive onde os
  // documentos são compartilhados com todos os colaboradores. O portal apenas LISTA e abre
  // esses arquivos (read-only) via Graph. Vazio => página cai em modo demo/vazia.
  politicas: {
    get shareUrl() { return integracao().politicasShareUrl; },
  },
};

// Flags de estado. São `let` (não `const`) DE PROPÓSITO: import de ESM é live binding, então
// os ~20 lugares que fazem `if (graphEnabled)` passam a ver o valor novo assim que o admin
// salva a configuração — sem precisar reescrever cada call site como chamada de função.
export let graphEnabled = graphAtivo();
export let itsmEnabled = itsmAtivo();

/** Recalcula as flags após uma mudança de configuração (registrado abaixo). */
function recomputar(): void {
  graphEnabled = graphAtivo();
  itsmEnabled = itsmAtivo();
}

aoMudarIntegracao(recomputar);
