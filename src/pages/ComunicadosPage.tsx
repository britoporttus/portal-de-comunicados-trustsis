// Página de Comunicados: lista de avisos internos com CRUD para administradores.
// Suporta segmentação por tipo de contrato (CLT/PJ) e por departamento, além de
// comunicados obrigatórios com confirmação de leitura por colaborador.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Plus, Pencil, Pin, AlertTriangle, CheckCircle2, Users, ImagePlus, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Comunicado, Categoria, Prioridade, PublicoAlvo } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { comprimirImagem } from "@/lib/image";
import { tempoRelativo, CATEGORIA_META, PRIORIDADE_META } from "@/lib/format";
import { CategoriaBadge, PrioridadeBadge } from "@/components/portal/shared";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { FormDialog, Field, ConfirmDelete } from "@/components/portal/crud";
import { usePortal } from "@/context/PortalProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const MAX_IMAGENS = 3;

const CATEGORIAS = Object.keys(CATEGORIA_META) as Categoria[];
const PRIORIDADES = Object.keys(PRIORIDADE_META) as Prioridade[];

const PUBLICO_META: Record<PublicoAlvo, string> = {
  todos: "Todos os contratos",
  clt: "Somente CLT",
  pj: "Somente PJ",
};

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
  const { me, isAdmin } = usePortal();
  const { data, loading, reload } = useAsync(() => api.comunicados.list());
  // Departamentos existentes (Entra) para o seletor de segmentação — só admin cadastra.
  const { data: deptData } = useAsync(() => (isAdmin ? api.departamentos() : Promise.resolve([])), [isAdmin]);
  const deptOptions = deptData ?? [];

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [submitting, setSubmitting] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [processandoImg, setProcessandoImg] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const meuUpn = (me?.email ?? "").toLowerCase();

  // Não-admin só vê o que é direcionado a ele; admin vê tudo (para gerenciar).
  const comunicados = useMemo(() => {
    const todos = data ?? [];
    if (isAdmin) return todos;
    return todos.filter((c) => visivelPara(c, me?.tipoContrato, me?.area));
  }, [data, isAdmin, me?.tipoContrato, me?.area]);

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

  return (
    <div>
      <PageHeader
        icon={Megaphone}
        title="Comunicados"
        description="Avisos e informativos internos"
        action={
          isAdmin && (
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
        <div className="space-y-3">
          {comunicados.map((c) => {
            const jaLeu = !!c.leituras?.includes(meuUpn);
            const totalLeituras = c.leituras?.length ?? 0;
            return (
              <div
                key={c.id}
                className={
                  "rounded-xl border bg-card p-4 shadow-sm " +
                  (c.obrigatorio && !jaLeu && !isAdmin
                    ? "border-warning/50"
                    : "border-border")
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

                    {/* Contagem de confirmações (visão admin) */}
                    {c.obrigatorio && isAdmin && (
                      <p className="inline-flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                        <Users className="size-3.5" />
                        {totalLeituras} confirmaç{totalLeituras === 1 ? "ão" : "ões"} de leitura
                      </p>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirEdicao(c)}>
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDelete onConfirm={() => excluir(c.id)} label="Excluir comunicado" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? "Editar comunicado" : "Novo comunicado"}
        description="Preencha as informações do aviso interno."
        onSubmit={salvar}
        submitting={submitting}
      >
        <Field label="Título" htmlFor="titulo">
          <Input
            id="titulo"
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            placeholder="Ex.: Recesso de fim de ano"
          />
        </Field>

        <Field label="Resumo" htmlFor="resumo">
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
            rows={4}
            value={form.conteudo}
            onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
            placeholder="Texto completo do comunicado"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria" htmlFor="categoria">
            <NativeSelect
              id="categoria"
              className="w-full"
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as Categoria }))}
            >
              {CATEGORIAS.map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {CATEGORIA_META[k].label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Prioridade" htmlFor="prioridade">
            <NativeSelect
              id="prioridade"
              className="w-full"
              value={form.prioridade}
              onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value as Prioridade }))}
            >
              {PRIORIDADES.map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {PRIORIDADE_META[k].label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>

        {/* Segmentação */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Público-alvo" htmlFor="publico">
            <NativeSelect
              id="publico"
              className="w-full"
              value={form.publico}
              onChange={(e) => setForm((f) => ({ ...f, publico: e.target.value as PublicoAlvo }))}
            >
              {(Object.keys(PUBLICO_META) as PublicoAlvo[]).map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {PUBLICO_META[k]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Departamentos" htmlFor="departamentos" hint="Selecione um ou mais. Vazio = todos.">
            {deptOptions.length > 0 ? (
              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-auto rounded-lg border border-border bg-background p-2">
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
        </div>

        <Field label="Autor" htmlFor="autor">
          <Input
            id="autor"
            value={form.autor}
            onChange={(e) => setForm((f) => ({ ...f, autor: e.target.value }))}
            placeholder="Comunicação Interna"
          />
        </Field>

        <Field label="Imagens" htmlFor="imagens" hint={`Anexe até ${MAX_IMAGENS} imagens (JPG/PNG).`}>
          <div className="space-y-2">
            {form.imagens.length > 0 && (
              <div className="flex flex-wrap gap-2">
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
              </div>
            )}
            {form.imagens.length < MAX_IMAGENS && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                <ImagePlus className="size-4" />
                {processandoImg ? "Processando…" : "Adicionar imagem"}
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

        <div className="flex flex-wrap gap-5">
          <Label htmlFor="obrigatorio" className="cursor-pointer">
            <input
              id="obrigatorio"
              type="checkbox"
              className="size-4 accent-primary"
              checked={form.obrigatorio}
              onChange={(e) => setForm((f) => ({ ...f, obrigatorio: e.target.checked }))}
            />
            Leitura obrigatória (exige confirmação)
          </Label>

          <Label htmlFor="fixado" className="cursor-pointer">
            <input
              id="fixado"
              type="checkbox"
              className="size-4 accent-primary"
              checked={form.fixado}
              onChange={(e) => setForm((f) => ({ ...f, fixado: e.target.checked }))}
            />
            Fixar no topo
          </Label>
        </div>
      </FormDialog>

      {/* Lightbox de imagem */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Imagem do comunicado</DialogTitle>
          {lightbox && (
            <img
              src={lightbox}
              alt="Imagem do comunicado"
              className="max-h-[85vh] w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
