// Persistência simples em arquivo JSON para o conteúdo gerido pelo RH/Admin
// (comunicados, eventos, aniversariantes, links, social). Degrada limpo: se não puder
// gravar, mantém em memória. Substituível por Postgres (DATABASE_URL) no futuro.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Store } from "./types.js";
import { seedData } from "./seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Diretório dos dados de runtime. Em produção, defina PORTAL_DATA_DIR para um
// caminho FORA da pasta do app (ex.: /home/jbrito/portal-data) — assim o store
// NUNCA é sobrescrito por um deploy (o tarball toca só o código, não os dados).
// Sem a env, cai no padrão server/data (dev/preview).
const DATA_DIR = process.env.PORTAL_DATA_DIR
  ? resolve(process.env.PORTAL_DATA_DIR)
  : join(__dirname, "..", "data");
const DATA_FILE = join(DATA_DIR, "store.json");

let cache: Store | null = null;

function load(): Store {
  if (cache) return cache;
  try {
    if (existsSync(DATA_FILE)) {
      cache = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Store;
      return cache;
    }
  } catch (e) {
    console.warn("[store] falha ao ler store.json, usando seed:", (e as Error).message);
  }
  cache = seedData();
  persist();
  return cache;
}

function persist(): void {
  if (!cache) return;
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    console.warn("[store] não foi possível persistir (seguindo em memória):", (e as Error).message);
  }
}

export function getStore(): Store {
  return load();
}

export function mutate<T>(fn: (s: Store) => T): T {
  const s = load();
  const result = fn(s);
  persist();
  return result;
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
