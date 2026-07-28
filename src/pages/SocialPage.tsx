// Página de Redes sociais: últimas publicações da TrustSis com CRUD para administradores.
import { useState } from "react";
import { Share2, Plus, Pencil, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicacaoSocial } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { tempoRelativo } from "@/lib/format";
import { RedeIcon } from "@/components/portal/shared";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { FormDialog, Field, ConfirmDelete } from "@/components/portal/crud";
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
};

export default function SocialPage() {
  const { isAdmin } = usePortal();
  const { data, loading, reload } = useAsync(() => api.social.list());

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
          isAdmin && (
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
                  <p className="text-xs text-muted-foreground">
                    {tempoRelativo(p.publicadoEm)}
                  </p>
                </div>

                {isAdmin && (
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => abrirEdicao(p)}>
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDelete
                      onConfirm={() => excluir(p.id)}
                      label="Excluir publicação"
                    />
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
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  Ver publicação <ExternalLink className="size-3.5" />
                </a>
              </div>
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
      </FormDialog>
    </div>
  );
}
