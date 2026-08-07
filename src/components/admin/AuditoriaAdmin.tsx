// AUDITORIA (Fase 6) — trilha de "quem mudou o quê e quando" nas ações de administração:
// perfis/permissões, integração com o Entra, marca, bibliotecas e obrigatoriedade de
// políticas. O backend grava a identidade que ELE resolveu (nunca a afirmada pelo cliente)
// e mantém os últimos registros; aqui só listamos e filtramos.
import { useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { usePortal } from "@/context/PortalProvider";
import { tempoRelativo, dataLonga } from "@/lib/format";
import { EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Rótulo legível de cada ação auditada (`recurso.verbo`). */
const ROTULOS: Record<string, string> = {
  "perfis.criar": "Criou perfil de acesso",
  "perfis.editar": "Editou perfil de acesso",
  "perfis.excluir": "Excluiu perfil de acesso",
  "integracao.salvar": "Salvou a integração",
  "marca.salvar": "Alterou a marca",
  "bibliotecas.criar": "Criou biblioteca",
  "bibliotecas.editar": "Editou biblioteca",
  "bibliotecas.excluir": "Excluiu biblioteca",
  "atalhos.criar": "Publicou atalho da empresa",
  "atalhos.editar": "Editou atalho da empresa",
  "atalhos.excluir": "Removeu atalho da empresa",
  "politicas.obrigatoria": "Alterou leitura obrigatória",
};

/** Cor do selo por área (o verbo importa menos que o recurso tocado). */
function tomDoRecurso(acao: string): string {
  const recurso = acao.split(".")[0];
  if (recurso === "perfis") return "border-primary/40 bg-primary/10 text-primary";
  if (recurso === "integracao") return "border-warning/40 bg-warning/10 text-warning";
  return "border-border text-muted-foreground";
}

export function AuditoriaAdmin() {
  const { me } = usePortal();
  const { data, loading } = useAsync(() => api.auditoria.list(200, me?.email), [me?.email]);
  const [busca, setBusca] = useState("");
  const [recurso, setRecurso] = useState("todos");

  const registros = useMemo(() => data ?? [], [data]);
  const recursos = useMemo(
    () => [...new Set(registros.map((r) => r.acao.split(".")[0]))].sort(),
    [registros],
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return registros.filter((r) => {
      if (recurso !== "todos" && r.acao.split(".")[0] !== recurso) return false;
      if (!q) return true;
      return [r.quemNome, r.quem, r.alvo, r.detalhe, ROTULOS[r.acao] ?? r.acao]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [registros, busca, recurso]);

  if (loading) return <ListSkeleton rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-muted-foreground">
          Últimas alterações de administração — quem fez, o que mudou e quando.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por pessoa ou alvo"
            className="h-9 w-56 pl-8"
          />
        </div>
        <NativeSelect
          value={recurso}
          onChange={(e) => setRecurso(e.target.value)}
          className="w-44"
          aria-label="Área"
        >
          <NativeSelectOption value="todos">Todas as áreas</NativeSelectOption>
          {recursos.map((r) => (
            <NativeSelectOption key={r} value={r}>
              {r}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum registro"
          description="As alterações de administração feitas a partir de agora aparecem aqui."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Quando</TableHead>
                <TableHead className="w-56">Quem</TableHead>
                <TableHead className="w-56">Ação</TableHead>
                <TableHead>Alvo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground" title={dataLonga(r.em)}>
                    {tempoRelativo(r.em)}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {r.quemNome || r.quem}
                    {r.quemNome && r.quem.includes("@") && (
                      <span className="block text-[11px] text-muted-foreground">{r.quem}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={tomDoRecurso(r.acao)}>
                      {ROTULOS[r.acao] ?? r.acao}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {r.alvo ?? "—"}
                    {r.detalhe && (
                      <span className="block text-[11px] text-muted-foreground">{r.detalhe}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
