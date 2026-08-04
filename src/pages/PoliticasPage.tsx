// Políticas de utilização interna: documentos (código de conduta, uso de e-mail,
// segurança…) publicados pelo admin e lidos por todos. Leitura em accordion agrupado por
// categoria; o admin ganha criar/editar/excluir (com título, categoria, ordem e conteúdo).
import { useMemo, useState } from "react";
import { ScrollText, Plus, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import type { Politica } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { dataLonga } from "@/lib/format";
import { usePortal } from "@/context/PortalProvider";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { FormDialog, Field, ConfirmDelete } from "@/components/portal/crud";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const FORM_INICIAL: Partial<Politica> = { titulo: "", categoria: "", conteudo: "", ordem: 0 };

export default function PoliticasPage() {
  const { isAdmin } = usePortal();
  const { data, loading, reload } = useAsync(() => api.politicas.list(), []);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Politica>>(FORM_INICIAL);
  const [submitting, setSubmitting] = useState(false);

  const politicas = data ?? [];

  // Agrupa por categoria (mantendo a ordem já vinda da API: ordem asc, depois atualização).
  const grupos = useMemo(() => {
    const mapa = new Map<string, Politica[]>();
    for (const p of politicas) {
      const cat = p.categoria?.trim() || "Geral";
      const arr = mapa.get(cat);
      if (arr) arr.push(p);
      else mapa.set(cat, [p]);
    }
    return [...mapa.entries()];
  }, [politicas]);

  const abrirNovo = () => {
    setEditId(null);
    setForm({ ...FORM_INICIAL, ordem: politicas.length + 1 });
    setOpen(true);
  };

  const abrirEdicao = (p: Politica) => {
    setEditId(p.id);
    setForm({ titulo: p.titulo, categoria: p.categoria ?? "", conteudo: p.conteudo, ordem: p.ordem ?? 0 });
    setOpen(true);
  };

  const salvar = async () => {
    if (!form.titulo?.trim() || !form.conteudo?.trim() || submitting) return;
    setSubmitting(true);
    try {
      const payload: Partial<Politica> = {
        titulo: form.titulo.trim(),
        categoria: form.categoria?.trim() || undefined,
        conteudo: form.conteudo,
        ordem: Number(form.ordem) || 0,
      };
      if (editId) await api.politicas.update(editId, payload);
      else await api.politicas.create(payload);
      await reload();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const excluir = async (id: string) => {
    await api.politicas.remove(id);
    await reload();
  };

  return (
    <div>
      <PageHeader
        icon={ScrollText}
        title="Políticas internas"
        description="Normas e diretrizes de utilização — leitura obrigatória para todos os colaboradores"
        action={
          isAdmin ? (
            <Button onClick={abrirNovo}>
              <Plus className="size-4" /> Nova política
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : politicas.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nenhuma política publicada"
          description={
            isAdmin
              ? "Cadastre a primeira política interna para que o time possa consultá-la."
              : "As políticas internas aparecerão aqui assim que forem publicadas."
          }
          action={
            isAdmin ? (
              <Button onClick={abrirNovo}>
                <Plus className="size-4" /> Nova política
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {grupos.map(([categoria, itens]) => (
            <section key={categoria}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {categoria}
              </h3>
              <Accordion className="rounded-xl border border-border bg-card px-4 shadow-sm">
                {itens.map((p) => (
                  <AccordionItem key={p.id} value={p.id}>
                    <AccordionTrigger>
                      <span className="flex-1">{p.titulo}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {p.conteudo}
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                        <span className="text-[11px] text-muted-foreground">
                          Atualizado em {dataLonga(p.atualizadoEm)}
                        </span>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => abrirEdicao(p)}>
                              <Pencil className="size-4" />
                            </Button>
                            <ConfirmDelete onConfirm={() => excluir(p.id)} label="Excluir política" />
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? "Editar política" : "Nova política"}
        description="O conteúdo aceita quebras de linha e será exibido exatamente como escrito."
        onSubmit={salvar}
        submitting={submitting}
      >
        <Field label="Título" htmlFor="pol-titulo">
          <Input
            id="pol-titulo"
            value={form.titulo ?? ""}
            maxLength={160}
            placeholder="Ex.: Código de conduta"
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoria" htmlFor="pol-cat" hint="Agrupador (ex.: RH, Segurança).">
            <Input
              id="pol-cat"
              value={form.categoria ?? ""}
              maxLength={60}
              placeholder="Geral"
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
            />
          </Field>
          <Field label="Ordem" htmlFor="pol-ordem" hint="Menor aparece primeiro.">
            <Input
              id="pol-ordem"
              type="number"
              value={String(form.ordem ?? 0)}
              onChange={(e) => setForm((f) => ({ ...f, ordem: Number(e.target.value) }))}
            />
          </Field>
        </div>
        <Field label="Conteúdo" htmlFor="pol-conteudo">
          <Textarea
            id="pol-conteudo"
            rows={10}
            value={form.conteudo ?? ""}
            maxLength={8000}
            placeholder="Descreva a política. Use quebras de linha e marcadores (•) para organizar."
            onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
          />
        </Field>
      </FormDialog>
    </div>
  );
}
