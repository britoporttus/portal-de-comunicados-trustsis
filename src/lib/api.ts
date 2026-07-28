// Cliente HTTP tipado para a API do portal (proxy /api -> backend Node).
import type {
  Me, AgendaItem, OrgNode, Ausencia,
  Comunicado, Evento, Aniversariante, LinkUtil, PublicacaoSocial,
} from "./types";
import { getAuthToken } from "./auth";

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  // Barreira de identidade: quando o SSO está ativo (produção), anexa o idToken como
  // Bearer. No preview (auth desligado) getAuthToken() devolve null e nada muda.
  const token = await getAuthToken();
  const r = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`API ${r.status} em ${path}`);
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

export const api = {
  health: () => req<{ ok: boolean; graph: boolean; mode: string }>("/health"),
  me: () => req<Me>("/me"),
  agenda: () => req<AgendaItem[]>("/agenda"),
  org: () => req<OrgNode>("/org"),
  ferias: () => req<Ausencia[]>("/ferias"),
  departamentos: () => req<string[]>("/departamentos"),

  comunicados: {
    list: () => req<Comunicado[]>("/comunicados"),
    create: (b: Partial<Comunicado>) => req<Comunicado>("/comunicados", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Comunicado>) => req<Comunicado>(`/comunicados/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string) => req<void>(`/comunicados/${id}`, { method: "DELETE" }),
    confirmarLeitura: (id: string, upn: string) =>
      req<Comunicado>(`/comunicados/${id}/ler`, { method: "POST", body: JSON.stringify({ upn }) }),
  },
  eventos: {
    list: () => req<Evento[]>("/eventos"),
    create: (b: Partial<Evento>) => req<Evento>("/eventos", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Evento>) => req<Evento>(`/eventos/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string) => req<void>(`/eventos/${id}`, { method: "DELETE" }),
  },
  aniversariantes: {
    list: () => req<Aniversariante[]>("/aniversariantes"),
    create: (b: Partial<Aniversariante>) => req<Aniversariante>("/aniversariantes", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Aniversariante>) => req<Aniversariante>(`/aniversariantes/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string) => req<void>(`/aniversariantes/${id}`, { method: "DELETE" }),
  },
  links: {
    // Links são personalizados por usuário: passamos o UPN/e-mail do colaborador logado.
    list: (upn?: string) => req<LinkUtil[]>(`/links${upn ? `?upn=${encodeURIComponent(upn)}` : ""}`),
    create: (b: Partial<LinkUtil>, upn?: string) =>
      req<LinkUtil>(`/links${upn ? `?upn=${encodeURIComponent(upn)}` : ""}`, { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<LinkUtil>, upn?: string) =>
      req<LinkUtil>(`/links/${id}${upn ? `?upn=${encodeURIComponent(upn)}` : ""}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string, upn?: string) =>
      req<void>(`/links/${id}${upn ? `?upn=${encodeURIComponent(upn)}` : ""}`, { method: "DELETE" }),
  },
  social: {
    list: () => req<PublicacaoSocial[]>("/social"),
    create: (b: Partial<PublicacaoSocial>) => req<PublicacaoSocial>("/social", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<PublicacaoSocial>) => req<PublicacaoSocial>(`/social/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string) => req<void>(`/social/${id}`, { method: "DELETE" }),
  },
};
