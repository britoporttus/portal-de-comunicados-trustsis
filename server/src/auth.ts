// Barreira de identidade no BACKEND — valida o idToken (MSAL SPA) enviado pelo frontend.
//
// Liga SOMENTE quando AUTH_REQUIRED=true (definido no .env de PRODUÇÃO da VM). No preview do
// Hive essa var não existe → o middleware é um NO-OP e o portal continua resolvendo `me` pelo
// DEMO_USER_UPN, como hoje. Assim a mesma imagem roda no preview (sem login) e em produção
// (com barreira), sem duplicar código.
//
// Validação (single-tenant, tokens v2.0):
//   - assinatura via JWKS oficial do tenant
//   - iss === https://login.microsoftonline.com/<tenant>/v2.0
//   - aud === ENTRA_CLIENT_ID (o idToken é emitido para o próprio app)
//   - tid === ENTRA_TENANT_ID (rejeita qualquer outro tenant)
// UPN do usuário (preferred_username) vira a identidade usada para resolver perfil/agenda/org
// no Graph app-only que já funciona (substitui o DEMO_USER_UPN hardcoded).
import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./config.js";
import { resolveDirectoryKey } from "./graph.js";
import { aoMudarIntegracao, barreiraAtiva } from "./settings.js";

// A barreira é DINÂMICA: ligada/desligada na tela de Administração (com o .env como
// bootstrap). Era uma const lida no boot — agora é uma função, senão mudar a configuração
// exigiria restart do processo.
export function authRequired(): boolean {
  return barreiraAtiva();
}

// JWKS é construído SOB DEMANDA e cacheado POR TENANT: trocar o tenant na tela precisa
// invalidar o conjunto de chaves antigo (senão todo token do tenant novo seria rejeitado).
let jwksCache: { tenant: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null;

function jwksDoTenant(tenant: string) {
  if (jwksCache?.tenant !== tenant) {
    jwksCache = {
      tenant,
      jwks: createRemoteJWKSet(
        new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`),
      ),
    };
  }
  return jwksCache.jwks;
}

aoMudarIntegracao(() => {
  jwksCache = null;
});

export interface TokenIdentity {
  oid?: string;
  upn?: string;
  email?: string;
}

/** Extrai a IDENTIDADE validada do token (oid + upn + email).
 *  MOTIVO (bug real em prod): o login corporativo pode ser um GUEST de domínio irmão
 *  (ex.: joao.brito@porttus.com, objeto B2B #EXT# SEM mailbox neste tenant) enquanto os
 *  dados reais (perfil/agenda/organograma) vivem no MEMBER equivalente joao.brito@trustsis.com.
 *  `GET /users/{upn-guest}` dá 404 e o backend caía no fallback demo (dados FICTÍCIOS).
 *  Quem resolve o objeto certo é `resolveDirectoryKey` (graph.ts), que remapeia o domínio-alias
 *  para o member e, na falta, usa o oid (imutável, sempre resolvível). */
async function identityFromToken(token: string): Promise<TokenIdentity> {
  const tenant = config.entra.tenantId;
  const { payload } = await jwtVerify(token, jwksDoTenant(tenant), {
    issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
    audience: config.entra.clientId,
  });
  if (payload.tid !== tenant) throw new Error("tenant inválido");
  const oid = payload.oid as string | undefined;
  const upn = (payload.preferred_username ?? payload.upn) as string | undefined;
  const email = payload.email as string | undefined;
  if (!oid && !upn && !email) throw new Error("token sem identidade (oid/upn/email)");
  return { oid, upn, email };
}

/** Middleware de barreira. Aplicado às rotas /api (exceto /api/health). */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!authRequired()) return next(); // preview/demo/sem SSO configurado: sem barreira

  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "não autenticado" });
    return;
  }
  try {
    const id = await identityFromToken(token);
    // Resolve a chave de diretório correta (member @trustsis.com quando o login é um guest
    // de domínio-alias; senão o oid) e injeta onde os handlers já leem (?upn=), de forma
    // transparente: /me, /agenda, /org e /links passam a operar sobre o usuário REAL logado.
    const key = await resolveDirectoryKey(id);
    (req.query as Record<string, unknown>).upn = key;
    next();
  } catch (e) {
    res.status(401).json({ error: "token inválido", detail: (e as Error).message });
  }
}
