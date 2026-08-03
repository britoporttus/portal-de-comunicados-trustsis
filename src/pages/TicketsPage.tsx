// Aba de Tickets (chamados) — EM CONSTRUÇÃO. É o balcão de abertura + acompanhamento do
// colaborador: cada um abre e vê SÓ os seus chamados (status, nome, responsável e data de
// início). A gestão detalhada (workflow, SLA, atribuição de técnico) roda na plataforma
// trustsis-itsm; quando a API dela estiver acessível, sincronizamos por Ticket.externoRef.
import { useState } from "react";
import { Ticket as TicketIcon, Plus, HardHat, Clock, UserCog, Hash } from "lucide-react";
import { api } from "@/lib/api";
import type { Ticket, TicketStatus, TicketPrioridade, TicketTipo } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { dataLonga } from "@/lib/format";
import { usePortal } from "@/context/PortalProvider";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormDialog, Field } from "@/components/portal/crud";

// Metadados visuais (rótulo + classes por token — nada hardcoded).
const STATUS_META: Record<TicketStatus, { label: string; className: string }> = {
  aberto: { label: "Aberto", className: "bg-info/15 text-info border-info/30" },
  em_andamento: { label: "Em andamento", className: "bg-primary/15 text-primary border-primary/30" },
  aguardando: { label: "Aguardando", className: "bg-warning/15 text-warning border-warning/30" },
  resolvido: { label: "Resolvido", className: "bg-success/15 text-success border-success/30" },
  fechado: { label: "Fechado", className: "bg-muted text-muted-foreground border-border" },
  cancelado: { label: "Cancelado", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

const PRIO_META: Record<TicketPrioridade, { label: string; className: string; dot: string }> = {
  baixa: { label: "Baixa", className: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
  media: { label: "Média", className: "bg-info/15 text-info border-info/30", dot: "bg-info" },
  alta: { label: "Alta", className: "bg-warning/15 text-warning border-warning/30", dot: "bg-warning" },
  critica: { label: "Crítica", className: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
};

const TIPO_LABEL: Record<TicketTipo, string> = {
  incidente: "Incidente",
  requisicao: "Requisição",
};

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className ?? ""}`}>
      {children}
    </span>
  );
}

function CartaoTicket({ t }: { t: Ticket }) {
  const st = STATUS_META[t.status];
  const pr = PRIO_META[t.prioridade];
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Hash className="size-3" />
            <span>{t.numero}</span>
            <span className="text-border">·</span>
            <span>{TIPO_LABEL[t.tipo]}</span>
          </div>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">{t.titulo}</h3>
        </div>
        <Chip className={st.className}>{st.label}</Chip>
      </div>

      {t.descricao && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.descricao}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${pr.dot}`} />
          Prioridade {pr.label}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UserCog className="size-3.5" />
          {t.responsavel?.trim() || "Aguardando triagem"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" />
          Aberto em {dataLonga(t.criadoEm)}
        </span>
        {t.externoRef && <Chip className="border-border bg-secondary text-secondary-foreground">ITSM {t.externoRef}</Chip>}
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const { me } = usePortal();
  const { data, loading, reload } = useAsync(() => api.tickets.list(me?.email), [me?.email]);
  const tickets = data ?? [];

  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TicketTipo>("incidente");
  const [prioridade, setPrioridade] = useState<TicketPrioridade>("media");
  const [salvando, setSalvando] = useState(false);

  const abrirNovo = () => {
    setTitulo("");
    setDescricao("");
    setTipo("incidente");
    setPrioridade("media");
    setAberto(true);
  };

  const salvar = async () => {
    if (!titulo.trim() || salvando) return;
    setSalvando(true);
    try {
      await api.tickets.create(
        { titulo: titulo.trim(), descricao: descricao.trim(), tipo, prioridade, solicitanteNome: me?.nome ?? "Colaborador" },
        me?.email,
      );
      setAberto(false);
      await reload();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TicketIcon}
        title="Tickets"
        description="Abra e acompanhe seus chamados de suporte."
        action={
          <Button onClick={abrirNovo}>
            <Plus className="size-4" /> Abrir novo ticket
          </Button>
        }
      />

      {/* Aviso: recurso em construção — a gestão detalhada virá do trustsis-itsm. */}
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
        <HardHat className="mt-0.5 size-5 shrink-0 text-warning" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Em construção</p>
          <p className="mt-0.5 text-muted-foreground">
            Aqui você já pode registrar e acompanhar seus chamados. A gestão completa (triagem,
            atribuição de responsável e andamento) passará a ser feita na plataforma de tickets da
            TrustSis, integrada em breve.
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Meus tickets</h3>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={TicketIcon}
            title="Você ainda não tem chamados"
            description="Abra um novo ticket para registrar uma solicitação ou reportar um problema."
            action={
              <Button onClick={abrirNovo}>
                <Plus className="size-4" /> Abrir novo ticket
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tickets.map((t) => <CartaoTicket key={t.id} t={t} />)}
          </div>
        )}
      </div>

      <FormDialog
        open={aberto}
        onOpenChange={setAberto}
        title="Abrir novo ticket"
        description="Descreva sua solicitação. Nossa equipe fará a triagem e o acompanhamento."
        onSubmit={salvar}
        submitLabel="Abrir ticket"
        submitting={salvando}
      >
        <Field label="Título" htmlFor="tkt-titulo">
          <Input
            id="tkt-titulo"
            value={titulo}
            maxLength={160}
            placeholder="Ex.: Sem acesso à VPN corporativa"
            onChange={(e) => setTitulo(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo" htmlFor="tkt-tipo">
            <NativeSelect
              id="tkt-tipo"
              className="w-full"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TicketTipo)}
            >
              <NativeSelectOption value="incidente">Incidente (algo não funciona)</NativeSelectOption>
              <NativeSelectOption value="requisicao">Requisição (pedir um serviço)</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Prioridade" htmlFor="tkt-prio">
            <NativeSelect
              id="tkt-prio"
              className="w-full"
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as TicketPrioridade)}
            >
              <NativeSelectOption value="baixa">Baixa</NativeSelectOption>
              <NativeSelectOption value="media">Média</NativeSelectOption>
              <NativeSelectOption value="alta">Alta</NativeSelectOption>
              <NativeSelectOption value="critica">Crítica</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
        <Field label="Descrição" htmlFor="tkt-desc" hint="Quanto mais detalhes, mais rápida a resolução.">
          <Textarea
            id="tkt-desc"
            rows={5}
            value={descricao}
            maxLength={4000}
            placeholder="Descreva o que aconteceu, desde quando, e o impacto no seu trabalho."
            onChange={(e) => setDescricao(e.target.value)}
          />
        </Field>
      </FormDialog>
    </div>
  );
}
