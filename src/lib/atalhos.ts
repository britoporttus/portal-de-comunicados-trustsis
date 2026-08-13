import type { LinkUtil } from "./types";

/**
 * Um atalho institucional é visível ao colaborador quando NÃO tem departamentos
 * (todos veem) ou quando a área do colaborador está entre os departamentos escolhidos.
 * É a mesma regra de segmentação usada nos Comunicados (filtro no front pela área
 * resolvida pelo backend — a segregação forte de fato continua sendo por perfil).
 */
export function atalhoVisivelPorDepto(a: LinkUtil, area?: string): boolean {
  const deptos = a.departamentos ?? [];
  if (deptos.length === 0) return true;
  const areaLower = (area ?? "").toLowerCase().trim();
  if (!areaLower) return false;
  return deptos.some((d) => d.toLowerCase().trim() === areaLower);
}
