import express from "express";
import cors from "cors";
import { config, graphEnabled } from "./config.js";
import { getStore, mutate, newId } from "./store.js";
import { getProfile, getAgenda, getOrg, getVacations, isGraphOn } from "./graph.js";
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

// ---------- CRUD genérico do store ----------
function crud<T extends { id: string }>(
  path: string,
  key: "comunicados" | "eventos" | "aniversariantes" | "links" | "social",
  idPrefix: string,
  sort?: (a: T, b: T) => number,
) {
  app.get(`/api/${path}`, (_req, res) => {
    const list = [...(getStore()[key] as unknown as T[])];
    if (sort) list.sort(sort);
    res.json(list);
  });
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
crud<Evento>("eventos", "eventos", "evt", (a, b) => +new Date(a.inicio) - +new Date(b.inicio));
crud<Aniversariante>("aniversariantes", "aniversariantes", "ani", (a, b) => a.dia - b.dia);
crud<LinkUtil>("links", "links", "lnk");
crud<PublicacaoSocial>("social", "social", "soc", (a, b) => +new Date(b.publicadoEm) - +new Date(a.publicadoEm));

const port = config.apiPort;
app.listen(port, "0.0.0.0", () => {
  console.log(`[portal-trustsis] API on :${port} — modo ${graphEnabled ? "GRAPH (Entra)" : "DEMO"}`);
});
