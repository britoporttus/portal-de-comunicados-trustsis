import { useEffect, useState } from "react";
import { Check, ChevronDown, Search, UserCog } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { api, type IdentidadeDisponivel } from "@/lib/api";
import { escolherIdentidade, identidadeEscolhida } from "@/lib/identidade";
import { usePortal } from "@/context/PortalProvider";

// SELETOR DE IDENTIDADE (preview embutido).
//
// Substitui o login interativo do Entra quando o portal roda dentro de um iframe, onde ele é
// tecnicamente impossível. A lista vem do diretório REAL do tenant (Graph app-only com as
// credenciais salvas em Administração › Integração), então escolher alguém aqui carrega o
// portal com o perfil, os grupos e o RBAC REAIS daquela pessoa — não é um usuário fictício.
//
// Em produção (aba própria, barreira ligada) este componente nem é renderizado: lá o usuário
// é o do token do Entra.
function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function IdentidadePicker() {
  const { me } = usePortal();
  const [aberto, setAberto] = useState(false);
  const [pessoas, setPessoas] = useState<IdentidadeDisponivel[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const atual = identidadeEscolhida();

  // Carrega o diretório só quando o seletor é aberto pela primeira vez.
  useEffect(() => {
    if (!aberto || pessoas || erro) return;
    api
      .identidades()
      .then(setPessoas)
      .catch(() => setErro("Não foi possível carregar os usuários do Entra."));
  }, [aberto, pessoas, erro]);

  const termo = busca.trim().toLowerCase();
  const lista = (pessoas ?? []).filter(
    (p) =>
      !termo ||
      p.nome.toLowerCase().includes(termo) ||
      p.email.toLowerCase().includes(termo) ||
      (p.cargo ?? "").toLowerCase().includes(termo),
  );

  function selecionar(upn: string | null) {
    escolherIdentidade(upn);
    // Recarrega para o portal inteiro (perfil, menu, permissões, pontos) subir com a
    // identidade nova — é o mesmo efeito de "entrar" como essa pessoa.
    window.location.reload();
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger
        render={
          <button
            type="button"
            title="Entrar como outro usuário do Entra"
            className="flex items-center gap-2.5 rounded-full border border-border py-1 pl-1 pr-2.5 transition-colors hover:border-primary/40 hover:bg-secondary"
          />
        }
      >
        <Avatar className="size-8">
          {me?.fotoUrl && <AvatarImage src={me.fotoUrl} alt={me.nome} />}
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
            {me ? iniciais(me.nome) : "··"}
          </AvatarFallback>
        </Avatar>
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-xs font-semibold text-foreground">{me?.nome ?? "Colaborador"}</div>
          <div className="max-w-[160px] truncate text-[10px] text-muted-foreground">
            {me?.cargo ?? "Colaborador"}
          </div>
        </div>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 gap-2 p-0">
        <div className="border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <UserCog className="size-4 text-primary" />
            Entrar como
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Usuários do Entra ID deste tenant. O portal recarrega com o perfil e as permissões
            reais de quem você escolher.
          </p>
        </div>

        <div className="px-3 pt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pessoa…"
              className="h-8 pl-8 text-xs"
              aria-label="Buscar pessoa"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto px-1.5 pb-2">
          {erro && <p className="px-2 py-3 text-xs text-destructive">{erro}</p>}
          {!erro && !pessoas && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Spinner className="size-4" /> Carregando diretório…
            </div>
          )}
          {pessoas && lista.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Ninguém encontrado.</p>
          )}
          {lista.map((p) => {
            const ativo = atual?.toLowerCase() === p.email.toLowerCase();
            return (
              <button
                key={p.email}
                type="button"
                onClick={() => selecionar(p.email)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary"
              >
                <Avatar className="size-7">
                  {p.fotoUrl && <AvatarImage src={p.fotoUrl} alt={p.nome} />}
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {iniciais(p.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">{p.nome}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {p.cargo ? `${p.cargo} · ` : ""}
                    {p.email}
                  </div>
                </div>
                {ativo && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>

        {atual && (
          <div className="border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => selecionar(null)}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Voltar ao usuário padrão do portal
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
