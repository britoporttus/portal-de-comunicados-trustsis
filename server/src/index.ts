import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config, graphEnabled } from "./config.js";
import { getStore, mutate, newId } from "./store.js";
import { getProfile, getAgenda, getOrg, getVacations, getBirthdays, getDepartments, getPoliticas, listarDocsDoShare, isGraphOn, listGroups, fetchDiretorioLive } from "./graph.js";
import { mockPeople } from "./mock.js";
import {
  acessoDaReq, catalogo, filtrarPorPerfil, listarPerfis, normalizarPerfil, podeVer, requerPerm,
} from "./perfis.js";
import { getCachedDiretorio, getCachedFerias, getSnapshotMeta, runScan, startDailyScan } from "./cache.js";
import { requireAuth, authRequired, origemDaIdentidade } from "./auth.js";
import { integracaoMascarada, salvarIntegracao } from "./settings.js";
import {
  registrarPonto, ranking, resumoDoUsuario, mesAtual, PONTOS_CONFIG, perfilDeChave, atividadeDiaria,
  canonizar, reverterPontosFeedback,
} from "./pontos.js";
import { criarTicketNoItsm, sincronizarTicket, itsmEnabled } from "./itsm.js";
import type {
  Comunicado, Evento, Aniversariante, LinkUtil, PublicacaoSocial, Feedback, TipoPonto,
  Ticket, TicketTipo, TicketPrioridade, Reporte, ReporteTipo, ReporteStatus,
  Biblioteca, Acesso,
} from "./types.js";

const app = express();
app.use(cors());
// Limite alto: comunicados podem trazer até 3 imagens embutidas como data URL (base64).
app.use(express.json({ limit: "16mb" }));

// ---------- meta / saúde ----------
// Health fica ANTES da barreira (monitoração externa não precisa de token).
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, graph: isGraphOn, mode: isGraphOn ? "graph" : "demo", auth: authRequired() });
});

// ---------- configuração de SSO para o FRONTEND (público, ANTES da barreira) ----------
// O front não pode mais depender de VITE_ENTRA_* embutido no build: ele PERGUNTA ao backend
// como se autenticar. Precisa ficar ANTES do requireAuth (é justamente o que o cliente lê
// para conseguir obter um token) e expõe somente dados PÚBLICOS do registro de app —
// clientId e tenantId de um SPA são públicos por natureza; o clientSecret nunca sai daqui.
app.get("/api/config/auth", (_req, res) => {
  const c = integracaoMascarada();
  res.json({
    authEnabled: c.ssoConfigurado,
    clientId: c.clientId,
    tenantId: c.tenantId,
    // Com a barreira ativa, o front NÃO pode cair em modo demo: exige login.
    authRequired: c.barreiraAtiva,
  });
});

// NOTA: aqui existia um `GET /api/identidades` que listava o diretório inteiro para o
// preview "entrar como" qualquer pessoa do Entra. Foi REMOVIDO de propósito: identidade não
// se escolhe. Em aba própria quem identifica é o token do SSO; no preview (iframe, onde o
// login é impossível) vale a ÚNICA identidade sancionada pelo admin em Administração ›
// Integração — ver server/src/auth.ts › requireAuth.

// Barreira de identidade: protege TODAS as rotas /api abaixo (no-op quando desligada).
app.use("/api", requireAuth);

// ---------- integração (SSO / Entra ID / Graph / ITSM) editável em Administração ----------
// Tudo que antes vivia só no .env agora é gerido aqui. O .env continua sendo o BOOTSTRAP
// (ver server/src/settings.ts) — o que for salvo nesta tela passa a ter precedência.
app.get("/api/integracao", requerPerm("perfis", "ver"), (_req, res) => {
  res.json(integracaoMascarada());
});

