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
};

// Graph só é usado quando as 3 credenciais existem. Sem elas => MODO DEMO (dados de exemplo).
export const graphEnabled = Boolean(
  config.entra.clientId && config.entra.tenantId && config.entra.clientSecret,
);
