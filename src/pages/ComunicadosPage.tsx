// Página de Comunicados: lista de avisos internos com CRUD para administradores.
// Suporta segmentação por tipo de contrato (CLT/PJ) e por departamento, além de
// comunicados obrigatórios com confirmação de leitura por colaborador.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Plus, Pencil, Pin, AlertTriangle, CheckCircle2, Users, ImagePlus, X, Tag } from "lucide-react";
import { api } from "@/lib/api";
import type { Comunicado, Categoria, Prioridade, PublicoAlvo } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { comprimirImagem } from "@/lib/image";
import { tempoRelativo, iniciais, CATEGORIA_META, PRIORIDADE_META } from "@/lib/format";
import { CategoriaBadge, PrioridadeBadge } from "@/components/portal/shared";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { FormDialog, Field, FormSection, ToggleCard, ConfirmDelete } from "@/components/portal/crud";
import { PerfisPicker, RestritoBadge } from "@/components/portal/PerfisPicker";
import { Lightbox } from "@/components/portal/Lightbox";
import { usePortal } from "@/context/PortalProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Droplist } from "@/components/ui/droplist";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const MAX_IMAGENS = 3;

const CATEGORIAS = Object.keys(CATEGORIA_META) as Categoria[];
const PRIORIDADES = Object.keys(PRIORIDADE_META) as Prioridade[];

const PUBLICO_META: Record<PublicoAlvo, string> = {
  todos: "Todos os contratos",
  clt: "Somente CLT",
  pj: "Somente PJ",
};

// Opções dos Droplists do formulário — derivadas dos mesmos metadados de sempre.
const CATEGORIA_OPTIONS = CATEGORIAS.map((k) => ({ value: k, label: CATEGORIA_META[k].label }));
const PRIORIDADE_OPTIONS = PRIORIDADES.map((k) => ({ value: k, label: PRIORIDADE_META[k].label }));
const PUBLICO_OPTIONS = (Object.keys(PUBLICO_META) as PublicoAlvo[]).map((k) => ({
  value: k,
  label: PUBLICO_META[k],
}));

const MESES_CAP = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-08" -> "Agosto de 2026" (rótulo do agrupador por mês/ano). */
function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  return `${MESES_CAP[mes - 1]} de ${ano}`;
}

interface FormState {
  titulo: string;
  resumo: string;
  conteudo: string;
  categoria: Categoria;
  prioridade: Prioridade;
  autor: string;
  fixado: boolean;
  publico: PublicoAlvo;
  departamentos: string[];
  /** Perfis de acesso que enxergam o comunicado (vazio = todos) — Fase 1 do RBAC. */
  perfis: string[];
  obrigatorio: boolean;
  imagens: string[];
}

const FORM_INICIAL: FormState = {
  titulo: "",
  resumo: "",
  conteudo: "",
  categoria: "interno",
  prioridade: "media",
  autor: "Comunicação Interna",
  fixado: false,
  publico: "todos",
  departamentos: [],
  perfis: [],
  obrigatorio: false,
  imagens: [],
};

/** Decide se o comunicado é destinado ao colaborador (por contrato e departamento). */
function visivelPara(c: Comunicado, tipoContrato?: PublicoAlvo, area?: string): boolean {
  if (c.publico && c.publico !== "todos" && tipoContrato && c.publico !== tipoContrato) {
    return false;
  }
  if (c.departamentos && c.departamentos.length > 0) {
    const areaLower = (area ?? "").toLowerCase().trim();
    if (!c.departamentos.some((d) => d.toLowerCase().trim() === areaLower)) return false;
  }
  return true;
}

