// Página de Eventos: agenda de eventos/confraternizações com CRUD para admin.
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays, Plus, Pencil, MapPin, Clock,
  PartyPopper, Coffee, Users, GraduationCap, CalendarClock,
  ImagePlus, X,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Evento } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { comprimirImagem } from "@/lib/image";
import { diaSemana, faixaHorario } from "@/lib/format";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { FormDialog, Field, ConfirmDelete } from "@/components/portal/crud";
import { PerfisPicker, RestritoBadge } from "@/components/portal/PerfisPicker";
import { usePortal } from "@/context/PortalProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";

export const TIPO_META: Record<Evento["tipo"], { label: string; icon: LucideIcon; className: string }> = {
  "confraternizacao": { label: "Confraternização", icon: PartyPopper, className: "bg-primary/15 text-primary" },
  "happy-hour": { label: "Happy Hour", icon: Coffee, className: "bg-warning/15 text-warning" },
  "reuniao": { label: "Reunião", icon: Users, className: "bg-info/15 text-info" },
  "treinamento": { label: "Treinamento", icon: GraduationCap, className: "bg-success/15 text-success" },
  "outro": { label: "Outro", icon: CalendarClock, className: "bg-muted text-muted-foreground" },
};

const TIPOS = Object.keys(TIPO_META) as Evento["tipo"][];

// ISO -> valor de <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", horário local).
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" + p(d.getMonth() + 1) +
    "-" + p(d.getDate()) +
    "T" + p(d.getHours()) +
    ":" + p(d.getMinutes())
  );
}

interface FormState {
  titulo: string;
  descricao: string;
  tipo: Evento["tipo"];
  local: string;
  inicio: string;
  fim: string;
  imagem: string;
  /** Perfis de acesso que enxergam o evento (vazio = todos) — Fase 1 do RBAC. */
  perfis: string[];
}

const VAZIO: FormState = {
  titulo: "",
  descricao: "",
  tipo: "confraternizacao",
  local: "",
  inicio: "",
  fim: "",
  imagem: "",
  perfis: [],
};

