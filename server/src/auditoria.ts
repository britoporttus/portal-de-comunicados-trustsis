// Trilha de AUDITORIA da administração (Fase 6 do PLANO-INTRANET.md).
// Responde "quem mudou o quê e quando" nas ações sensíveis do portal: perfis de acesso e
// permissões, integração com o Entra, marca, bibliotecas, atalhos da empresa e
// obrigatoriedade de políticas.
//
// Princípios:
//  - append-only e LIMITADA (o store é um JSON: manter o arquivo pequeno importa);
//  - grava a identidade que o backend resolveu (nunca a que o cliente afirma);
//  - falhar aqui NUNCA pode derrubar a operação que estava sendo auditada.
import type { Request } from "express";
import { getStore, mutate, newId } from "./store.js";
import { canonizar, perfilDeChave } from "./pontos.js";
import type { Auditoria } from "./types.js";

/** Quantos registros ficam guardados (os mais antigos caem). */
const LIMITE = 500;

/** Registra uma ação de administração. Best-effort: nunca lança. */
export function auditar(req: Request, acao: string, alvo?: string, detalhe?: string): void {
  try {
    const cru = String(req.query.upn || (req.body as any)?.upn || "").toLowerCase();
    const quem = canonizar(cru) || cru || "desconhecido";
    const item: Auditoria = {
      id: newId("aud"),
      em: new Date().toISOString(),
      quem,
      quemNome: perfilDeChave(quem).nome,
      acao,
      alvo: alvo?.slice(0, 160) || undefined,
      detalhe: detalhe?.slice(0, 300) || undefined,
    };
    mutate((s) => {
      if (!s.auditoria) s.auditoria = [];
      s.auditoria.unshift(item);
      if (s.auditoria.length > LIMITE) s.auditoria.length = LIMITE;
    });
  } catch (e) {
    console.warn("[auditoria] falhou ao registrar:", (e as Error).message);
  }
}

/** Últimos registros (mais recentes primeiro). */
export function listarAuditoria(limite = 200): Auditoria[] {
  return (getStore().auditoria ?? []).slice(0, Math.max(1, Math.min(limite, LIMITE)));
}
