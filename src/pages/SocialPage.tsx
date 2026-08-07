// Página de Redes sociais: últimas publicações da TrustSis com CRUD para administradores.
// FASE 5 — engajamento INTERNO: curtir e comentar acontecem DENTRO do portal (nada é enviado
// para a rede de origem, que continua sendo apenas o destino do link "Ver publicação").
// Curtir pontua 1x por post; comentar, 1x por dia por post (ver server/src/pontos.ts).
import { useState } from "react";
import { Share2, Plus, Pencil, ExternalLink, Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicacaoSocial } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { tempoRelativo } from "@/lib/format";
import { RedeIcon } from "@/components/portal/shared";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { FormDialog, Field, ConfirmDelete } from "@/components/portal/crud";
import { PerfisPicker, RestritoBadge } from "@/components/portal/PerfisPicker";
import { usePortal } from "@/context/PortalProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Rede = PublicacaoSocial["rede"];

const REDES: { v: Rede; label: string }[] = [
  { v: "linkedin", label: "LinkedIn" },
  { v: "instagram", label: "Instagram" },
  { v: "facebook", label: "Facebook" },
  { v: "youtube", label: "YouTube" },
];

const FORM_INICIAL: Partial<PublicacaoSocial> = {
  rede: "linkedin",
  autor: "TrustSis",
  texto: "",
  imagemUrl: "",
  url: "",
  perfis: [],
};

