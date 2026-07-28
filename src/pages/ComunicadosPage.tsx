// Página de Comunicados: lista de avisos internos com CRUD para administradores.
// Suporta segmentação por tipo de contrato (CLT/PJ) e por departamento, além de
// comunicados obrigatórios com confirmação de leitura por colaborador.
import { useMemo, useState } from "react";
import { Megaphone, Plus, Pencil, Pin, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { Comunicado, Categoria, Prioridade, PublicoAlvo } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
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
  departamentosStr: string;
  obrigatorio: boolean;
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
  departamentosStr: "",
  obrigatorio: false,
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

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [submitting, setSubmitting] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);

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
      departamentosStr: (c.departamentos ?? []).join(", "),
      obrigatorio: c.obrigatorio ?? false,
    });
    setOpen(true);
  };

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
      departamentos: form.departamentosStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      obrigatorio: form.obrigatorio,
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
                    <h3 className="font-semibold text-foreground">{c.titulo}</h3>
                    {c.resumo && <p className="text-sm text-muted-foreground">{c.resumo}</p>}
                    <p className="text-xs text-muted-foreground">
                      {c.autor} · {tempoRelativo(c.publicadoEm)}
                    </p>

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

          <Field label="Departamentos" htmlFor="departamentos" hint="Separe por vírgula. Vazio = todos.">
            <Input
              id="departamentos"
              value={form.departamentosStr}
              onChange={(e) => setForm((f) => ({ ...f, departamentosStr: e.target.value }))}
              placeholder="Ex.: Projetos, AMS, Comercial"
            />
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
    </div>
  );
}
