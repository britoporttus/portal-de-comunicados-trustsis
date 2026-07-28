// Página Links úteis: atalhos para sistemas internos. Admin gerencia (CRUD).
import { useState } from "react";
import { LayoutGrid, Plus, Pencil, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import type { LinkUtil } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { iconForLink } from "@/components/portal/shared";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { FormDialog, Field, ConfirmDelete } from "@/components/portal/crud";
import { usePortal } from "@/context/PortalProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const ICON_OPCOES = [
  ["link", "Link genérico"],
  ["mail", "E-mail"],
  ["users", "Pessoas"],
  ["cloud", "Nuvem"],
  ["folder", "Arquivos"],
  ["layout-grid", "Aplicações"],
  ["life-buoy", "Suporte"],
  ["calendar", "Calendário"],
  ["video", "Vídeo/Reunião"],
] as const;

const FORM_INICIAL: Partial<LinkUtil> = { label: "", url: "", icon: "link" };

export default function LinksPage() {
  const { isAdmin } = usePortal();
  const { data, loading, reload } = useAsync(() => api.links.list());

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<LinkUtil>>(FORM_INICIAL);
  const [submitting, setSubmitting] = useState(false);

  const abrirNovo = () => {
    setEditId(null);
    setForm(FORM_INICIAL);
    setOpen(true);
  };

  const abrirEdicao = (l: LinkUtil) => {
    setEditId(l.id);
    setForm({ label: l.label, url: l.url, icon: l.icon });
    setOpen(true);
  };

  const salvar = async () => {
    if (!form.label?.trim() || !form.url?.trim()) return;
    setSubmitting(true);
    try {
      if (editId) await api.links.update(editId, form);
      else await api.links.create(form);
      await reload();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const excluir = async (id: string) => {
    await api.links.remove(id);
    await reload();
  };

  const links = data ?? [];

  return (
    <div>
      <PageHeader
        icon={LayoutGrid}
        title="Links úteis"
        description="Atalhos para sistemas e ferramentas internas"
        action={
          isAdmin && (
            <Button onClick={abrirNovo}>
              <Plus className="size-4" /> Novo link
            </Button>
          )
        }
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : links.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Nenhum link cadastrado"
          description="Adicione atalhos para os sistemas que o time mais usa."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => {
            const Icon = iconForLink(l.icon);
            return (
              <div
                key={l.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="size-5" />
                </span>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1"
                >
                  <div className="flex items-center gap-1 font-semibold text-foreground">
                    <span className="truncate">{l.label}</span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{l.url}</p>
                </a>
                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => abrirEdicao(l)}>
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDelete onConfirm={() => excluir(l.id)} label="Excluir link" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? "Editar link" : "Novo link"}
        description="Cadastre um atalho para um sistema interno."
        onSubmit={salvar}
        submitting={submitting}
      >
        <Field label="Nome" htmlFor="lk-label">
          <Input
            id="lk-label"
            value={form.label ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Ex.: Ponto eletrônico"
          />
        </Field>
        <Field label="URL" htmlFor="lk-url">
          <Input
            id="lk-url"
            value={form.url ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://…"
          />
        </Field>
        <Field label="Ícone" htmlFor="lk-icon">
          <NativeSelect
            id="lk-icon"
            className="w-full"
            value={form.icon ?? "link"}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
          >
            {ICON_OPCOES.map(([k, label]) => (
              <NativeSelectOption key={k} value={k}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </FormDialog>
    </div>
  );
}
