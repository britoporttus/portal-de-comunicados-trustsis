// Página de aniversariantes: filtro por mês, grid de cards e CRUD de admin.
import { useMemo, useRef, useState } from "react";
import { Cake, Plus, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import type { Aniversariante, Pessoa } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { iniciais } from "@/lib/format";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { FormDialog, Field, ConfirmDelete } from "@/components/portal/crud";
import { usePortal } from "@/context/PortalProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Droplist } from "@/components/ui/droplist";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** Campo de nome com busca no diretório do Entra: filtra por nome e, ao escolher,
 *  devolve a pessoa para autopreencher área e foto. Também aceita texto livre. */
function PersonPicker({
  value,
  pessoas,
  onText,
  onPick,
}: {
  value: string;
  pessoas: Pessoa[];
  onText: (nome: string) => void;
  onPick: (p: Pessoa) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const fecharRef = useRef<number | null>(null);

  const sugestoes = useMemo(() => {
    const termo = value.trim().toLowerCase();
    const base = termo
      ? pessoas.filter((p) => p.nome.toLowerCase().includes(termo))
      : pessoas;
    return base.slice(0, 8);
  }, [value, pessoas]);

  return (
    <div className="relative">
      <Input
        id="aniv-nome"
        value={value}
        autoComplete="off"
        placeholder={pessoas.length ? "Digite para buscar no diretório…" : "Nome do aniversariante"}
        onChange={(e) => {
          onText(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => {
          // Pequeno atraso para permitir o clique numa sugestão antes de fechar.
          fecharRef.current = window.setTimeout(() => setAberto(false), 150);
        }}
        required
      />
      {aberto && pessoas.length > 0 && sugestoes.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
          {sugestoes.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(p);
                  if (fecharRef.current) window.clearTimeout(fecharRef.current);
                  setAberto(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary"
              >
                <Avatar className="size-8 shrink-0">
                  {p.fotoUrl && <AvatarImage src={p.fotoUrl} alt={p.nome} />}
                  <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
                    {iniciais(p.nome)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{p.nome}</span>
                  {p.area && <span className="block truncate text-xs text-muted-foreground">{p.area}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Opções de mês para o Droplist — valor NUMÉRICO (1–12), igual ao campo `mes` do registro. */
const MES_OPTIONS = MESES.map((m, i) => ({ value: i + 1, label: capitalizar(m) }));

export default function AniversariantesPage() {
  // Gestão pelo RBAC (recurso "aniversariantes"); o backend revalida.
  const { pode } = usePortal();
  // Aniversários do Entra (campo birthday) são mesclados com os cadastrados manualmente,
  // então o admin sempre pode adicionar quem faltar — inclusive em modo Graph.
  const editavel = pode("aniversariantes", "editar") || pode("aniversariantes", "criar");
  const { data, loading, reload } = useAsync(() => api.aniversariantes.list(), []);
  // Diretório do Entra para o seletor de nome (só admin, que é quem cadastra).
  const { data: org } = useAsync(() => (editavel ? api.org() : Promise.resolve(null)), [editavel]);
  const pessoas = useMemo(() => org?.diretorio ?? [], [org]);

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
            <Droplist
              value={mesFiltro}
              onChange={(v) => setMesFiltro(v)}
              options={MES_OPTIONS}
              aria-label="Filtrar por mês"
            />
            {editavel && (
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

              {editavel && (
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
        <Field label="Nome" htmlFor="aniv-nome" hint={pessoas.length ? "Busque a pessoa no diretório — área e foto são preenchidas automaticamente." : undefined}>
          <PersonPicker
            value={form.nome ?? ""}
            pessoas={pessoas}
            onText={(nome) => setForm((f) => ({ ...f, nome }))}
            onPick={(p) =>
              setForm((f) => ({ ...f, nome: p.nome, area: p.area ?? "", fotoUrl: p.fotoUrl }))
            }
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
            <Droplist
              id="aniv-mes"
              className="w-full"
              value={form.mes ?? null}
              onChange={(v) => setForm((f) => ({ ...f, mes: v }))}
              options={MES_OPTIONS}
              placeholder="Selecione"
              required
            />
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
