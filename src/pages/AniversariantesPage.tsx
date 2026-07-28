// Página de aniversariantes: filtro por mês, grid de cards e CRUD de admin.
import { useMemo, useState } from "react";
import { Cake, Plus, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import type { Aniversariante } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { iniciais } from "@/lib/format";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { FormDialog, Field, ConfirmDelete } from "@/components/portal/crud";
import { usePortal } from "@/context/PortalProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function AniversariantesPage() {
  const { isAdmin } = usePortal();
  const { data, loading, reload } = useAsync(() => api.aniversariantes.list(), []);

  const [mesFiltro, setMesFiltro] = useState<number>(new Date().getMonth() + 1);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Aniversariante>>({});
  const [submitting, setSubmitting] = useState(false);

  const filtrados = useMemo(() => {
    return (data ?? [])
      .filter((a) => a.mes === mesFiltro)
      .sort((a, b) => a.dia - b.dia);
  }, [data, mesFiltro]);

  function abrirNovo() {
    setEditId(null);
    setForm({ mes: mesFiltro });
    setOpen(true);
  }

  function abrirEdicao(a: Aniversariante) {
    setEditId(a.id);
    setForm({ nome: a.nome, area: a.area, dia: a.dia, mes: a.mes, fotoUrl: a.fotoUrl });
    setOpen(true);
  }

  async function submeter() {
    if (!form.nome?.trim() || !form.dia || !form.mes) return;
    const payload: Partial<Aniversariante> = {
      nome: form.nome.trim(),
      area: form.area?.trim() ?? "",
      dia: Number(form.dia),
      mes: Number(form.mes),
      fotoUrl: form.fotoUrl?.trim() || undefined,
    };
    setSubmitting(true);
    try {
      if (editId) await api.aniversariantes.update(editId, payload);
      else await api.aniversariantes.create(payload);
      await reload();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function excluir(id: string) {
    await api.aniversariantes.remove(id);
    await reload();
  }

  return (
    <div>
      <PageHeader
        icon={Cake}
        title="Aniversariantes"
        description={`Celebre com quem faz aniversário em ${MESES[mesFiltro - 1]}`}
        action={
          <div className="flex gap-2">
            <NativeSelect
              value={mesFiltro}
              onChange={(e) => setMesFiltro(Number(e.target.value))}
              aria-label="Filtrar por mês"
            >
              {MESES.map((m, i) => (
                <NativeSelectOption key={i} value={i + 1}>
                  {capitalizar(m)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {isAdmin && (
              <Button onClick={abrirNovo}>
                <Plus /> Adicionar
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <ListSkeleton />
      ) : filtrados.length === 0 ? (
        <EmptyState icon={Cake} title="Nenhum aniversariante neste mês" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  {a.fotoUrl && <AvatarImage src={a.fotoUrl} alt={a.nome} />}
                  <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                    {iniciais(a.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{a.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.area}</p>
                </div>
                <div className="ml-auto flex flex-col items-center rounded-lg bg-primary/10 px-2.5 py-1 text-primary">
                  <span className="text-base font-bold leading-none">{a.dia}</span>
                  <span className="text-[10px] uppercase">{MESES[a.mes - 1].slice(0, 3)}</span>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center justify-end gap-1 border-t border-border pt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => abrirEdicao(a)}
                    aria-label="Editar aniversariante"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDelete
                    label="Remover aniversariante"
                    onConfirm={() => excluir(a.id)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? "Editar aniversariante" : "Adicionar aniversariante"}
        onSubmit={submeter}
        submitting={submitting}
      >
        <Field label="Nome" htmlFor="aniv-nome">
          <Input
            id="aniv-nome"
            value={form.nome ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            required
          />
        </Field>
        <Field label="Área" htmlFor="aniv-area">
          <Input
            id="aniv-area"
            value={form.area ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia" htmlFor="aniv-dia">
            <Input
              id="aniv-dia"
              type="number"
              min={1}
              max={31}
              value={form.dia ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, dia: Number(e.target.value) }))}
              required
            />
          </Field>
          <Field label="Mês" htmlFor="aniv-mes">
            <NativeSelect
              id="aniv-mes"
              className="w-full"
              value={form.mes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, mes: Number(e.target.value) }))}
              required
            >
              <NativeSelectOption value="" disabled>
                Selecione
              </NativeSelectOption>
              {MESES.map((m, i) => (
                <NativeSelectOption key={i} value={i + 1}>
                  {capitalizar(m)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Foto" htmlFor="aniv-foto" hint="URL da foto (opcional)">
          <Input
            id="aniv-foto"
            value={form.fotoUrl ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, fotoUrl: e.target.value }))}
          />
        </Field>
      </FormDialog>
    </div>
  );
}