export default function ComunicadosPage() {
  const { me, isAdmin, pode } = usePortal();
  // Botões de gestão seguem o RBAC (recurso "comunicados"), não mais o isAdmin binário.
  // O backend valida de novo em cada rota (server/src/perfis.ts › requerPerm).
  const podeCriar = pode("comunicados", "criar");
  const podeEditar = pode("comunicados", "editar");
  const podeExcluir = pode("comunicados", "excluir");
  const gerencia = podeCriar || podeEditar || podeExcluir;
  const { data, loading, reload } = useAsync(() => api.comunicados.list());
  // Departamentos existentes (Entra) para o seletor de segmentação — só admin cadastra.
  const { data: deptData } = useAsync(() => (gerencia ? api.departamentos() : Promise.resolve([])), [gerencia]);
  const deptOptions = deptData ?? [];
  // Diretório (só admin) para resolver quem confirmou a leitura: e-mail -> pessoa.
  const { data: org } = useAsync(() => (gerencia ? api.org() : Promise.resolve(null)), [gerencia]);
  const pessoaPorEmail = useMemo(() => {
    const m = new Map<string, { nome: string; cargo?: string; area?: string; fotoUrl?: string }>();
    for (const p of org?.diretorio ?? []) {
      if (p.email) m.set(p.email.toLowerCase(), p);
    }
    return m;
  }, [org]);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [submitting, setSubmitting] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [processandoImg, setProcessandoImg] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [verLeitores, setVerLeitores] = useState<Comunicado | null>(null);

  const meuUpn = (me?.email ?? "").toLowerCase();

  // Não-admin só vê o que é direcionado a ele; admin vê tudo (para gerenciar).
  const comunicados = useMemo(() => {
    const todos = data ?? [];
    if (isAdmin) return todos;
    return todos.filter((c) => visivelPara(c, me?.tipoContrato, me?.area));
  }, [data, isAdmin, me?.tipoContrato, me?.area]);

  // Agrupa por mês/ano (assim comunicados antigos não "expiram" — ficam arquivados no seu
  // mês). Fixados saem para uma seção própria no topo. A lista já vem ordenada da API
  // (fixado primeiro, depois data desc), então cada grupo mantém a ordem de recência.
  const grupos = useMemo(() => {
    const fixados = comunicados.filter((c) => c.fixado);
    const resto = comunicados.filter((c) => !c.fixado);
    const mapa = new Map<string, Comunicado[]>();
    for (const c of resto) {
      const d = new Date(c.publicadoEm);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const arr = mapa.get(chave);
      if (arr) arr.push(c);
      else mapa.set(chave, [c]);
    }
    const meses = [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    return { fixados, meses };
  }, [comunicados]);

  const abrirNovo = () => {
    setEditId(null);
    setForm(FORM_INICIAL);
    setOpen(true);
  };

  const abrirEdicao = (c: Comunicado) => {
    setEditId(c.id);
    setForm({
      titulo: c.titulo,
      resumo: c.resumo,
      conteudo: c.conteudo,
      categoria: c.categoria,
      prioridade: c.prioridade,
      autor: c.autor,
      fixado: c.fixado ?? false,
      publico: c.publico ?? "todos",
      departamentos: c.departamentos ?? [],
      perfis: c.perfis ?? [],
      obrigatorio: c.obrigatorio ?? false,
      imagens: c.imagens ?? [],
    });
    setOpen(true);
  };

  // Comprime cada arquivo escolhido e anexa (respeitando o teto de MAX_IMAGENS).
  const adicionarImagens = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProcessandoImg(true);
    try {
      const vagas = MAX_IMAGENS - form.imagens.length;
      const escolhidos = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, vagas);
      const novas: string[] = [];
      for (const f of escolhidos) novas.push(await comprimirImagem(f));
      if (novas.length) setForm((f) => ({ ...f, imagens: [...f.imagens, ...novas].slice(0, MAX_IMAGENS) }));
    } finally {
      setProcessandoImg(false);
    }
  };

  const removerImagem = (idx: number) =>
    setForm((f) => ({ ...f, imagens: f.imagens.filter((_, i) => i !== idx) }));

  const salvar = async () => {
    if (!form.titulo?.trim()) return;
    setSubmitting(true);
    const payload: Partial<Comunicado> = {
      titulo: form.titulo,
      resumo: form.resumo,
      conteudo: form.conteudo,
      categoria: form.categoria,
      prioridade: form.prioridade,
      autor: form.autor,
      fixado: form.fixado,
      publico: form.publico,
      departamentos: form.departamentos,
      perfis: form.perfis,
      obrigatorio: form.obrigatorio,
      imagens: form.imagens,
    };
    try {
      if (editId) {
        await api.comunicados.update(editId, payload);
      } else {
        await api.comunicados.create({ ...payload, publicadoEm: new Date().toISOString() });
      }
      await reload();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const excluir = async (id: string) => {
    await api.comunicados.remove(id);
    await reload();
  };

  const confirmarLeitura = async (id: string) => {
    if (!meuUpn) return;
    setConfirmando(id);
    try {
      await api.comunicados.confirmarLeitura(id, meuUpn);
      await reload();
    } finally {
      setConfirmando(null);
    }
  };

  // Um cartão de comunicado (reutilizado dentro de cada grupo mês/ano e na seção Fixados).
  const renderCard = (c: Comunicado) => {
    const jaLeu = !!c.leituras?.includes(meuUpn);
    const totalLeituras = c.leituras?.length ?? 0;
    return (
      <div
        key={c.id}
        className={
          "rounded-xl border bg-card p-4 shadow-sm " +
          (c.obrigatorio && !jaLeu && !isAdmin ? "border-warning/50" : "border-border")
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CategoriaBadge categoria={c.categoria} />
              <PrioridadeBadge prioridade={c.prioridade} />
              {c.obrigatorio && (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                  <AlertTriangle className="size-3" /> Leitura obrigatória
                </span>
              )}
              {c.publico && c.publico !== "todos" && (
                <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                  {PUBLICO_META[c.publico]}
                </span>
              )}
              {(c.departamentos ?? []).map((d) => (
                <span
                  key={d}
                  className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                >
                  {d}
                </span>
              ))}
              <RestritoBadge perfis={c.perfis} />
              {c.fixado && <Pin className="size-3.5 text-primary" />}
            </div>
            <h3 className="font-semibold text-foreground">
              <Link to={`/comunicados/${c.id}`} className="hover:text-primary hover:underline">
                {c.titulo}
              </Link>
            </h3>
            {c.resumo && <p className="text-sm text-muted-foreground">{c.resumo}</p>}
            <p className="text-xs text-muted-foreground">
              {c.autor} · {tempoRelativo(c.publicadoEm)}
            </p>

            {/* Imagens anexadas */}
            {(c.imagens ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(c.imagens ?? []).map((src, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setLightbox(src)}
                    className="size-24 overflow-hidden rounded-lg border border-border bg-secondary transition-opacity hover:opacity-90"
                  >
                    <img
                      src={src}
                      alt={`Imagem ${i + 1} do comunicado`}
                      className="size-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Confirmação de leitura (obrigatórios) */}
            {c.obrigatorio && !isAdmin && (
              <div className="pt-1">
                {jaLeu ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                    <CheckCircle2 className="size-4" /> Leitura confirmada
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => confirmarLeitura(c.id)}
                    disabled={confirmando === c.id || !meuUpn}
                  >
                    <CheckCircle2 className="size-4" /> Confirmar leitura
                  </Button>
                )}
              </div>
            )}

            {/* Contagem de confirmações (visão admin) — clique para ver quem confirmou */}
            {c.obrigatorio && isAdmin && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => totalLeituras > 0 && setVerLeitores(c)}
                  disabled={totalLeituras === 0}
                  className="inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors enabled:hover:text-primary enabled:hover:underline disabled:cursor-default"
                >
                  <Users className="size-3.5" />
                  {totalLeituras} confirmaç{totalLeituras === 1 ? "ão" : "ões"} de leitura
                  {totalLeituras > 0 && <span className="text-primary">· ver quem</span>}
                </button>
              </div>
            )}
          </div>

          {gerencia && (
            <div className="flex shrink-0 items-center gap-1">
              {podeEditar && (
                <Button variant="ghost" size="icon" onClick={() => abrirEdicao(c)}>
                  <Pencil className="size-4" />
                </Button>
              )}
              {podeExcluir && (
                <ConfirmDelete onConfirm={() => excluir(c.id)} label="Excluir comunicado" />
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        icon={Megaphone}
        title="Comunicados"
        description="Avisos e informativos internos"
        action={
          podeCriar && (
            <Button onClick={abrirNovo}>
              <Plus className="size-4" /> Novo comunicado
            </Button>
          )
        }
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : comunicados.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhum comunicado"
          description="Ainda não há avisos publicados. Volte em breve."
        />
      ) : (
        <div className="space-y-6">
          {grupos.fixados.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Pin className="size-3.5 text-primary" /> Fixados
              </h2>
              <div className="space-y-3">{grupos.fixados.map(renderCard)}</div>
            </section>
          )}

          {grupos.meses.map(([chave, itens]) => (
            <section key={chave} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {rotuloMes(chave)}
              </h2>
              <div className="space-y-3">{itens.map(renderCard)}</div>
            </section>
          ))}
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? "Editar comunicado" : "Novo comunicado"}
        description="Escreva o aviso, classifique e escolha quem deve vê-lo."
        onSubmit={salvar}
        submitLabel={editId ? "Salvar alterações" : "Publicar comunicado"}
        submitting={submitting}
        // Diálogo mais largo: com 12 campos, `max-w-lg` espremia os pares em duas colunas
        // estreitas (chips de departamento quebravam linha a cada palavra).
        className="sm:max-w-3xl"
      >
        {/* 1) O que será comunicado */}
        <FormSection title="Conteúdo" icon={Megaphone}>
          <Field label="Título" htmlFor="titulo" required>
            <Input
              id="titulo"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex.: Recesso de fim de ano"
            />
          </Field>

          <Field label="Resumo" htmlFor="resumo" hint="Aparece na lista e na home, abaixo do título.">
            <Input
              id="resumo"
              value={form.resumo}
              onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))}
              placeholder="Uma linha resumindo o aviso"
            />
          </Field>

          <Field label="Conteúdo" htmlFor="conteudo">
            <Textarea
              id="conteudo"
              rows={6}
              value={form.conteudo}
              onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
              placeholder="Texto completo do comunicado"
            />
          </Field>

          <Field label="Imagens" htmlFor="imagens" hint={`Até ${MAX_IMAGENS} imagens (JPG/PNG). Elas aparecem no detalhe do comunicado.`}>
            <div className="flex flex-wrap items-center gap-2">
              {form.imagens.map((src, i) => (
                <div
                  key={i}
                  className="group relative size-20 overflow-hidden rounded-lg border border-border bg-secondary"
                >
                  <img src={src} alt={`Imagem ${i + 1}`} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removerImagem(i)}
                    aria-label="Remover imagem"
                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {form.imagens.length < MAX_IMAGENS && (
                <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-background text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                  <ImagePlus className="size-4" />
                  {processandoImg ? "Processando…" : "Adicionar"}
                  <input
                    id="imagens"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={processandoImg}
                    onChange={(e) => {
                      void adicionarImagens(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </Field>
        </FormSection>

        {/* 2) Como ele é classificado */}
        <FormSection title="Classificação" icon={Tag} className="grid gap-4 sm:grid-cols-3">
          <Field label="Categoria" htmlFor="categoria">
            <Droplist
              id="categoria"
              className="w-full"
              value={form.categoria}
              onChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
              options={CATEGORIA_OPTIONS}
            />
          </Field>

          <Field label="Prioridade" htmlFor="prioridade">
            <Droplist
              id="prioridade"
              className="w-full"
              value={form.prioridade}
              onChange={(v) => setForm((f) => ({ ...f, prioridade: v }))}
              options={PRIORIDADE_OPTIONS}
            />
          </Field>

          <Field label="Autor" htmlFor="autor">
            <Input
              id="autor"
              value={form.autor}
              onChange={(e) => setForm((f) => ({ ...f, autor: e.target.value }))}
              placeholder="Comunicação Interna"
            />
          </Field>
        </FormSection>

        {/* 3) Segmentação: contrato E departamento E perfil de acesso */}
        <FormSection
          title="Quem vai ver"
          icon={Users}
          description="Os três filtros se somam: contrato E departamento E perfil de acesso."
        >
          <Field label="Público-alvo" htmlFor="publico" className="sm:max-w-xs">
            <Droplist
              id="publico"
              className="w-full"
              value={form.publico}
              onChange={(v) => setForm((f) => ({ ...f, publico: v }))}
              options={PUBLICO_OPTIONS}
            />
          </Field>

          <Field
            label="Departamentos"
            htmlFor="departamentos"
            hint={
              deptOptions.length > 0
                ? form.departamentos.length === 0
                  ? "Nenhum selecionado = visível a todos os departamentos."
                  : `${form.departamentos.length} departamento(s) selecionado(s).`
                : "Separe por vírgula. Vazio = todos."
            }
          >
            {deptOptions.length > 0 ? (
              <div className="space-y-2">
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto rounded-lg border border-border bg-background p-2.5">
                  {deptOptions.map((d) => {
                    const sel = form.departamentos.includes(d);
                    return (
                      <button
                        type="button"
                        key={d}
                        aria-pressed={sel}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            departamentos: sel
                              ? f.departamentos.filter((x) => x !== d)
                              : [...f.departamentos, d],
                          }))
                        }
                        className={
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
                          (sel
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-secondary text-secondary-foreground hover:border-primary/40")
                        }
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                {form.departamentos.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => setForm((f) => ({ ...f, departamentos: [] }))}
                  >
                    Limpar seleção
                  </Button>
                )}
              </div>
            ) : (
              <Input
                id="departamentos"
                value={form.departamentos.join(", ")}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    departamentos: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  }))
                }
                placeholder="Ex.: Projetos, AMS, Comercial"
              />
            )}
          </Field>

          {/* Segregação por perfil de acesso (RBAC do portal) — soma-se ao filtro acima. */}
          <PerfisPicker
            valor={form.perfis}
            onChange={(perfis) => setForm((f) => ({ ...f, perfis }))}
          />
        </FormSection>

        {/* 4) Como ele se comporta depois de publicado */}
        <FormSection title="Publicação" icon={Pin} className="grid gap-3 sm:grid-cols-2">
          <ToggleCard
            checked={form.obrigatorio}
            onChange={(v) => setForm((f) => ({ ...f, obrigatorio: v }))}
            label="Leitura obrigatória"
            hint="O colaborador precisa confirmar que leu; você acompanha quem já confirmou."
            icon={AlertTriangle}
          />
          <ToggleCard
            checked={form.fixado}
            onChange={(v) => setForm((f) => ({ ...f, fixado: v }))}
            label="Fixar no topo"
            hint="Mantém o comunicado acima dos demais na lista e na home."
            icon={Pin}
          />
        </FormSection>
      </FormDialog>

      {/* Lightbox de imagem (com zoom) */}
      <Lightbox
        src={lightbox}
        alt="Imagem do comunicado"
        onClose={() => setLightbox(null)}
      />

      {/* Quem confirmou a leitura (visão admin) */}
      <Dialog open={!!verLeitores} onOpenChange={(o) => !o && setVerLeitores(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmações de leitura</DialogTitle>
            <DialogDescription className="line-clamp-2">
              {verLeitores?.titulo} · {(verLeitores?.leituras?.length ?? 0)} pessoa
              {(verLeitores?.leituras?.length ?? 0) === 1 ? "" : "s"} confirmaram
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto">
            {(verLeitores?.leituras ?? []).map((upn) => {
              const p = pessoaPorEmail.get(upn.toLowerCase());
              const nome = p?.nome ?? upn;
              return (
                <div key={upn} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary">
                  <Avatar className="size-9 shrink-0">
                    {p?.fotoUrl && <AvatarImage src={p.fotoUrl} alt={nome} />}
                    <AvatarFallback className="text-xs">{iniciais(nome)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p?.cargo ? `${p.cargo}${p.area ? ` · ${p.area}` : ""}` : upn}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
