// CRUD de BIBLIOTECAS DE DOCUMENTOS (Fase 2 do PLANO-INTRANET.md).
//
// Cada biblioteca é uma PASTA COMPARTILHADA do SharePoint/OneDrive (Marketing, Templates,
// Institucional…) que o portal apenas LISTA — os arquivos continuam morando lá, com as
// permissões de lá. O admin cadastra nome + link de compartilhamento AQUI (nada de env por
// pasta) e opcionalmente restringe a biblioteca a perfis de acesso.
//
// Requisito de infraestrutura: o app registration precisa de `Sites.Read.All` (Application)
// — a mesma permissão já usada pelas Políticas internas.
import { useState } from "react";
import { FolderOpen, Plus, Pencil, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { Biblioteca } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Field, FormDialog, ConfirmDelete } from "@/components/portal/crud";
import { EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { PerfisPicker, RestritoBadge } from "@/components/portal/PerfisPicker";
import { BibliotecaIcone, BIBLIOTECA_ICON_OPCOES } from "@/components/portal/shared";

interface FormState {
  nome: string;
  descricao: string;
  shareUrl: string;
  icone: string;
  perfis: string[];
}

const VAZIO: FormState = { nome: "", descricao: "", shareUrl: "", icone: "folder", perfis: [] };

export function BibliotecasAdmin() {
  const { data, loading, reload } = useAsync(() => api.bibliotecas.list(), []);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Biblioteca | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const lista = data ?? [];

  const abrirNovo = () => {
    setEditando(null);
    setErro(null);
    setForm(VAZIO);
    setAberto(true);
  };

  const abrirEdicao = (b: Biblioteca) => {
    setEditando(b);
    setErro(null);
    setForm({
      nome: b.nome,
      descricao: b.descricao ?? "",
      shareUrl: b.shareUrl,
      icone: b.icone ?? "folder",
      perfis: b.perfis ?? [],
    });
    setAberto(true);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.shareUrl.trim()) {
      setErro("Informe o nome e o link de compartilhamento da pasta.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const corpo = { ...form, descricao: form.descricao.trim() || undefined };
      if (editando) await api.bibliotecas.update(editando.id, corpo);
      else await api.bibliotecas.create(corpo);
      await reload();
      setAberto(false);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string) => {
    await api.bibliotecas.remove(id);
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Cada biblioteca é uma pasta compartilhada do SharePoint/OneDrive listada em{" "}
          <strong className="font-medium text-foreground">Documentos</strong>. O portal só lê os
          arquivos (nada é copiado) e cada subpasta vira uma categoria.
        </p>
        <Button onClick={abrirNovo}>
          <Plus className="size-4" /> Nova biblioteca
        </Button>
      </div>

      {loading ? (
        <ListSkeleton rows={2} />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nenhuma biblioteca cadastrada"
          description="Adicione a pasta de Marketing, de templates ou institucional: copie o link de compartilhamento no SharePoint e cadastre aqui."
          action={
            <Button onClick={abrirNovo}>
              <Plus className="size-4" /> Nova biblioteca
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {lista.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <BibliotecaIcone nome={b.icone} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{b.nome}</p>
                  <RestritoBadge perfis={b.perfis} />
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {b.descricao ? `${b.descricao} · ` : ""}
                  {b.shareUrl}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  render={
                    <a href={b.shareUrl} target="_blank" rel="noreferrer" title="Abrir pasta no SharePoint">
                      <ExternalLink className="size-4" />
                    </a>
                  }
                />
                <Button variant="ghost" size="icon" onClick={() => abrirEdicao(b)} title="Editar">
                  <Pencil className="size-4" />
                </Button>
                <ConfirmDelete onConfirm={() => excluir(b.id)} label="Excluir biblioteca" />
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={aberto}
        onOpenChange={setAberto}
        title={editando ? "Editar biblioteca" : "Nova biblioteca"}
        description="Aponte para uma pasta compartilhada do SharePoint/OneDrive. Os arquivos permanecem lá."
        onSubmit={salvar}
        submitting={salvando}
      >
        {erro && <p className="text-xs text-destructive">{erro}</p>}
        <Field label="Nome" htmlFor="bib-nome">
          <Input
            id="bib-nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder="Ex.: Marketing"
          />
        </Field>
        <Field
          label="Link de compartilhamento da pasta"
          htmlFor="bib-url"
          hint="No SharePoint/OneDrive: botão Compartilhar › Copiar link (a pasta, não um arquivo)."
        >
          <Input
            id="bib-url"
            value={form.shareUrl}
            onChange={(e) => setForm((f) => ({ ...f, shareUrl: e.target.value }))}
            placeholder="https://trustsis.sharepoint.com/:f:/s/…"
          />
        </Field>
        <Field label="Descrição" htmlFor="bib-desc">
          <Textarea
            id="bib-desc"
            rows={2}
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            placeholder="Templates de apresentação, assinaturas de e-mail…"
          />
        </Field>
        <Field label="Ícone" htmlFor="bib-icone">
          <NativeSelect
            id="bib-icone"
            className="w-full"
            value={form.icone}
            onChange={(e) => setForm((f) => ({ ...f, icone: e.target.value }))}
          >
            {BIBLIOTECA_ICON_OPCOES.map(([k, label]) => (
              <NativeSelectOption key={k} value={k}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <PerfisPicker
          valor={form.perfis}
          onChange={(perfis) => setForm((f) => ({ ...f, perfis }))}
          label="Quem enxerga esta biblioteca"
        />
      </FormDialog>
    </div>
  );
}
