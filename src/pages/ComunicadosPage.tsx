// Página de Comunicados: lista de avisos internos com CRUD para administradores.
import { useState } from "react";
import { Megaphone, Plus, Pencil, Pin } from "lucide-react";
import { api } from "@/lib/api";
import type { Comunicado, Categoria, Prioridade } from "@/lib/types";
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

const FORM_INICIAL: Partial<Comunicado> = {
  titulo: "",
  resumo: "",
  conteudo: "",
  categoria: "interno",
  prioridade: "media",
  autor: "Comunicação Interna",
  fixado: false,
};

export default function ComunicadosPage() {
  const { isAdmin } = usePortal();
  const { data, loading, reload } = useAsync(() => api.comunicados.list());

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Comunicado>>(FORM_INICIAL);
  const [submitting, setSubmitting] = useState(false);

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
    });
    setOpen(true);
  };

  const salvar = async () => {
    if (!form.titulo?.trim()) return;
    setSubmitting(true);
    try {
      if (editId) {
        await api.comunicados.update(editId, form);
      } else {
        await api.comunicados.create({ ...form, publicadoEm: new Date().toISOString() });
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

  const comunicados = data ?? [];

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
          {comunicados.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoriaBadge categoria={c.categoria} />
                    <PrioridadeBadge prioridade={c.prioridade} />
                    {c.fixado && <Pin className="size-3.5 text-primary" />}
                  </div>
                  <h3 className="font-semibold text-foreground">{c.titulo}</h3>
                  {c.resumo && (
                    <p className="text-sm text-muted-foreground">{c.resumo}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {c.autor} · {tempoRelativo(c.publicadoEm)}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirEdicao(c)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDelete
                      onConfirm={() => excluir(c.id)}
                      label="Excluir comunicado"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
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
            value={form.titulo ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            placeholder="Ex.: Recesso de fim de ano"
          />
        </Field>

        <Field label="Resumo" htmlFor="resumo">
          <Input
            id="resumo"
            value={form.resumo ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))}
            placeholder="Uma linha resumindo o aviso"
          />
        </Field>

        <Field label="Conteúdo" htmlFor="conteudo">
          <Textarea
            id="conteudo"
            rows={4}
            value={form.conteudo ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
            placeholder="Texto completo do comunicado"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria" htmlFor="categoria">
            <NativeSelect
              id="categoria"
              className="w-full"
              value={form.categoria ?? "interno"}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoria: e.target.value as Categoria }))
              }
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
              value={form.prioridade ?? "media"}
              onChange={(e) =>
                setForm((f) => ({ ...f, prioridade: e.target.value as Prioridade }))
              }
            >
              {PRIORIDADES.map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {PRIORIDADE_META[k].label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <Field label="Autor" htmlFor="autor">
          <Input
            id="autor"
            value={form.autor ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, autor: e.target.value }))}
            placeholder="Comunicação Interna"
          />
        </Field>

        <Label htmlFor="fixado" className="cursor-pointer">
          <input
            id="fixado"
            type="checkbox"
            className="size-4 accent-primary"
            checked={form.fixado ?? false}
            onChange={(e) => setForm((f) => ({ ...f, fixado: e.target.checked }))}
          />
          Fixar no topo
        </Label>
      </FormDialog>
    </div>
  );
}
