// Scan diário: cache dos dados PESADOS do Graph (organograma + quem está de férias).
// Antes cada abertura dessas telas chamava o Graph ao vivo (listar todos os usuários +
// baixar fotos, ler out-of-office de ~200 mailboxes) → segundos de delay. Agora um scan
// roda 1x/dia (hora configurável em SCAN_HOUR, default 6h) e "fixa" o snapshot; as páginas
// servem instantâneo do cache. Persistido em disco (DATA_DIR) para sobreviver a restart
// sem re-scan imediato. No dia seguinte o scan roda de novo e atualiza se algo mudou.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pessoa, Ausencia } from "./types.js";
import { fetchDiretorioLive, getVacations, isGraphOn } from "./graph.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Mesmo diretório do store (PORTAL_DATA_DIR em produção, FORA do app; server/data em dev).
const DATA_DIR = process.env.PORTAL_DATA_DIR
  ? resolve(process.env.PORTAL_DATA_DIR)
  : join(__dirname, "..", "data");
const SNAP_FILE = join(DATA_DIR, "snapshot.json");

interface Snapshot {
  diretorio: Pessoa[] | null;
  ferias: Ausencia[] | null;
  atualizadoEm: string | null; // ISO do último scan bem-sucedido
}

let snap: Snapshot = { diretorio: null, ferias: null, atualizadoEm: null };
let carregado = false;
let rodando = false;

function carregar(): void {
  if (carregado) return;
  carregado = true;
  try {
    if (existsSync(SNAP_FILE)) {
      snap = JSON.parse(readFileSync(SNAP_FILE, "utf8")) as Snapshot;
    }
  } catch (e) {
    console.warn("[scan] falha ao ler snapshot.json:", (e as Error).message);
  }
}

function persistir(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(SNAP_FILE, JSON.stringify(snap), "utf8");
  } catch (e) {
    console.warn("[scan] não foi possível persistir snapshot:", (e as Error).message);
  }
}

export function getCachedDiretorio(): Pessoa[] | null {
  carregar();
  return snap.diretorio;
}

export function getCachedFerias(): Ausencia[] | null {
  carregar();
  return snap.ferias;
}

export function getSnapshotMeta(): {
  atualizadoEm: string | null;
  rodando: boolean;
  pessoas: number;
  ausencias: number;
} {
  carregar();
  return {
    atualizadoEm: snap.atualizadoEm,
    rodando,
    pessoas: snap.diretorio?.length ?? 0,
    ausencias: snap.ferias?.length ?? 0,
  };
}

/** Executa o scan (Graph pesado) e fixa o snapshot. Só roda com Graph ligado.
 *  Falha parcial preserva o dado anterior (não zera o que já estava cacheado). */
export async function runScan(motivo = "manual"): Promise<Snapshot> {
  carregar();
  if (!isGraphOn) return snap;
  if (rodando) return snap; // evita scans concorrentes
  rodando = true;
  console.log(`[scan] iniciando (${motivo})…`);
  try {
    const [diretorio, ferias] = await Promise.all([
      fetchDiretorioLive().catch((e) => {
        console.warn("[scan] diretório falhou:", (e as Error).message);
        return snap.diretorio;
      }),
      getVacations().catch((e) => {
        console.warn("[scan] férias falhou:", (e as Error).message);
        return snap.ferias;
      }),
    ]);
    snap = {
      diretorio: diretorio && diretorio.length ? diretorio : snap.diretorio,
      ferias: ferias ?? snap.ferias,
      atualizadoEm: new Date().toISOString(),
    };
    persistir();
    console.log(
      `[scan] concluído — ${snap.diretorio?.length ?? 0} pessoas, ${snap.ferias?.length ?? 0} ausências`,
    );
  } finally {
    rodando = false;
  }
  return snap;
}

/** Agenda o scan diário na hora SCAN_HOUR (default 6h, horário do servidor). Na subida:
 *  se o snapshot está vazio ou velho (> 20h), dispara um scan em background para já
 *  chegar com dados fixados. Sem Graph (demo) não faz nada. */
export function startDailyScan(): void {
  if (!isGraphOn) return;
  carregar();
  const HORA = Math.min(23, Math.max(0, Number(process.env.SCAN_HOUR ?? 6)));
  const idadeMs = snap.atualizadoEm
    ? Date.now() - new Date(snap.atualizadoEm).getTime()
    : Infinity;
  if (idadeMs > 20 * 3_600_000) void runScan("boot");

  const agendar = () => {
    const agora = new Date();
    const prox = new Date(agora);
    prox.setHours(HORA, 0, 0, 0);
    if (prox <= agora) prox.setDate(prox.getDate() + 1);
    const ms = prox.getTime() - agora.getTime();
    const t = setTimeout(() => {
      void runScan("agendado");
      agendar();
    }, ms);
    t.unref?.(); // não segura o processo
  };
  agendar();
  console.log(`[scan] agendado para rodar diariamente às ${HORA}h`);
}