export default function EventosPage() {
  // Gestão pelo RBAC (recurso "eventos"), não pelo isAdmin binário — o backend revalida.
  const { pode } = usePortal();
  const podeCriar = pode("eventos", "criar");
  const podeEditar = pode("eventos", "editar");
  const podeExcluir = pode("eventos", "excluir");
  const { data, loading, reload } = useAsync<Evento[]>(() => api.eventos.list());

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [submitting, setSubmitting] = useState(false);
  const [processandoImg, setProcessandoImg] = useState(false);

  // Comprime a foto escolhida e anexa (uma só; aparece no lugar da data).
  async function escolherImagem(files: FileList | null) {
    const f = files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    setProcessandoImg(true);
    try {
      const data = await comprimirImagem(f);
      setForm((s) => ({ ...s, imagem: data }));
    } finally {
      setProcessandoImg(false);
    }
  }

  function abrirNovo() {
    setEditId(null);
    setForm(VAZIO);
    setOpen(true);
  }

  function abrirEdicao(e: Evento) {
    setEditId(e.id);
    setForm({
      titulo: e.titulo,
      descricao: e.descricao,
      tipo: e.tipo,
      local: e.local,
      inicio: toLocalInput(e.inicio),
      fim: e.fim ? toLocalInput(e.fim) : "",
      imagem: e.imagem ?? "",
      perfis: e.perfis ?? [],
    });
    setOpen(true);
  }

  async function submeter() {
    if (!form.titulo.trim() || !form.inicio) return;
    setSubmitting(true);
    try {
      const payload: Partial<Evento> = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        local: form.local.trim(),
        inicio: new Date(form.inicio).toISOString(),
        fim: form.fim ? new Date(form.fim).toISOString() : undefined,
        imagem: form.imagem || undefined,
        perfis: form.perfis,
      };
      if (editId) await api.eventos.update(editId, payload);
      else await api.eventos.create(payload);
      await reload();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function excluir(id: string) {
    await api.eventos.remove(id);
    await reload();
  }

  const eventos = data ?? [];

  return (
    <div>
      <PageHeader
        icon={CalendarDays}
        title="Eventos"
        description="Agenda de eventos e confraternizações da empresa"
        action={
          podeCriar && (
            <Button onClick={abrirNovo}>
              <Plus className="size-4" />
              Novo evento
            </Button>
          )
        }
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : eventos.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhum evento agendado" />
      ) : (
        <div className="space-y-3">
          {eventos.map((e) => {
            const meta = TIPO_META[e.tipo];
            const Icon = meta.icon;
            const d = new Date(e.inicio);
            const mesAbrev = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
            return (
              <div
                key={e.id}
                className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                {e.imagem ? (
                  <img
                    src={e.imagem}
                    alt={e.titulo}
                    loading="lazy"
                    className="size-14 shrink-0 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="text-lg font-bold leading-none">{d.getDate()}</span>
                    <span className="text-xs capitalize">{mesAbrev}</span>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Badge className={`mb-1.5 gap-1 border-transparent ${meta.className}`}>
                        <Icon className="size-3" />
                        {meta.label}
                      </Badge>
                      <RestritoBadge perfis={e.perfis} className="ml-1.5" />
                      <h3 className="font-semibold text-foreground">
                        <Link to={`/eventos/${e.id}`} className="hover:text-primary hover:underline">
                          {e.titulo}
                        </Link>
                      </h3>
                      {e.descricao && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{e.descricao}</p>
                      )}
                    </div>

                    {(podeEditar || podeExcluir) && (
                      <div className="flex shrink-0 items-center gap-1">
                        {podeEditar && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => abrirEdicao(e)}
                            aria-label="Editar evento"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {podeExcluir && (
                          <ConfirmDelete label="Excluir evento" onConfirm={() => excluir(e.id)} />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      <span className="capitalize">{diaSemana(e.inicio)}</span>
                      {" · "}
                      {faixaHorario(e.inicio, e.fim)}
                    </span>
                    {e.local && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {e.local}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editId ? "Editar evento" : "Novo evento"}
        description="Preencha os dados do evento. Título e início são obrigatórios."
        submitLabel={editId ? "Salvar alterações" : "Criar evento"}
        submitting={submitting}
        onSubmit={submeter}
      >
        <Field label="Título" htmlFor="ev-titulo">
          <Input
            id="ev-titulo"
            value={form.titulo}
            onChange={(ev) => setForm((f) => ({ ...f, titulo: ev.target.value }))}
            placeholder="Ex.: Confraternização de fim de ano"
            required
          />
        </Field>

        <Field label="Descrição" htmlFor="ev-descricao">
          <Textarea
            id="ev-descricao"
            rows={3}
            value={form.descricao}
            onChange={(ev) => setForm((f) => ({ ...f, descricao: ev.target.value }))}
            placeholder="Detalhes do evento"
          />
        </Field>

        <Field label="Tipo" htmlFor="ev-tipo">
          <NativeSelect
            id="ev-tipo"
            className="w-full"
            value={form.tipo}
            onChange={(ev) => setForm((f) => ({ ...f, tipo: ev.target.value as Evento["tipo"] }))}
          >
            {TIPOS.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {TIPO_META[t].label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Local" htmlFor="ev-local">
          <Input
            id="ev-local"
            value={form.local}
            onChange={(ev) => setForm((f) => ({ ...f, local: ev.target.value }))}
            placeholder="Ex.: Auditório / Restaurante X"
          />
        </Field>

        <Field label="Foto" htmlFor="ev-imagem" hint="Opcional — aparece no lugar da data.">
          <div className="flex items-center gap-3">
            {form.imagem && (
              <div className="group relative size-20 overflow-hidden rounded-lg border border-border bg-secondary">
                <img src={form.imagem} alt="Foto do evento" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imagem: "" }))}
                  aria-label="Remover foto"
                  className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            {!form.imagem && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                <ImagePlus className="size-4" />
                {processandoImg ? "Processando…" : "Adicionar foto"}
                <input
                  id="ev-imagem"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={processandoImg}
                  onChange={(ev) => {
                    void escolherImagem(ev.target.files);
                    ev.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início" htmlFor="ev-inicio">
            <Input
              id="ev-inicio"
              type="datetime-local"
              value={form.inicio}
              onChange={(ev) => setForm((f) => ({ ...f, inicio: ev.target.value }))}
              required
            />
          </Field>

          <Field label="Fim" htmlFor="ev-fim" hint="Opcional">
            <Input
              id="ev-fim"
              type="datetime-local"
              value={form.fim}
              onChange={(ev) => setForm((f) => ({ ...f, fim: ev.target.value }))}
            />
          </Field>
        </div>

        {/* Evento restrito a perfis de acesso (vazio = visível a todos). */}
        <PerfisPicker
          valor={form.perfis}
          onChange={(perfis) => setForm((f) => ({ ...f, perfis }))}
        />
      </FormDialog>
    </div>
  );
}
