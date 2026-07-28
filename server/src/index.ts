import express from "express";
import cors from "cors";
import { config, graphEnabled } from "./config.js";
import { getStore, mutate, newId } from "./store.js";
import { getProfile, getAgenda, getOrg, getVacations, getBirthdays, getDepartments, isGraphOn } from "./graph.js";
import type {
  Comunicado, Evento, Aniversariante, LinkUtil, PublicacaoSocial,
} from "./types.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---------- meta / saúde ----------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, graph: isGraphOn, mode: isGraphOn ? "graph" : "demo" });
});

// ---------- pessoa atual / Graph ----------
app.get("/api/me", async (req, res) => {
  const upn = (req.query.upn as string) || undefined;
  try {
    res.json(await getProfile(upn));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/agenda", async (req, res) => {
  const upn = (req.query.upn as string) || undefined;
  res.json(await getAgenda(upn));
});

app.get("/api/org", async (req, res) => {
  const upn = (req.query.upn as string) || undefined;
  res.json(await getOrg(upn));
});

app.get("/api/ferias", async (_req, res) => {
  res.json(await getVacations());
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
function crud<T extends { id: string }>(
  path: string,
  key: "comunicados" | "eventos" | "aniversariantes" | "links" | "social",
  idPrefix: string,
  sort?: (a: T, b: T) => number,
  skipList = false,
) {
  if (!skipList) {
    app.get(`/api/${path}`, (_req, res) => {
      const list = [...(getStore()[key] as unknown as T[])];
      if (sort) list.sort(sort);
      res.json(list);
    });
  }
  app.post(`/api/${path}`, (req, res) => {
    const item = { ...req.body, id: newId(idPrefix) } as T;
    mutate((s) => (s[key] as unknown as T[]).unshift(item));
    res.status(201).json(item);
  });
  app.put(`/api/${path}/:id`, (req, res) => {
    const updated = mutate((s) => {
      const arr = s[key] as unknown as T[];
      const i = arr.findIndex((x) => x.id === req.params.id);
      if (i === -1) return null;
      arr[i] = { ...arr[i], ...req.body, id: req.params.id };
      return arr[i];
    });
    if (!updated) return res.status(404).json({ error: "não encontrado" });
    res.json(updated);
  });
  app.delete(`/api/${path}/:id`, (req, res) => {
    const ok = mutate((s) => {
      const arr = s[key] as unknown as T[];
      const i = arr.findIndex((x) => x.id === req.params.id);
      if (i === -1) return false;
      arr.splice(i, 1);
      return true;
    });
    if (!ok) return res.status(404).json({ error: "não encontrado" });
    res.status(204).end();
  });
}

crud<Comunicado>("comunicados", "comunicados", "com", (a, b) => {
  if (!!b.fixado !== !!a.fixado) return b.fixado ? 1 : -1;
  return +new Date(b.publicadoEm) - +new Date(a.publicadoEm);
});

// Confirmação de leitura de um comunicado obrigatório. Registra o e-mail/UPN do usuário.
app.post("/api/comunicados/:id/ler", (req, res) => {
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
  res.json(updated);
});
crud<Evento>("eventos", "eventos", "evt", (a, b) => +new Date(a.inicio) - +new Date(b.inicio));

// Aniversariantes: com Graph ligado, mescla os aniversários REAIS do Entra (campo birthday)
// com os cadastrados manualmente pelo admin (store) — assim é sempre possível adicionar
// alguém mesmo em modo Graph. Sem Graph (demo), usa só o store.
app.get("/api/aniversariantes", async (_req, res) => {
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
crud<Aniversariante>("aniversariantes", "aniversariantes", "ani", (a, b) => a.dia - b.dia, true);
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

app.get("/api/links", (req, res) => {
  res.json(linksDoUsuario(chaveUsuario(req.query.upn as string)));
});

app.post("/api/links", (req, res) => {
  const chave = chaveUsuario(req.query.upn as string);
  const item = { ...req.body, id: newId("lnk") } as LinkUtil;
  mutate((s) => garanteLinksPessoais(s, chave).push(item));
  res.status(201).json(item);
});

app.put("/api/links/:id", (req, res) => {
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

app.delete("/api/links/:id", (req, res) => {
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

crud<PublicacaoSocial>("social", "social", "soc", (a, b) => +new Date(b.publicadoEm) - +new Date(a.publicadoEm));

const port = config.apiPort;
app.listen(port, "0.0.0.0", () => {
  console.log(`[portal-trustsis] API on :${port} — modo ${graphEnabled ? "GRAPH (Entra)" : "DEMO"}`);
});
