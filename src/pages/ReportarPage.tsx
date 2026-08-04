// Feedback do portal: canal para o colaborador reportar um BUG, sugerir uma MELHORIA ou
// enviar outro comentário sobre a PRÓPRIA aplicação (distinto do Feedback entre colegas).
// O autor acompanha os que abriu; o admin vê todos, muda o status e remove os já tratados.
import { useState } from "react";
import {
  MessageSquareWarning, Plus, Bug, Lightbulb, MessageCircle, Clock, MapPin, User,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Reporte, ReporteTipo, ReporteStatus } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { dataLonga } from "@/lib/format";
import { usePortal } from "@/context/PortalProvider";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { FormDialog, Field, ConfirmDelete } from "@/components/portal/crud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const TIPO_META: Record<ReporteTipo, { label: string; icon: typeof Bug; className: string }> = {
  bug: { label: "Bug", icon: Bug, className: "bg-destructive/15 text-destructive border-destructive/30" },
  melhoria: { label: "Melhoria", icon: Lightbulb, className: "bg-info/15 text-info border-info/30" },
  outro: { label: "Outro", icon: MessageCircle, className: "bg-muted text-muted-foreground border-border" },
};

const STATUS_META: Record<ReporteStatus, { label: string; className: string }> = {
  aberto: { label: "Aberto", className: "bg-info/15 text-info border-info/30" },
  em_analise: { label: "Em análise", className: "bg-warning/15 text-warning border-warning/30" },
  resolvido: { label: "Resolvido", className: "bg-success/15 text-success border-success/30" },
  arquivado: { label: "Arquivado", className: "bg-muted text-muted-foreground border-border" },
};

const STATUS_ORDEM: ReporteStatus[] = ["aberto", "em_analise", "resolvido", "arquivado"];

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className ?? ""}`}>
      {children}
    </span>
  );
}

function CartaoReporte({
  r, isAdmin, onStatus, onDelete,
}: {
  r: Reporte;
  isAdmin: boolean;
  onStatus: (id: string, s: ReporteStatus) => void;
  onDelete: (id: string) => void;
}) {
  const tm = TIPO_META[r.tipo];
  const sm = STATUS_META[r.status];
  const Icon = tm.icon;
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Chip className={tm.className}><Icon className="size-3" /> {tm.label}</Chip>
            <Chip className={sm.className}>{sm.label}</Chip>
          </div>
          <h3 className="truncate text-sm font-semibold text-foreground">
            {r.titulo || "(sem título)"}
          </h3>
        </div>
      </div>

      <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{r.mensagem}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" /> {dataLonga(r.criadoEm)}
        </span>
        {r.pagina && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {r.pagina}
          </span>
        )}
        {isAdmin && (
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3.5" /> {r.deNome}
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
          <NativeSelect
            className="h-8 w-auto text-xs"
            value={r.status}
            onChange={(e) => onStatus(r.id, e.target.value as ReporteStatus)}
          >
            {STATUS_ORDEM.map((s) => (
              <NativeSelectOption key={s} value={s}>{STATUS_META[s].label}</NativeSelectOption>
            ))}
          </NativeSelect>
          <ConfirmDelete onConfirm={() => onDelete(r.id)} label="Excluir reporte" />
        </div>
      )}
    </div>
  );
}

const FORM_INICIAL = { tipo: "bug" as ReporteTipo, titulo: "", mensagem: "", pagina: "" };

export default function ReportarPage() {
  const { me, isAdmin } = usePortal();
  const upn = me?.email;
  const { data, loading, reload } = useAsync(() => api.reportes.list(upn), [upn]);
  const reportes = data ?? [];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [submitting, setSubmitting] = useState(false);

  const abrirNovo = () => {
    setForm(FORM_INICIAL);
    setOpen(true);
  };

  const salvar = async () => {
    if (!form.mensagem.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.reportes.create(
        {
          tipo: form.tipo,
          titulo: form.titulo.trim(),
          mensagem: form.mensagem.trim(),
          pagina: form.pagina.trim() || undefined,
          deNome: me?.nome ?? "Colaborador",
        },
        upn,
      );
      await reload();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const mudarStatus = async (id: string, status: ReporteStatus) => {
    await api.reportes.updateStatus(id, status, upn);
    await reload();
  };

  const excluir = async (id: string) => {
    await api.reportes.remove(id, upn);
    await reload();
  };

  return (
    <div>
      <PageHeader
        icon={MessageSquareWarning}
        title="Feedback do portal"
        description={
          isAdmin
            ? "Bugs e melhorias reportados pelo time — faça a triagem e acompanhe a resolução"
            : "Encontrou um problema ou tem uma ideia para o portal? Conte pra gente"
        }
        action={
          <Button onClick={abrirNovo}>
            <Plus className="size-4" /> Novo feedback
          </Button>
        }
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : reportes.length === 0 ? (
        <EmptyState
          icon={MessageSquareWarning}
          title={isAdmin ? "Nenhum feedback recebido" : "Você ainda não enviou feedback"}
          description={
            isAdmin
              ? "Os relatos de bugs e sugestões de melhoria do time aparecerão aqui."
              : "Reporte um bug, sugira uma melhoria ou deixe um comentário sobre o portal."
          }
          action={
            <Button onClick={abrirNovo}>
              <Plus className="size-4" /> Novo feedback
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {reportes.map((r) => (
            <CartaoReporte
              key={r.id}
              r={r}
              isAdmin={isAdmin}
              onStatus={mudarStatus}
              onDelete={excluir}
            />
          ))}
        </div>
      )}

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Enviar feedback do portal"
        description="Sua mensagem vai direto para a equipe que cuida do portal."
        onSubmit={salvar}
        submitLabel="Enviar"
        submitting={submitting}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo" htmlFor="rep-tipo">
            <NativeSelect
              id="rep-tipo"
              className="w-full"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as ReporteTipo }))}
            >
              <NativeSelectOption value="bug">Bug (algo não funciona)</NativeSelectOption>
              <NativeSelectOption value="melhoria">Melhoria (uma ideia)</NativeSelectOption>
              <NativeSelectOption value="outro">Outro</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Página" htmlFor="rep-pagina" hint="Onde ocorreu (opcional).">
            <Input
              id="rep-pagina"
              value={form.pagina}
              maxLength={120}
              placeholder="Ex.: Organograma"
              onChange={(e) => setForm((f) => ({ ...f, pagina: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Título" htmlFor="rep-titulo" hint="Um resumo curto (opcional).">
          <Input
            id="rep-titulo"
            value={form.titulo}
            maxLength={160}
            placeholder="Ex.: Botão de exportar não responde"
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
          />
        </Field>
        <Field label="Mensagem" htmlFor="rep-msg" hint="Descreva o que aconteceu ou a sua sugestão.">
          <Textarea
            id="rep-msg"
            rows={6}
            value={form.mensagem}
            maxLength={4000}
            placeholder="Conte os detalhes: o que você esperava, o que aconteceu e como reproduzir."
            onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
          />
        </Field>
      </FormDialog>
    </div>
  );
}
