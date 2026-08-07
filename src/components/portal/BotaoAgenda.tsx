// FASE 3 — "Adicionar à minha agenda": manda o evento do portal para o calendário do
// Outlook de QUEM clicou (o backend escreve via Graph com Calendars.ReadWrite Application;
// nunca na agenda de terceiros). Se a permissão não estiver concedida, o backend devolve a
// mensagem e ela aparece aqui — em vez de o botão falhar em silêncio.
import { useState } from "react";
import { CalendarPlus, CalendarCheck, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Evento } from "@/lib/types";
import { usePortal } from "@/context/PortalProvider";
import { Button } from "@/components/ui/button";

/** O `naAgenda` guarda a chave CANÔNICA (e-mail preferido, id como fallback) — o cliente não
 *  calcula essa chave, então compara com as duas identidades que conhece. */
function jaNaAgenda(e: Evento, email?: string, id?: string): boolean {
  const marcas = (e.naAgenda ?? []).map((x) => x.toLowerCase());
  return Boolean(
    (email && marcas.includes(email.toLowerCase())) || (id && marcas.includes(id.toLowerCase())),
  );
}

export function BotaoAgenda({
  evento,
  size = "sm",
  className,
}: {
  evento: Evento;
  size?: "sm" | "default";
  className?: string;
}) {
  const { me } = usePortal();
  const [adicionado, setAdicionado] = useState(() => jaNaAgenda(evento, me?.email, me?.id));
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Evento que já passou não vai para a agenda (evita poluir o calendário com passado).
  if (new Date(evento.inicio).getTime() < Date.now() - 60 * 60_000) return null;

  const adicionar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      await api.eventos.adicionarNaAgenda(evento.id, me?.email);
      setAdicionado(true);
    } catch (e) {
      setErro(
        (e as Error).message.includes("502")
          ? "Não foi possível criar o compromisso (verifique a permissão Calendars.ReadWrite no Entra)."
          : "Não foi possível adicionar à agenda.",
      );
    } finally {
      setCarregando(false);
    }
  };

  if (adicionado) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-primary ${className ?? ""}`}
      >
        <CalendarCheck className="size-4" /> Na sua agenda
      </span>
    );
  }

  return (
    <span className={className}>
      <Button variant="outline" size={size} onClick={adicionar} disabled={carregando}>
        {carregando ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
        Adicionar à minha agenda
      </Button>
      {erro && <p className="mt-1 text-[11px] text-destructive">{erro}</p>}
    </span>
  );
}
