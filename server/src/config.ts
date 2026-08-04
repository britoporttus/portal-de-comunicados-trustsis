// Configuração central do backend. Lê env com fallback seguro (nunca dá FATAL por falta de env).
export const config = {
  apiPort: Number(process.env.API_PORT ?? 8000),
  entra: {
    clientId: process.env.ENTRA_CLIENT_ID ?? "",
    tenantId: process.env.ENTRA_TENANT_ID ?? "",
    clientSecret: process.env.ENTRA_CLIENT_SECRET ?? "",
    adminGroupId: process.env.ENTRA_ADMIN_GROUP_ID ?? "",
    demoUserUpn: process.env.DEMO_USER_UPN ?? "",
  },
  // Integração com a plataforma de chamados trustsis-itsm (server-to-server, app-only).
  // O portal é o BALCÃO: usuário abre/acompanha aqui; a gestão detalhada roda no ITSM.
  // Só liga quando baseUrl + apiScope existem (e as credenciais Entra do app estão presentes).
  itsm: {
    baseUrl: (process.env.ITSM_BASE_URL ?? "").replace(/\/+$/, ""), // sem barra final
    apiScope: process.env.ITSM_API_SCOPE ?? "",                     // ex.: api://<client-id-itsm>/.default
    tenantSubdomain: process.env.ITSM_TENANT_SUBDOMAIN ?? "trustsis",
  },
  // Políticas internas: link de COMPARTILHAMENTO da pasta do SharePoint/OneDrive onde os
  // documentos são compartilhados com todos os colaboradores. O portal apenas LISTA e abre
  // esses arquivos (read-only) via Graph. Vazio => página cai em modo demo/vazia.
  politicas: {
    shareUrl: process.env.POLITICAS_SHARE_URL ?? "",
  },
};

// Graph só é usado quando as 3 credenciais existem. Sem elas => MODO DEMO (dados de exemplo).
export const graphEnabled = Boolean(
  config.entra.clientId && config.entra.tenantId && config.entra.clientSecret,
);

// Integração ITSM ativa só com URL + escopo + credenciais do app (client-credentials do Entra).
// Sem isso o portal opera 100% no store local (preview/demo/prod-sem-config nunca quebram).
export const itsmEnabled = Boolean(
  config.itsm.baseUrl &&
    config.itsm.apiScope &&
    config.entra.clientId &&
    config.entra.tenantId &&
    config.entra.clientSecret,
);