export default function SocialPage() {
  // Gestão pelo RBAC (recurso "social"); o backend revalida em cada rota.
  const { me, pode } = usePortal();
  const podeCriar = pode("social", "criar");
  const podeEditar = pode("social", "editar");
  const podeExcluir = pode("social", "excluir");
  const { data, loading, reload } = useAsync(() => api.social.list(me?.email), [me?.email]);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PublicacaoSocial>>(FORM_INICIAL);
  const [submitting, setSubmitting] = useState(false);

  const abrirNovo = () => {
    setEditId(null);
    setForm(FORM_INICIAL);
    setOpen(true);
  };

  const abrirEdicao = (p: PublicacaoSocial) => {
    setEditId(p.id);
    setForm({
      rede: p.rede,
      autor: p.autor,
      texto: p.texto,
      imagemUrl: p.imagemUrl ?? "",
      url: p.url,
      perfis: p.perfis ?? [],
    });
    setOpen(true);
  };

  const salvar = async () => {
    if (!form.texto?.trim() || !form.url?.trim()) return;
    setSubmitting(true);
    try {
      if (editId) {
        await api.social.update(editId, form);
      } else {
        await api.social.create({ ...form, publicadoEm: new Date().toISOString() });
      }
      await reload();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const excluir = async (id: string) => {
    await api.social.remove(id);
    await reload();
  };

  const publicacoes = data ?? [];

  return (
    <div>
      <PageHeader
        icon={Share2}
        title="Redes sociais"
        description="Últimas publicações da TrustSis"
        action={
          podeCriar && (
            <Button onClick={abrirNovo}>
              <Plus className="size-4" /> Nova publicação
            </Button>
          )
        }
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : publicacoes.length === 0 ? (
        <EmptyState icon={Share2} title="Nenhuma publicação" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {publicacoes.map((p) => (
            <div
              key={p.id}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              <div className="flex items-center gap-3 p-4">
                <RedeIcon rede={p.rede} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{p.autor}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {tempoRelativo(p.publicadoEm)}
                    <RestritoBadge perfis={p.perfis} />
                  </p>
                </div>

                {(podeEditar || podeExcluir) && (
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {podeEditar && (
                      <Button variant="ghost" size="icon" onClick={() => abrirEdicao(p)}>
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {podeExcluir && (
                      <ConfirmDelete
                        onConfirm={() => excluir(p.id)}
                        label="Excluir publicação"
                      />
                    )}
                  </div>
                )}
              </div>

              {p.imagemUrl && (
                <img
                  src={p.imagemUrl}
                  alt=""
                  className="h-44 w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}

              <div className="p-4">
                <p className="line-clamp-4 whitespace-pre-line text-sm text-foreground">
                  {p.texto}
                </p>
              </div>

              <div className="mt-auto px-4 pb-4">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => void api.pontos.registrar("abrir_social", p.id, me?.email)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  Ver publicação <ExternalLink className="size-3.5" />
                </a>
              </div>

              {/* Fase 5: curtidas e comentários do PORTAL (não saem para a rede social). */}
              <Engajamento
                pub={p}
                upn={me?.email}
                nome={me?.nome}
                podeModerar={podeExcluir}
              />
            </div>
          ))}
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? "Editar publicação" : "Nova publicação"}
        description="Preencha as informações da publicação em rede social."
        onSubmit={salvar}
        submitting={submitting}
      >
        <Field label="Rede" htmlFor="rede">
          <NativeSelect
            id="rede"
            className="w-full"
            value={form.rede ?? "linkedin"}
            onChange={(e) =>
              setForm((f) => ({ ...f, rede: e.target.value as Rede }))
            }
          >
            {REDES.map((r) => (
              <NativeSelectOption key={r.v} value={r.v}>
                {r.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Autor" htmlFor="autor">
          <Input
            id="autor"
            value={form.autor ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, autor: e.target.value }))}
            placeholder="TrustSis"
          />
        </Field>

        <Field label="Texto" htmlFor="texto">
          <Textarea
            id="texto"
            rows={4}
            value={form.texto ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
            placeholder="Conteúdo da publicação"
          />
        </Field>

        <Field label="Imagem (URL)" htmlFor="imagemUrl">
          <Input
            id="imagemUrl"
            value={form.imagemUrl ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, imagemUrl: e.target.value }))}
            placeholder="https://…"
          />
        </Field>

        <Field label="URL" htmlFor="url" hint="Link da publicação">
          <Input
            id="url"
            value={form.url ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://…"
          />
        </Field>

        {/* Publicação restrita a perfis de acesso (vazio = visível a todos). */}
        <PerfisPicker
          valor={form.perfis ?? []}
          onChange={(perfis) => setForm((f) => ({ ...f, perfis }))}
        />
      </FormDialog>
    </div>
  );
}

/** Barra de engajamento de UMA publicação: curtir (toggle) e comentar. Mantém o próprio
 *  estado a partir da resposta do backend — que já devolve `euCurti` resolvido pela chave
 *  canônica do usuário (o cliente não conhece essa chave). */
function Engajamento({
  pub,
  upn,
  nome,
  podeModerar,
}: {
  pub: PublicacaoSocial;
  upn?: string;
  nome?: string;
  podeModerar: boolean;
}) {
  const [p, setP] = useState(pub);
  const [abertos, setAbertos] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const comentarios = p.comentarios ?? [];
  const curtidas = p.curtidas?.length ?? 0;

  const curtir = async () => {
    // Otimista: o coração responde na hora; a resposta do backend fixa a verdade.
    setP((a) => ({
      ...a,
      euCurti: !a.euCurti,
      curtidas: a.euCurti ? (a.curtidas ?? []).slice(0, -1) : [...(a.curtidas ?? []), "eu"],
    }));
    try {
      setP(await api.social.curtir(p.id, upn));
    } catch {
      setP(pub); // falhou: volta ao estado do servidor
    }
  };

  const comentar = async () => {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    try {
      setP(await api.social.comentar(p.id, t, nome, upn));
      setTexto("");
    } finally {
      setEnviando(false);
    }
  };

  const apagar = async (cid: string) => {
    setP(await api.social.removerComentario(p.id, cid, upn));
  };

  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={curtir}
          className={p.euCurti ? "gap-1.5 text-primary" : "gap-1.5 text-muted-foreground"}
          aria-pressed={Boolean(p.euCurti)}
        >
          <Heart className={`size-4 ${p.euCurti ? "fill-current" : ""}`} />
          {curtidas > 0 ? curtidas : "Curtir"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAbertos((v) => !v)}
          className="gap-1.5 text-muted-foreground"
        >
          <MessageCircle className="size-4" />
          {comentarios.length > 0 ? comentarios.length : "Comentar"}
        </Button>
      </div>

      {abertos && (
        <div className="space-y-3 border-t border-border bg-secondary/40 p-4">
          {comentarios.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum comentário ainda — seja o primeiro.
            </p>
          ) : (
            <ul className="space-y-3">
              {comentarios.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  {c.deFoto ? (
                    <img src={c.deFoto} alt="" className="size-7 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {(c.deNome || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">
                      {c.deNome}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {tempoRelativo(c.criadoEm)}
                      </span>
                    </p>
                    <p className="whitespace-pre-line break-words text-sm text-foreground">
                      {c.texto}
                    </p>
                  </div>
                  {podeModerar && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground"
                      onClick={() => void apagar(c.id)}
                      aria-label="Apagar comentário"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void comentar();
                }
              }}
              placeholder="Escreva um comentário…"
              className="h-9"
            />
            <Button size="sm" onClick={comentar} disabled={enviando || !texto.trim()}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
