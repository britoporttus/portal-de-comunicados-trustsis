// Segregação de artefatos por PERFIL DE ACESSO (Fase 1 do PLANO-INTRANET.md).
//
// Peça reutilizável usada nos formulários de comunicado/evento/publicação: o autor escolhe
// quais perfis enxergam o artefato. Vazio = todos (comportamento histórico, nada quebra).
//
// Coexiste com a segmentação que já existia (`publico` CLT/PJ e `departamentos[]` do Entra):
// o filtro final é (contrato/departamento) E (perfis). Quem valida é o backend
// (server/src/perfis.ts › filtrarPorPerfil) — aqui é só a tela.
import { Lock } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/portal/crud";

/** Chip de seleção (mesmo padrão do multi-select de departamentos e da tela de perfis). */
function Chip({ ativo, onClick, children }: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors",
        ativo
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Multi-select de perfis para restringir a visibilidade de um artefato. */
export function PerfisPicker({
  valor, onChange, label = "Perfis de acesso",
}: {
  valor: string[];
  onChange: (perfis: string[]) => void;
  label?: string;
}) {
  const { data: opcoes, loading } = useAsync(() => api.perfisOpcoes(), []);
  const lista = opcoes ?? [];

  const alternar = (id: string) =>
    onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id]);

  return (
    <Field
      label={label}
      hint={
        valor.length === 0
          ? "Vazio = visível a todos os perfis. Selecione para restringir."
          : "Somente os perfis marcados verão este item (soma-se ao filtro de contrato/departamento)."
      }
    >
      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando perfis…</p>
      ) : lista.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum perfil de acesso cadastrado — configure em Administração › Perfis de acesso.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {lista.map((p) => (
            <Chip key={p.id} ativo={valor.includes(p.id)} onClick={() => alternar(p.id)}>
              {p.nome}
            </Chip>
          ))}
        </div>
      )}
    </Field>
  );
}

/** Selo "Restrito" para a listagem: sinaliza que o artefato não é visível a todos. */
export function RestritoBadge({ perfis, className }: { perfis?: string[]; className?: string }) {
  if (!perfis || perfis.length === 0) return null;
  return (
    <Badge
      variant="outline"
      title={`Restrito a ${perfis.length} perfil(is) de acesso`}
      className={cn("gap-1 border-warning/40 bg-warning/10 text-warning", className)}
    >
      <Lock className="size-3" />
      Restrito
    </Badge>
  );
}
