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

export const authRequired = process.env.AUTH_REQUIRED === "true";

const tenant = config.entra.tenantId;
const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
const jwks = authRequired && tenant
  ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`))
  : null;

/** Extrai o UPN validado do token, ou lança. */
async function upnFromToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, jwks!, {
    issuer,
    audience: config.entra.clientId,
  });
  if (payload.tid !== tenant) throw new Error("tenant inválido");
  const upn = (payload.preferred_username ?? payload.upn ?? payload.email) as string | undefined;
  if (!upn) throw new Error("token sem UPN");
  return upn;
}

/** Middleware de barreira. Aplicado às rotas /api (exceto /api/health). */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!authRequired || !jwks) return next(); // preview/demo: sem barreira

  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "não autenticado" });
    return;
  }
  try {
    const upn = await upnFromToken(token);
    // Injeta o UPN validado onde os handlers já leem (?upn=), de forma transparente:
    // /me, /agenda, /org e /links passam a operar sobre o usuário REAL logado.
    (req.query as Record<string, unknown>).upn = upn;
    next();
  } catch (e) {
    res.status(401).json({ error: "token inválido", detail: (e as Error).message });
  }
}
