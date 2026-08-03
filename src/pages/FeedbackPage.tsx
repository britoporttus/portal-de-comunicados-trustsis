// Aba de Feedback (gamificação): envie um reconhecimento a um colega e acompanhe o que
// você recebeu/enviou, além do mural recente. Receber feedback rende pontos no ranking.
import { useMemo, useRef, useState } from "react";
import { MessageSquareHeart, Send, Inbox, Heart, Users, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Pessoa, Feedback } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { iniciais, tempoRelativo } from "@/lib/format";
import { usePortal } from "@/context/PortalProvider";
import { PageHeader, EmptyState } from "@/components/portal/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

/** Seletor de colega no diretório (busca por nome; devolve a pessoa escolhida). */
function ColegaPicker({
  pessoas, selecionado, onPick, onLimpar,
}: {
  pessoas: Pessoa[];
  selecionado: Pessoa | null;
  onPick: (p: Pessoa) => void;
  onLimpar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const fecharRef = useRef<number | null>(null);

  const sugestoes = useMemo(() => {
    const termo = texto.trim().toLowerCase();
    const base = termo ? pessoas.filter((p) => p.nome.toLowerCase().includes(termo)) : pessoas;
    return base.slice(0, 8);
  }, [texto, pessoas]);

  if (selecionado) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2">
        <Avatar className="size-9 shrink-0">
          {selecionado.fotoUrl && <AvatarImage src={selecionado.fotoUrl} alt={selecionado.nome} />}
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
            {iniciais(selecionado.nome)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{selecionado.nome}</p>
          {selecionado.area && <p className="truncate text-xs text-muted-foreground">{selecionado.area}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={onLimpar}>Trocar</Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={texto}
        autoComplete="off"
        placeholder="Busque um colega pelo nome…"
        onChange={(e) => { setTexto(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => { fecharRef.current = window.setTimeout(() => setAberto(false), 150); }}
      />
      {aberto && sugestoes.length > 0 && (
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

/** Avatar pequeno com foto (quando houver) e fallback de iniciais. */
function FotoMini({ nome, foto, className }: { nome: string; foto?: string; className?: string }) {
  return (
    <Avatar className={className ?? "size-9 shrink-0"}>
      {foto && <AvatarImage src={foto} alt={nome} />}
      <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
        {iniciais(nome)}
      </AvatarFallback>
    </Avatar>
  );
}

function CartaoFeedback({
  f, tipo, onDelete,
}: {
  f: Feedback;
  tipo: "recebido" | "enviado" | "mural";
  onDelete?: (f: Feedback) => void;
}) {
  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 shadow-sm">
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(f)}
          aria-label="Apagar feedback"
          title="Apagar feedback (reverte os pontos)"
          className="absolute right-2 top-2 grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      )}
      {tipo === "mural" ? (
        // Mural: rosto de quem enviou → rosto de quem recebeu.
        <div className="flex items-center gap-2">
          <FotoMini nome={f.deNome} foto={f.deFoto} className="size-8 shrink-0" />
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{f.deNome}</span>
          <Heart className="size-3.5 shrink-0 text-primary" />
          <FotoMini nome={f.paraNome} foto={f.paraFoto} className="size-8 shrink-0" />
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{f.paraNome}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{tempoRelativo(f.criadoEm)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <FotoMini
            nome={tipo === "enviado" ? f.paraNome : f.deNome}
            foto={tipo === "enviado" ? f.paraFoto : f.deFoto}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {tipo === "enviado" ? `Para ${f.paraNome}` : `De ${f.deNome}`}
            </p>
            <p className="text-xs text-muted-foreground">{tempoRelativo(f.criadoEm)}</p>
          </div>
          <Heart className="size-4 shrink-0 text-primary" />
        </div>
      )}
      <p className="mt-3 whitespace-pre-line text-sm text-foreground">{f.mensagem}</p>
    </div>
  );
}

export default function FeedbackPage() {
  const { me, isAdmin } = usePortal();
  const meUpn = (me?.email ?? "").toLowerCase();
  const { data: org } = useAsync(() => api.org());
  const { data, loading, reload } = useAsync(() => api.feedbacks.list(me?.email), [me?.email]);

  // ADMIN: apagar um feedback também reverte os pontos que ele concedeu (backend valida o papel).
  const [apagando, setApagando] = useState<string | null>(null);
  const apagar = async (f: Feedback) => {
    if (apagando) return;
    if (!window.confirm(`Apagar o feedback de ${f.deNome} para ${f.paraNome}? Os pontos concedidos por ele serão revertidos.`)) return;
    setApagando(f.id);
    try {
      await api.feedbacks.remove(f.id, me?.email);
      await reload();
    } finally {
      setApagando(null);
    }
  };
  const onDelete = isAdmin ? apagar : undefined;

  const pessoas = useMemo(
    () => (org?.diretorio ?? []).filter((p) => p.email && p.email.toLowerCase() !== meUpn),
    [org, meUpn],
  );

  const [alvo, setAlvo] = useState<Pessoa | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [okMsg, setOkMsg] = useState(false);

  const enviar = async () => {
    if (!alvo?.email || !mensagem.trim()) return;
    setEnviando(true);
    try {
      await api.feedbacks.create(
        {
          para: alvo.email.toLowerCase(),
          paraNome: alvo.nome,
          mensagem: mensagem.trim(),
          deNome: me?.nome ?? "Colega",
        },
        me?.email,
      );
      setMensagem("");
      setAlvo(null);
      setOkMsg(true);
      window.setTimeout(() => setOkMsg(false), 3500);
      await reload();
    } finally {
      setEnviando(false);
    }
  };

  const recebidos = data?.recebidos ?? [];
  const enviados = data?.enviados ?? [];
  const recentes = data?.recentes ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MessageSquareHeart}
        title="Feedback"
        description="Reconheça um colega. Cada feedback recebido rende pontos no ranking."
      />

      {/* Compositor */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Enviar um feedback</h2>
        <div className="space-y-3">
          <ColegaPicker
            pessoas={pessoas}
            selecionado={alvo}
            onPick={setAlvo}
            onLimpar={() => setAlvo(null)}
          />
          <Textarea
            rows={4}
            value={mensagem}
            maxLength={800}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Escreva um reconhecimento sincero: o que essa pessoa fez de excelente?"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {okMsg ? (
                <span className="font-medium text-success">Feedback enviado! 🎉</span>
              ) : (
                `${mensagem.length}/800`
              )}
            </span>
            <Button onClick={enviar} disabled={enviando || !alvo || !mensagem.trim()}>
              <Send className="size-4" /> {enviando ? "Enviando…" : "Enviar feedback"}
            </Button>
          </div>
        </div>
      </div>

      {/* Listas */}
      <Tabs defaultValue="recebidos">
        <TabsList>
          <TabsTrigger value="recebidos">
            <Inbox className="size-4" /> Recebidos {recebidos.length > 0 && `(${recebidos.length})`}
          </TabsTrigger>
          <TabsTrigger value="enviados">
            <Send className="size-4" /> Enviados {enviados.length > 0 && `(${enviados.length})`}
          </TabsTrigger>
          <TabsTrigger value="mural">
            <Users className="size-4" /> Mural
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recebidos" className="mt-4">
          {loading ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : recebidos.length === 0 ? (
            <EmptyState icon={Inbox} title="Nenhum feedback recebido ainda" description="Quando um colega te reconhecer, aparece aqui — e vira ponto." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recebidos.map((f) => <CartaoFeedback key={f.id} f={f} tipo="recebido" onDelete={onDelete} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="enviados" className="mt-4">
          {loading ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : enviados.length === 0 ? (
            <EmptyState icon={Send} title="Você ainda não enviou feedbacks" description="Reconhecer o time é um bom hábito. Comece agora!" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {enviados.map((f) => <CartaoFeedback key={f.id} f={f} tipo="enviado" onDelete={onDelete} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mural" className="mt-4">
          {loading ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : recentes.length === 0 ? (
            <EmptyState icon={Users} title="Mural vazio" description="Os feedbacks públicos mais recentes aparecem aqui." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentes.map((f) => <CartaoFeedback key={f.id} f={f} tipo="mural" onDelete={onDelete} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