app.put("/api/integracao", requerPerm("perfis", "editar"), (req, res) => {
  const quem = upnDaRequisicao(req);
  try {
    res.json(salvarIntegracao(req.body ?? {}, quem || undefined));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// Testa as credenciais SALVAS: pega um token app-only e faz uma leitura mínima no Graph.
// É o que diz ao admin se a configuração realmente funciona (em vez de descobrir na falha).
app.post("/api/integracao/testar", requerPerm("perfis", "editar"), async (_req, res) => {
  if (!graphEnabled) {
    return res.json({
      ok: false,
      detalhe: "Graph desligado: informe tenantId, clientId e clientSecret.",
    });
  }
  try {
    const grupos = await listGroups();
    res.json({
      ok: true,
      detalhe: `Conexão OK — ${grupos.length} grupo(s) visíveis no tenant.`,
      grupos: grupos.length,
    });
  } catch (e) {
    res.json({ ok: false, detalhe: (e as Error).message });
  }
});

// ---------- pessoa atual / Graph ----------
// Devolve o perfil da pessoa MAIS o acesso EFETIVO (perfis do portal, páginas visíveis e
// permissões por recurso×ação) — é o que o front usa para montar o menu e esconder ações.
// `isAdmin` continua no payload (compatibilidade), agora derivado do RBAC.
app.get("/api/me", async (req, res) => {
  const upn = (req.query.upn as string) || undefined;
  try {
    const [pessoa, acesso] = await Promise.all([getProfile(upn), acessoDaReq(req)]);
    const origem = origemDaIdentidade(req);
    // IDENTIDADE CONFIÁVEL? É o que o front usa para exibir (ou não) o conteúdo do portal:
    //  - `demo`: Entra nem configurado → não há login a exigir (senão uma instalação nova
    //    ficaria trancada fora da própria tela de Administração);
    //  - `token`/`preview`: só vale se a pessoa foi de fato resolvida no diretório;
    //  - `nenhuma`: sem token e sem identidade sancionada → o portal mostra o gate.
    const autenticado = origem === "demo" ? true : origem !== "nenhuma" && pessoa.resolvido;
    const { resolvido: _resolvido, ...dados } = pessoa;
    res.json({ ...dados, isAdmin: acesso.isAdmin, acesso, autenticado, origem });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- RBAC: perfis de acesso do portal ----------
// Catálogo (páginas, recursos e ações) que a tela de admin usa para montar a matriz.
app.get("/api/acesso/catalogo", (_req, res) => res.json(catalogo()));

// Grupos do Entra para o admin ESCOLHER (não digitar GUID). Requer Group.Read.All;
// sem Graph devolve grupos demo para a tela ficar navegável no preview.
app.get("/api/grupos-entra", requerPerm("perfis", "ver"), async (_req, res) => {
  res.json(await listGroups());
});

app.get("/api/perfis", requerPerm("perfis", "ver"), (_req, res) => {
  res.json(listarPerfis());
});

// OPÇÕES de perfil (só id+nome) para o seletor "restringir a perfis" dos formulários de
// artefato (Fase 1). Quem publica um comunicado/evento não é necessariamente admin do RBAC,
// então NÃO exige a permissão de "perfis" — e o payload não expõe permissões nem grupos.
app.get("/api/perfis/opcoes", (_req, res) => {
  res.json(listarPerfis().map((p) => ({ id: p.id, nome: p.nome })));
});

app.post("/api/perfis", requerPerm("perfis", "criar"), (req, res) => {
  const novo = normalizarPerfil(req.body);
  const item = mutate((s) => {
    if (!s.perfis) s.perfis = [];
    // Só um perfil pode ser o PADRÃO (fallback de quem não casa com nenhum grupo).
    if (novo.padrao) for (const p of s.perfis) p.padrao = false;
    s.perfis.push(novo);
    return novo;
  });
  res.status(201).json(item);
});

app.put("/api/perfis/:id", requerPerm("perfis", "editar"), (req, res) => {
  const atual = listarPerfis().find((p) => p.id === req.params.id);
  if (!atual) return res.status(404).json({ error: "perfil não encontrado" });
  const atualizado = normalizarPerfil(req.body, atual);
  const item = mutate((s) => {
    const arr = s.perfis ?? [];
    const i = arr.findIndex((p) => p.id === req.params.id);
    if (i === -1) return null;
    if (atualizado.padrao) for (const p of arr) if (p.id !== atualizado.id) p.padrao = false;
    arr[i] = atualizado;
    return arr[i];
  });
  if (!item) return res.status(404).json({ error: "perfil não encontrado" });
  res.json(item);
});

app.delete("/api/perfis/:id", requerPerm("perfis", "excluir"), (req, res) => {
  const alvo = listarPerfis().find((p) => p.id === req.params.id);
  if (!alvo) return res.status(404).json({ error: "perfil não encontrado" });
  // Perfis de SISTEMA (Administrador/Colaborador) são a rede de segurança do RBAC:
  // sem eles um admin pode se trancar fora ou usuários ficarem sem fallback.
  if (alvo.sistema) return res.status(400).json({ error: "perfil de sistema não pode ser excluído" });
  const emUso = contarArtefatosComPerfil(alvo.id);
  mutate((s) => {
    s.perfis = (s.perfis ?? []).filter((p) => p.id !== req.params.id);
    // Remove a referência dos artefatos para não sobrar perfil "fantasma" restringindo item.
    for (const arr of [s.comunicados, s.eventos, s.social] as { perfis?: string[] }[][]) {
      for (const item of arr ?? []) {
        if (item.perfis?.includes(alvo.id)) item.perfis = item.perfis.filter((x) => x !== alvo.id);
      }
    }
    return null;
  });
  res.json({ ok: true, artefatosAtualizados: emUso });
});

/** Quantos artefatos referenciam um perfil (informativo ao excluir). */
function contarArtefatosComPerfil(id: string): number {
  const s = getStore();
  const listas: { perfis?: string[] }[][] = [s.comunicados, s.eventos, s.social];
  return listas.reduce(
    (n, arr) => n + (arr ?? []).filter((i) => i.perfis?.includes(id)).length,
    0,
  );
}

app.get("/api/agenda", async (req, res) => {
  const upn = (req.query.upn as string) || undefined;
  res.json(await getAgenda(upn));
});

app.get("/api/org", requerPerm("organograma", "ver"), async (req, res) => {
  const upn = (req.query.upn as string) || undefined;
  // Diretório vem do cache diário (instantâneo); só cai ao vivo na 1ª vez / cache vazio.
  const diretorio = getCachedDiretorio();
  res.json(await getOrg(upn, diretorio ? { diretorio } : undefined));
});

app.get("/api/ferias", requerPerm("ferias", "ver"), async (_req, res) => {
  // Servido do scan diário (fixado). Fallback ao vivo só enquanto o cache não encheu.
  const cached = getCachedFerias();
  res.json(cached ?? (await getVacations()));
});

// ---------- scan diário (organograma + férias) ----------
// Status do último scan (para exibir "atualizado em" nas páginas).
app.get("/api/scan/status", (_req, res) => {
  res.json({ ...getSnapshotMeta(), graph: isGraphOn });
});

// Força um novo scan agora (botão "Atualizar agora" do admin). Sem Graph, no-op.
app.post("/api/scan/run", async (_req, res) => {
  await runScan("manual");
  res.json(getSnapshotMeta());
});

// Departamentos existentes (para seletores) — leve, sem baixar fotos.
app.get("/api/departamentos", async (_req, res) => {
  try {
    res.json(await getDepartments());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- CRUD genérico do store ----------
// Protegido pelo RBAC: escrita exige a permissão recurso×ação e a LISTAGEM é filtrada pelos
// perfis do usuário (artefato sem `perfis[]` = visível a todos; ver server/src/perfis.ts).
function crud<T extends { id: string; perfis?: string[] }>(
  path: string,
  key: "comunicados" | "eventos" | "aniversariantes" | "links" | "social" | "atalhos",
  idPrefix: string,
  recurso: string,
  sort?: (a: T, b: T) => number,
  skipList = false,
) {
  if (!skipList) {
    app.get(`/api/${path}`, requerPerm(recurso, "ver"), async (req, res) => {
      // key opcional (ex.: politicas) pode faltar num store persistido antigo → [] seguro.
      const list = [...((getStore()[key] as unknown as T[] | undefined) ?? [])];
      if (sort) list.sort(sort);
      res.json(filtrarPorPerfil(list, await acessoDaReq(req), recurso));
    });
  }
  // GET por id — usado pelas páginas de detalhe (comunicado/evento completo).
  app.get(`/api/${path}/:id`, requerPerm(recurso, "ver"), async (req, res) => {
    const item = ((getStore()[key] as unknown as T[] | undefined) ?? []).find((x) => x.id === req.params.id);
    if (!item) return res.status(404).json({ error: "não encontrado" });
    // Item restrito a outros perfis: responde 404 (não revela a existência do conteúdo).
    if (!podeVer(item, await acessoDaReq(req), recurso)) return res.status(404).json({ error: "não encontrado" });
    res.json(item);
  });
  app.post(`/api/${path}`, requerPerm(recurso, "criar"), (req, res) => {
    const item = { ...req.body, id: newId(idPrefix) } as T;
    mutate((s) => {
      const arr = (s[key] as unknown as T[] | undefined) ?? ((s[key] as unknown as T[]) = []);
      arr.unshift(item);
    });
    res.status(201).json(item);
  });
  app.put(`/api/${path}/:id`, requerPerm(recurso, "editar"), (req, res) => {
    const updated = mutate((s) => {
      const arr = (s[key] as unknown as T[] | undefined) ?? [];
      const i = arr.findIndex((x) => x.id === req.params.id);
      if (i === -1) return null;
      arr[i] = { ...arr[i], ...req.body, id: req.params.id };
      return arr[i];
    });
    if (!updated) return res.status(404).json({ error: "não encontrado" });
    res.json(updated);
  });
  app.delete(`/api/${path}/:id`, requerPerm(recurso, "excluir"), (req, res) => {
    const ok = mutate((s) => {
      const arr = (s[key] as unknown as T[] | undefined) ?? [];
      const i = arr.findIndex((x) => x.id === req.params.id);
      if (i === -1) return false;
      arr.splice(i, 1);
      return true;
    });
    if (!ok) return res.status(404).json({ error: "não encontrado" });
    res.status(204).end();
  });
}

crud<Comunicado>("comunicados", "comunicados", "com", "comunicados", (a, b) => {
  if (!!b.fixado !== !!a.fixado) return b.fixado ? 1 : -1;
  return +new Date(b.publicadoEm) - +new Date(a.publicadoEm);
});

// Confirmação de leitura de um comunicado obrigatório. Registra o e-mail/UPN do usuário.
app.post("/api/comunicados/:id/ler", requerPerm("comunicados", "ver"), (req, res) => {
  const upn = String(req.body?.upn || "").toLowerCase();
  if (!upn) return res.status(400).json({ error: "upn obrigatório" });
  const updated = mutate((s) => {
    const c = s.comunicados.find((x) => x.id === req.params.id);
    if (!c) return null;
    if (!c.leituras) c.leituras = [];
    if (!c.leituras.includes(upn)) c.leituras.push(upn);
    return c;
  });
  if (!updated) return res.status(404).json({ error: "não encontrado" });
  // Gamificação: confirmar uma leitura obrigatória concede pontos (1x por comunicado).
  registrarPonto(upn, "confirmar_leitura", req.params.id);
  res.json(updated);
});
crud<Evento>("eventos", "eventos", "evt", "eventos", (a, b) => +new Date(a.inicio) - +new Date(b.inicio));

// Aniversariantes: com Graph ligado, mescla os aniversários REAIS do Entra (campo birthday)
// com os cadastrados manualmente pelo admin (store) — assim é sempre possível adicionar
// alguém mesmo em modo Graph. Sem Graph (demo), usa só o store.
app.get("/api/aniversariantes", requerPerm("aniversariantes", "ver"), async (_req, res) => {
  const manuais = [...getStore().aniversariantes];
  if (isGraphOn) {
    try {
      const doEntra = await getBirthdays();
      // Evita duplicar quem já veio do Entra (mesmo id).
      const ids = new Set(doEntra.map((a) => a.id));
      const merge = [...doEntra, ...manuais.filter((a) => !ids.has(a.id))];
      merge.sort((a, b) => a.mes - b.mes || a.dia - b.dia);
      return res.json(merge);
    } catch (e) {
      return res.status(500).json({ error: (e as Error).message });
    }
  }
  manuais.sort((a, b) => a.dia - b.dia);
  res.json(manuais);
});
crud<Aniversariante>("aniversariantes", "aniversariantes", "ani", "aniversariantes", (a, b) => a.dia - b.dia, true);
// ---------- Links úteis: personalizados por usuário ----------
// Cada colaborador (admin ou não) mantém seus próprios atalhos. A chave é o UPN/e-mail
// enviado em ?upn=. No primeiro edit, herda os atalhos padrão para não começar vazio.
function chaveUsuario(upn?: string): string {
  return (upn || config.entra.demoUserUpn || "default").toLowerCase();
}

function linksDoUsuario(chave: string): LinkUtil[] {
  const s = getStore();
  return s.linksByUser?.[chave] ?? s.links;
}

/** Garante que exista um conjunto pessoal (clonado dos padrões na primeira vez). */
function garanteLinksPessoais(s: import("./types.js").Store, chave: string): LinkUtil[] {
  if (!s.linksByUser) s.linksByUser = {};
  if (!s.linksByUser[chave]) {
    s.linksByUser[chave] = s.links.map((l) => ({ ...l }));
  }
  return s.linksByUser[chave];
}

app.get("/api/links", requerPerm("links", "ver"), async (req, res) => {
  const lista = linksDoUsuario(chaveUsuario(req.query.upn as string));
  // Atalhos podem declarar `perfis[]` (link segregado) — filtra pelo acesso do usuário.
  res.json(filtrarPorPerfil(lista, await acessoDaReq(req), "links"));
});

app.post("/api/links", requerPerm("links", "criar"), (req, res) => {
  const chave = chaveUsuario(req.query.upn as string);
  const item = { ...req.body, id: newId("lnk") } as LinkUtil;
  mutate((s) => garanteLinksPessoais(s, chave).push(item));
  res.status(201).json(item);
});

app.put("/api/links/:id", requerPerm("links", "editar"), (req, res) => {
  const chave = chaveUsuario(req.query.upn as string);
  const updated = mutate((s) => {
    const arr = garanteLinksPessoais(s, chave);
    const i = arr.findIndex((x) => x.id === req.params.id);
    if (i === -1) return null;
    arr[i] = { ...arr[i], ...req.body, id: req.params.id };
    return arr[i];
  });
  if (!updated) return res.status(404).json({ error: "não encontrado" });
  res.json(updated);
});

app.delete("/api/links/:id", requerPerm("links", "excluir"), (req, res) => {
  const chave = chaveUsuario(req.query.upn as string);
  const ok = mutate((s) => {
    const arr = garanteLinksPessoais(s, chave);
    const i = arr.findIndex((x) => x.id === req.params.id);
    if (i === -1) return false;
    arr.splice(i, 1);
    return true;
  });
  if (!ok) return res.status(404).json({ error: "não encontrado" });
  res.status(204).end();
});

// ---------- Atalhos da EMPRESA (Fase 2): links institucionais e dashboards externos ----------
// Diferente de /api/links (atalhos PESSOAIS de cada colaborador), estes são publicados pelo
// admin e segregados por perfil — é aqui que entram Power BI e demais sistemas externos.
// O portal não hospeda indicador nenhum: só aponta para a ferramenta de origem.
crud<LinkUtil>("atalhos", "atalhos", "atl", "atalhos", (a, b) =>
  (a.categoria ?? "").localeCompare(b.categoria ?? "", "pt-BR") ||
  (a.ordem ?? 0) - (b.ordem ?? 0) ||
  a.label.localeCompare(b.label, "pt-BR"),
);

// ---------- Bibliotecas de documentos (Fase 2) ----------
// Mesmo padrão das Políticas internas (pasta compartilhada do SharePoint/OneDrive listada
// read-only via Graph), agora com N pastas cadastradas pelo admin NA UI — sem env por pasta.
// O cadastro fica no store; os arquivos NUNCA são copiados, apenas listados e abertos lá.
function bibliotecaVisivel(b: Biblioteca, acesso: Acesso): boolean {
  return podeVer(b, acesso, "bibliotecas");
}

app.get("/api/bibliotecas", requerPerm("bibliotecas", "ver"), async (req, res) => {
  const lista = [...(getStore().bibliotecas ?? [])].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
  res.json(filtrarPorPerfil(lista, await acessoDaReq(req), "bibliotecas"));
});

/** Documentos de UMA biblioteca (lidos do SharePoint/OneDrive na hora, com cache curto). */
app.get("/api/bibliotecas/:id/docs", requerPerm("bibliotecas", "ver"), async (req, res) => {
  const b = (getStore().bibliotecas ?? []).find((x) => x.id === req.params.id);
  // Restrita a outros perfis: 404 (não revela a existência da biblioteca).
  if (!b || !bibliotecaVisivel(b, await acessoDaReq(req))) {
    return res.status(404).json({ error: "não encontrada" });
  }
  try {
    const forcar = req.query.forcar === "true";
    res.json(await listarDocsDoShare(b.shareUrl, forcar));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** Normaliza o corpo vindo da UI (defensivo — nada de campo solto virando registro). */
function normalizarBiblioteca(body: any, base?: Biblioteca): Biblioteca {
  const perfis = Array.isArray(body?.perfis)
    ? body.perfis.map((p: unknown) => String(p)).filter(Boolean)
    : base?.perfis;
  return {
    id: base?.id ?? newId("bib"),
    nome: String(body?.nome ?? base?.nome ?? "").trim().slice(0, 80) || "Nova biblioteca",
    descricao: String(body?.descricao ?? base?.descricao ?? "").trim().slice(0, 300) || undefined,
    shareUrl: String(body?.shareUrl ?? base?.shareUrl ?? "").trim(),
    icone: String(body?.icone ?? base?.icone ?? "").trim() || undefined,
    perfis,
    criadoEm: base?.criadoEm ?? new Date().toISOString(),
    atualizadoEm: base ? new Date().toISOString() : undefined,
  };
}

app.post("/api/bibliotecas", requerPerm("bibliotecas", "criar"), (req, res) => {
  const item = normalizarBiblioteca(req.body ?? {});
  if (!item.shareUrl) return res.status(400).json({ error: "informe o link de compartilhamento da pasta" });
  mutate((s) => (s.bibliotecas ??= []).push(item));
  res.status(201).json(item);
});

app.put("/api/bibliotecas/:id", requerPerm("bibliotecas", "editar"), (req, res) => {
  const updated = mutate((s) => {
    const arr = s.bibliotecas ?? [];
    const i = arr.findIndex((x) => x.id === req.params.id);
    if (i === -1) return null;
    arr[i] = normalizarBiblioteca(req.body ?? {}, arr[i]);
    return arr[i];
  });
  if (!updated) return res.status(404).json({ error: "não encontrada" });
  res.json(updated);
});

app.delete("/api/bibliotecas/:id", requerPerm("bibliotecas", "excluir"), (req, res) => {
  const ok = mutate((s) => {
    const arr = s.bibliotecas ?? [];
    const i = arr.findIndex((x) => x.id === req.params.id);
    if (i === -1) return false;
    arr.splice(i, 1);
    return true;
  });
  if (!ok) return res.status(404).json({ error: "não encontrada" });
  res.status(204).end();
});

crud<PublicacaoSocial>("social", "social", "soc", "social", (a, b) => +new Date(b.publicadoEm) - +new Date(a.publicadoEm));

// ---------- Políticas de utilização interna ----------
// NÃO são cadastradas no portal: são os documentos compartilhados com todos os colaboradores
// numa pasta do SharePoint/OneDrive. Read-only — o portal só lista e abre os arquivos (Graph).
app.get("/api/politicas", requerPerm("politicas", "ver"), async (_req, res) => {
  try {
    res.json(await getPoliticas());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------- Feedback do portal (bug / melhoria / outro) ----------
// Reporte sobre a PRÓPRIA aplicação. O autor vê os seus; o admin vê e gerencia todos.
const REPORTE_TIPOS: ReporteTipo[] = ["bug", "melhoria", "outro"];
const REPORTE_STATUS: ReporteStatus[] = ["aberto", "em_analise", "resolvido", "arquivado"];

app.get("/api/reportes", requerPerm("reportes", "ver"), async (req, res) => {
  const upn = upnDaRequisicao(req);
  const todos = [...(getStore().reportes ?? [])].sort(
    (a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm),
  );
  // Quem GERENCIA reportes (admin ou perfil com "editar") vê tudo; os demais veem só os que
  // abriram (chave CANÔNICA colapsa oid⇄e-mail).
  const acesso = await acessoDaReq(req);
  const gerencia = acesso.isAdmin || (acesso.permissoes.reportes ?? []).includes("editar");
  if (gerencia) return res.json(todos);
  const eu = canonizar(upn);
  res.json(eu ? todos.filter((r) => canonizar(r.de) === eu) : []);
});

app.post("/api/reportes", requerPerm("reportes", "criar"), (req, res) => {
  const de = upnDaRequisicao(req);
  if (!de) return res.status(400).json({ error: "usuário não identificado" });
  const mensagem = String(req.body?.mensagem || "").trim();
  if (!mensagem) return res.status(400).json({ error: "mensagem obrigatória" });
  const tipo: ReporteTipo = REPORTE_TIPOS.includes(req.body?.tipo) ? req.body.tipo : "outro";

  const item: Reporte = {
    id: newId("rep"),
    tipo,
    titulo: String(req.body?.titulo || "").trim().slice(0, 160),
    mensagem: mensagem.slice(0, 4000),
    pagina: String(req.body?.pagina || "").trim().slice(0, 200) || undefined,
    de,
    deNome: String(req.body?.deNome || de.split("@")[0] || "Colaborador"),
    status: "aberto",
    criadoEm: new Date().toISOString(),
  };
  mutate((s) => {
    if (!s.reportes) s.reportes = [];
    s.reportes.unshift(item);
  });
  res.status(201).json(item);
});

// ADMIN (ou perfil com permissão de editar reportes): atualiza o status de um reporte.
app.put("/api/reportes/:id", requerPerm("reportes", "editar"), (req, res) => {
  const status = req.body?.status as ReporteStatus;
  if (!REPORTE_STATUS.includes(status)) return res.status(400).json({ error: "status inválido" });
  const updated = mutate((s) => {
    const r = s.reportes?.find((x) => x.id === req.params.id);
    if (!r) return null;
    r.status = status;
    r.atualizadoEm = new Date().toISOString();
    return r;
  });
  if (!updated) return res.status(404).json({ error: "não encontrado" });
  res.json(updated);
});

// ADMIN (ou perfil com permissão de excluir reportes): remove um reporte já tratado.
app.delete("/api/reportes/:id", requerPerm("reportes", "excluir"), (req, res) => {
  const ok = mutate((s) => {
    const arr = s.reportes ?? [];
    const i = arr.findIndex((x) => x.id === req.params.id);
    if (i === -1) return false;
    arr.splice(i, 1);
    return true;
  });
  if (!ok) return res.status(404).json({ error: "não encontrado" });
  res.status(204).end();
});

// ---------- Gamificação: pontos + ranking ----------
// A identidade (upn) vem de ?upn= — em PRODUÇÃO o middleware requireAuth SOBRESCREVE esse
// valor com o usuário REAL do token, então o cliente não consegue pontuar por outra pessoa.
function upnDaRequisicao(req: import("express").Request): string {
  return String(req.query.upn || req.body?.upn || "").toLowerCase();
}

// Tabela de pontos (rótulo + valor de cada ação) — o front usa para exibir a legenda.
app.get("/api/pontos/config", (_req, res) => res.json(PONTOS_CONFIG));

// Ranking mensal (?mes=YYYY-MM, default mês atual).
app.get("/api/pontos/ranking", requerPerm("ranking", "ver"), (req, res) => {
  const mes = /^\d{4}-\d{2}$/.test(String(req.query.mes)) ? String(req.query.mes) : mesAtual();
  res.json({ mes, entradas: ranking(mes) });
});

// EXTRATO ADMIN: pontuação do mês quebrada por DIA e por usuário (como cada um pontuou).
// A UI só é oferecida a admins; aqui devolvemos os dados (o store não tem PII sensível).
app.get("/api/pontos/atividade", requerPerm("ranking", "ver"), (req, res) => {
  const mes = /^\d{4}-\d{2}$/.test(String(req.query.mes)) ? String(req.query.mes) : mesAtual();
  res.json({ mes, dias: atividadeDiaria(mes) });
});

// Resumo do usuário atual (total, posição) — alimenta o badge do topo.
app.get("/api/pontos/me", (req, res) => {
  const mes = /^\d{4}-\d{2}$/.test(String(req.query.mes)) ? String(req.query.mes) : mesAtual();
  res.json(resumoDoUsuario(upnDaRequisicao(req), mes));
});

// Registra uma ação pontuável (visita diária, leitura de comunicado, acesso a rede social…).
// O servidor decide o valor e o dedup; o corpo só informa { tipo, refId? }.
const TIPOS_CLIENTE: TipoPonto[] = ["visita_diaria", "ler_comunicado", "abrir_social"];
app.post("/api/pontos", (req, res) => {
  const tipo = req.body?.tipo as TipoPonto;
  if (!TIPOS_CLIENTE.includes(tipo)) return res.status(400).json({ error: "tipo inválido" });
  const upn = upnDaRequisicao(req);
  if (!upn) return res.status(400).json({ error: "upn obrigatório" });
  res.json(registrarPonto(upn, tipo, req.body?.refId));
});

// ---------- Aba de feedback ----------
// Feed público dos feedbacks mais recentes (mural) — visível a todos.
app.get("/api/feedbacks", requerPerm("feedback", "ver"), (req, res) => {
  const upn = upnDaRequisicao(req);
  // Enriquece cada feedback com nome/foto ATUAIS do diretório (o de/para pode ser um oid,
  // não um e-mail). Assim o mural e as listas mostram sempre o rosto e o nome corretos,
  // mesmo que o nome capturado no envio fosse um fallback. Fotos NÃO são persistidas.
  const enriquecer = (f: Feedback): Feedback => ({
    ...f,
    // Mantém o nome capturado no envio, mas garante um fallback legível se vier vazio.
    deNome: f.deNome || perfilDeChave(f.de).nome,
    paraNome: f.paraNome || perfilDeChave(f.para).nome,
    deFoto: perfilDeChave(f.de).fotoUrl,
    paraFoto: perfilDeChave(f.para).fotoUrl,
  });
  const todos = [...(getStore().feedbacks ?? [])]
    .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm))
    .map(enriquecer);
  // Compara por CHAVE CANÔNICA (colapsa oid⇄e-mail): a identidade do usuário logado oscila
  // entre o oid (GUID) e o e-mail conforme a sessão, e o feedback foi gravado com uma delas.
  // Sem canonizar, "Recebidos"/"Enviados" ficavam VAZIOS quando as duas chaves não batiam.
  const eu = canonizar(upn);
  res.json({
    recentes: todos.slice(0, 50),
    recebidos: eu ? todos.filter((f) => canonizar(f.para) === eu) : [],
    enviados: eu ? todos.filter((f) => canonizar(f.de) === eu) : [],
  });
});

// Envia um feedback a um colega. Concede pontos ao destinatário (e um bônus a quem envia).
app.post("/api/feedbacks", requerPerm("feedback", "criar"), (req, res) => {
  const de = upnDaRequisicao(req);
  const para = String(req.body?.para || "").toLowerCase();
  const mensagem = String(req.body?.mensagem || "").trim();
  const deNome = String(req.body?.deNome || de.split("@")[0] || "Colega");
  const paraNome = String(req.body?.paraNome || para.split("@")[0] || "Colega");
  if (!de) return res.status(400).json({ error: "remetente não identificado" });
  if (!para || !mensagem) return res.status(400).json({ error: "destinatário e mensagem obrigatórios" });
  if (para === de) return res.status(400).json({ error: "não é possível enviar feedback a si mesmo" });

  const item: Feedback = {
    id: newId("fb"),
    de,
    deNome,
    para,
    paraNome,
    mensagem: mensagem.slice(0, 800),
    criadoEm: new Date().toISOString(),
  };
  mutate((s) => {
    if (!s.feedbacks) s.feedbacks = [];
    s.feedbacks.unshift(item);
  });
  // Pontos: destinatário ganha o principal; remetente ganha um incentivo por participar.
  // ANTI-FARM: o refId é a CONTRAPARTE (não o id do feedback) → dedup por dia+pessoa, então
  // spammar feedbacks para/da mesma pessoa no dia pontua só uma vez (ver dedupKey em pontos.ts).
  registrarPonto(para, "feedback_recebido", de);
  registrarPonto(de, "feedback_enviado", para);
  res.status(201).json(item);
});

// ADMIN: apaga um feedback e REVERTE os pontos vinculados a ele. Como os pontos de feedback são
// deduplicados por dia+contraparte (1 pontuação por par/dia), só revertemos quando NÃO sobrar
// nenhum outro feedback do MESMO par (de→para) no MESMO dia — senão a pontuação ainda é devida.
app.delete("/api/feedbacks/:id", requerPerm("feedback", "excluir"), async (req, res) => {
  const alvo = (getStore().feedbacks ?? []).find((f) => f.id === req.params.id);
  if (!alvo) return res.status(404).json({ error: "feedback não encontrado" });

  mutate((s) => {
    s.feedbacks = (s.feedbacks ?? []).filter((f) => f.id !== alvo.id);
  });

  const dia = alvo.criadoEm.slice(0, 10);
  const sobra = (getStore().feedbacks ?? []).some(
    (f) => f.de === alvo.de && f.para === alvo.para && f.criadoEm.slice(0, 10) === dia,
  );
  if (!sobra) reverterPontosFeedback(alvo.de, alvo.para, dia);
  res.json({ ok: true, pontosRevertidos: !sobra });
});

// ---------- Tickets / chamados (em construção — integração futura com trustsis-itsm) ----------
// Balcão de abertura + acompanhamento: cada usuário abre e vê SÓ os seus chamados. A gestão
// detalhada (workflow, SLA, atribuição) será feita na plataforma trustsis-itsm; quando a API
// dela estiver acessível, sincronizamos por Ticket.externoRef (ver server/src/types.ts).
const TICKET_PRIOS: TicketPrioridade[] = ["baixa", "media", "alta", "critica"];

// "Meus tickets": lista os chamados do usuário atual (separados por solicitante). Usa a chave
// CANÔNICA (colapsa oid⇄e-mail) porque a identidade oscila entre GUID e e-mail conforme a sessão.
app.get("/api/tickets", requerPerm("tickets", "ver"), async (req, res) => {
  const eu = canonizar(upnDaRequisicao(req));
  let meus = eu
    ? [...(getStore().tickets ?? [])]
        .filter((t) => canonizar(t.solicitante) === eu)
        .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm))
    : [];

  // Sincroniza (best-effort) status/responsável dos chamados JÁ espelhados no ITSM que ainda
  // não estão num estado terminal. Falha do ITSM não afeta a resposta (segue com o local).
  if (itsmEnabled && meus.length) {
    const terminais = new Set(["resolvido", "fechado", "cancelado"]);
    const pendentes = meus.filter((t) => t.externoRef && !terminais.has(t.status));
    if (pendentes.length) {
      const updates = await Promise.all(
        // Sincroniza pelo ID do ticket no portal (o ITSM o guardou como externalRef).
        pendentes.map(async (t) => ({ id: t.id, upd: await sincronizarTicket(t.id) })),
      );
      const mudou = updates.filter((u) => u.upd);
      if (mudou.length) {
        mutate((s) => {
          for (const { id, upd } of mudou) {
            const alvo = s.tickets?.find((x) => x.id === id);
            if (alvo && upd) {
              if (upd.status) alvo.status = upd.status;
              if (upd.responsavel) alvo.responsavel = upd.responsavel;
              alvo.atualizadoEm = new Date().toISOString();
            }
          }
          return null;
        });
        // Reprojeta a lista já com os valores atualizados.
        meus = [...(getStore().tickets ?? [])]
          .filter((t) => canonizar(t.solicitante) === eu)
          .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm));
      }
    }
  }

  res.json(meus);
});

// Abre um novo chamado. O servidor fixa status "aberto" e a data de início; o corpo só traz
// título, descrição, tipo e prioridade. O solicitante vem da identidade da requisição.
app.post("/api/tickets", requerPerm("tickets", "criar"), async (req, res) => {
  const solicitante = upnDaRequisicao(req);
  if (!solicitante) return res.status(400).json({ error: "solicitante não identificado" });
  const titulo = String(req.body?.titulo || "").trim();
  const descricao = String(req.body?.descricao || "").trim();
  if (!titulo) return res.status(400).json({ error: "título obrigatório" });

  const tipo: TicketTipo = req.body?.tipo === "requisicao" ? "requisicao" : "incidente";
  const prioridade: TicketPrioridade = TICKET_PRIOS.includes(req.body?.prioridade)
    ? (req.body.prioridade as TicketPrioridade)
    : "media";

  // 1) Grava LOCAL primeiro — é o registro durável do portal (sobrevive a ITSM off/instável).
  let item = mutate((s) => {
    if (!s.tickets) s.tickets = [];
    const numero = s.tickets.reduce((m, t) => Math.max(m, t.numero || 0), 1000) + 1;
    const t: Ticket = {
      id: newId("tkt"),
      numero,
      titulo: titulo.slice(0, 160),
      descricao: descricao.slice(0, 4000),
      tipo,
      prioridade,
      status: "aberto",
      solicitante,
      solicitanteNome: String(req.body?.solicitanteNome || solicitante.split("@")[0] || "Colaborador"),
      criadoEm: new Date().toISOString(),
    };
    s.tickets.unshift(t);
    return t;
  });

  // 2) Espelha no ITSM (se ativo). Sucesso -> guarda a referência/status; falha -> segue local.
  const eco = await criarTicketNoItsm(item);
  if (eco) {
    item = mutate((s) => {
      const alvo = s.tickets?.find((x) => x.id === item.id);
      if (alvo) {
        alvo.externoRef = eco.externoRef;
        if (eco.status) alvo.status = eco.status;
        if (eco.responsavel) alvo.responsavel = eco.responsavel;
        alvo.atualizadoEm = new Date().toISOString();
      }
      return alvo ?? item;
    });
  }

  res.status(201).json(item);
});

// ---------- estático (produção): serve o SPA buildado no MESMO origin da API ----------
// Na VM, o backend serve tanto /api quanto o front (dist/), então MSAL redirectUri e as
// chamadas /api ficam same-origin (https://portal.trustsis.com). Em dev isto não roda
// (o Vite serve o front e faz proxy /api). SERVE_STATIC força o caminho de produção.
const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "../../dist"); // server/src -> raiz/dist
if (process.env.SERVE_STATIC === "true" && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback: qualquer rota não-/api devolve o index.html (BrowserRouter).
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
  console.log(`[portal-trustsis] servindo SPA estático de ${distDir}`);
}

const port = config.apiPort;
app.listen(port, "0.0.0.0", () => {
  console.log(
    `[portal-trustsis] API on :${port} — modo ${graphEnabled ? "GRAPH (Entra)" : "DEMO"}` +
    ` — barreira ${authRequired() ? "ATIVA" : "off"}`,
  );
  // Scan diário do organograma + férias (só com Graph ligado; no-op em demo).
  startDailyScan();
});
