// CRUD de PERFIS DE ACESSO (Fase 0 do PLANO-INTRANET.md).
//
//   Grupo do Entra ID  →  Perfil de acesso (esta tela)  →  Página / Artefato
//
// O admin cria "papéis" do portal, associa 1..N grupos do Entra a cada um e marca as páginas
// visíveis + a matriz de permissões (recurso × ação). Nada disso exige mexer em código/env.
// Quem valida de verdade é o backend (server/src/perfis.ts) — aqui é a tela de gestão.
import { useMemo, useState } from "react";
import {
  ShieldCheck, Users, Plus, Pencil, Star, Lock, Search, LayoutList, KeyRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { usePortal } from "@/context/PortalProvider";
import { cn } from "@/lib/utils";
import type { Acao, GrupoEntra, Perfil } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Field, FormDialog, ConfirmDelete } from "@/components/portal/crud";
import { EmptyState, ListSkeleton } from "@/components/portal/page-kit";

const ACAO_LABEL: Record<Acao, string> = {
  ver: "Ver",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
};

interface FormState {
  nome: string;
  descricao: string;
  gruposEntra: string[];
  paginas: string[];
  permissoes: Record<string, Acao[]>;
  padrao: boolean;
}

const VAZIO: FormState = {
  nome: "",
  descricao: "",
  gruposEntra: [],
  paginas: ["/"],
  permissoes: {},
  padrao: false,
};

/** Chip clicável (mesmo padrão do multi-select de departamentos dos comunicados). */
function Chip({
  ativo, onClick, children, title,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
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

export function PerfisAdmin() {
  const { me } = usePortal();
  const upn = me?.email;
  const { data: perfis, loading, reload } = useAsync(() => api.perfis.list(upn), [upn]);
  const { data: catalogo } = useAsync(() => api.acesso.catalogo(), []);
  const { data: grupos } = useAsync(() => api.gruposEntra(upn), [upn]);

  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscaGrupo, setBuscaGrupo] = useState("");

  const paginas = catalogo?.paginas ?? [];
  const recursos = catalogo?.recursos ?? [];
  const lista = perfis ?? [];

  const gruposFiltrados = useMemo(() => {
    const termo = buscaGrupo.trim().toLowerCase();
    const todos = grupos ?? [];
    if (!termo) return todos.slice(0, 40);
    return todos.filter((g) => g.nome.toLowerCase().includes(termo)).slice(0, 40);
  }, [grupos, buscaGrupo]);

  const nomeDoGrupo = (id: string): string =>
    (grupos ?? []).find((g) => g.id === id)?.nome ?? id;

  const abrirNovo = () => {
    setEditando(null);
    setErro(null);
    setForm({ ...VAZIO, paginas: paginas.filter((p) => !p.admin).map((p) => p.rota) });
    setAberto(true);
  };

  const abrirEdicao = (p: Perfil) => {
    setEditando(p);
    setErro(null);
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? "",
      gruposEntra: p.gruposEntra ?? [],
      paginas: p.paginas ?? [],
      permissoes: { ...(p.permissoes ?? {}) },
      padrao: Boolean(p.padrao),
    });
    setBuscaGrupo("");
    setAberto(true);
  };

  const toggle = <K extends "gruposEntra" | "paginas">(campo: K, valor: string) =>
    setForm((f) => ({
      ...f,
      [campo]: f[campo].includes(valor)
        ? f[campo].filter((x) => x !== valor)
        : [...f[campo], valor],
    }));

  const togglePerm = (recurso: string, acao: Acao) =>
    setForm((f) => {
      const atuais = f.permissoes[recurso] ?? [];
      const tem = atuais.includes(acao);
      // Desmarcar "ver" derruba as demais ações: sem enxergar, não há como gerenciar.
      const novas = tem
        ? acao === "ver"
          ? []
          : atuais.filter((a) => a !== acao)
        : acao === "ver"
          ? [...atuais, acao]
          : [...new Set<Acao>([...atuais, "ver", acao])];
      return { ...f, permissoes: { ...f.permissoes, [recurso]: novas } };
    });

  const salvar = async () => {
    if (!form.nome.trim()) {
      setErro("Informe um nome para o perfil.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const corpo = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || undefined,
        gruposEntra: form.gruposEntra,
        gruposNomes: form.gruposEntra.map(nomeDoGrupo),
        paginas: form.paginas,
        permissoes: form.permissoes,
        padrao: form.padrao,
      };
      if (editando) await api.perfis.update(editando.id, corpo, upn);
      else await api.perfis.create(corpo, upn);
      setAberto(false);
      await reload();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (p: Perfil) => {
    await api.perfis.remove(p.id, upn);
    await reload();
  };

  if (loading) return <ListSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      {/* Como funciona — a cadeia de 3 camadas em uma frase, para o admin se orientar. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
        <Users className="size-3.5 text-primary" />
        <span className="font-medium text-foreground">Grupo do Entra ID</span>
        <span>→</span>
        <span className="font-medium text-foreground">Perfil de acesso</span>
        <span>→</span>
        <span className="font-medium text-foreground">Páginas e artefatos</span>
        <span className="ml-1">
          O grupo define quem é a pessoa; o perfil define o que ela vê e pode fazer.
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {lista.length} perfil{lista.length === 1 ? "" : "s"} cadastrado{lista.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="size-4" /> Novo perfil
        </Button>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhum perfil cadastrado"
          description="Crie um perfil, associe os grupos do Entra e defina as páginas e permissões."
          action={<Button onClick={abrirNovo}><Plus className="size-4" /> Novo perfil</Button>}
        />
      ) : (
        /* Visão em TABELA: o mapeamento Grupo do Entra → Perfil é o que o admin mais compara
           entre perfis, e a tabela deixa isso lado a lado (usa o espaço horizontal da página). */
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableHead>Perfil</TableHead>
                <TableHead>Grupos do Entra ID</TableHead>
                <TableHead className="w-24 text-right">Páginas</TableHead>
                <TableHead className="w-28 text-right">Permissões</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((p) => {
                const totalAcoes = Object.values(p.permissoes ?? {}).reduce((n, a) => n + a.length, 0);
                const grupos = p.gruposEntra ?? [];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{p.nome}</span>
                        {p.admin && (
                          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                            <ShieldCheck className="size-3" /> Admin
                          </Badge>
                        )}
                        {p.padrao && (
                          <Badge variant="outline" className="border-border text-muted-foreground">
                            <Star className="size-3" /> Padrão
                          </Badge>
                        )}
                        {p.sistema && (
                          <Badge variant="outline" className="border-border text-muted-foreground">
                            <Lock className="size-3" /> Sistema
                          </Badge>
                        )}
                      </div>
                      {p.descricao && (
                        <p className="mt-1 max-w-md text-xs text-muted-foreground">{p.descricao}</p>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      {grupos.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {p.padrao ? "— (perfil padrão: fallback de quem não casa)" : "nenhum grupo associado"}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {grupos.slice(0, 6).map((id, i) => (
                            <Badge key={id} variant="outline" className="border-border text-muted-foreground">
                              <Users className="size-3" />
                              {p.gruposNomes?.[i] || nomeDoGrupo(id)}
                            </Badge>
                          ))}
                          {grupos.length > 6 && (
                            <Badge variant="outline" className="border-border text-muted-foreground">
                              +{grupos.length - 6}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="align-top text-right font-medium text-foreground">
                      {(p.paginas ?? []).length}
                    </TableCell>
                    <TableCell className="align-top text-right font-medium text-foreground">
                      {totalAcoes}
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar ${p.nome}`}
                          onClick={() => abrirEdicao(p)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {/* Perfis de sistema não podem ser excluídos (rede de segurança do RBAC). */}
                        {!p.sistema && (
                          <ConfirmDelete label={`Excluir o perfil ${p.nome}`} onConfirm={() => excluir(p)} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <FormDialog
        open={aberto}
        onOpenChange={setAberto}
        title={editando ? `Editar perfil — ${editando.nome}` : "Novo perfil de acesso"}
        description="Associe os grupos do Entra, escolha as páginas visíveis e marque o que o perfil pode fazer."
        onSubmit={salvar}
        submitting={salvando}
        // Formulário denso (grupos + páginas + matriz de 13 recursos × 4 ações): num diálogo
        // estreito ele virava uma coluna altíssima com rolagem. Largo + 2 colunas, cabe.
        className="sm:max-w-4xl"
      >
        {erro && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {erro}
          </p>
        )}

        {/* Duas colunas em telas grandes: identidade + grupos à esquerda, o que o perfil
            alcança (páginas e permissões) à direita. Em telas pequenas empilha. */}
        <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
        <Field label="Nome do perfil" htmlFor="perfil-nome">
          <Input
            id="perfil-nome"
            value={form.nome}
            placeholder="Ex.: Comercial, RH, Marketing…"
            disabled={Boolean(editando?.sistema)}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
        </Field>

        <Field label="Descrição" htmlFor="perfil-desc" hint="Opcional — ajuda a lembrar para que serve.">
          <Textarea
            id="perfil-desc"
            rows={2}
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />
        </Field>

        {/* Grupos do Entra: o admin ESCOLHE (não digita GUID). Em preview vêm grupos demo. */}
        <Field
          label="Grupos do Entra ID"
          hint="Quem pertence a qualquer um destes grupos recebe este perfil."
        >
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaGrupo}
                onChange={(e) => setBuscaGrupo(e.target.value)}
                placeholder="Buscar grupo…"
                className="h-9 pl-9"
                aria-label="Buscar grupo do Entra"
              />
            </div>
            {form.gruposEntra.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.gruposEntra.map((id) => (
                  <Chip key={id} ativo onClick={() => toggle("gruposEntra", id)} title="Remover">
                    <Users className="mr-1 inline size-3" />
                    {nomeDoGrupo(id)}
                  </Chip>
                ))}
              </div>
            )}
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {(grupos ?? []).length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  Nenhum grupo disponível. Em produção, conceda a permissão Graph
                  <span className="font-medium text-foreground"> Group.Read.All</span> ao app.
                </p>
              ) : (
                gruposFiltrados.map((g: GrupoEntra) => (
                  <label
                    key={g.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-secondary"
                  >
                    <Checkbox
                      checked={form.gruposEntra.includes(g.id)}
                      onCheckedChange={() => toggle("gruposEntra", g.id)}
                    />
                    <span className="truncate text-foreground">{g.nome}</span>
                    {g.email && <span className="truncate text-muted-foreground">{g.email}</span>}
                  </label>
                ))
              )}
            </div>
          </div>
        </Field>

        </div>

        <div className="space-y-4">
        {/* Páginas visíveis = itens do menu que o perfil enxerga. */}
        <Field label="Páginas visíveis" hint="Itens do menu que este perfil enxerga.">
          <div className="flex flex-wrap gap-1.5">
            {paginas
              .filter((p) => !p.admin) // a área de administração é exclusiva de perfis admin
              .map((p) => (
                <Chip
                  key={p.rota}
                  ativo={form.paginas.includes(p.rota)}
                  onClick={() => toggle("paginas", p.rota)}
                >
                  <LayoutList className="mr-1 inline size-3" />
                  {p.label}
                </Chip>
              ))}
          </div>
        </Field>

        {/* Matriz recurso × ação — a autoridade é o backend, aqui é a configuração. */}
        <Field label="Permissões" hint="Marcar uma ação de gestão já garante o 'Ver' do recurso.">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Recurso</th>
                  {(["ver", "criar", "editar", "excluir"] as Acao[]).map((a) => (
                    <th key={a} className="w-16 px-2 py-2 text-center font-medium">
                      {ACAO_LABEL[a]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recursos.map((r) => (
                  <tr key={r.chave} className="border-t border-border">
                    <td className="px-3 py-1.5 text-foreground">{r.label}</td>
                    {(["ver", "criar", "editar", "excluir"] as Acao[]).map((a) => (
                      <td key={a} className="px-2 py-1.5 text-center">
                        {r.acoes.includes(a) ? (
                          <Checkbox
                            className="mx-auto"
                            aria-label={`${ACAO_LABEL[a]} ${r.label}`}
                            checked={(form.permissoes[r.chave] ?? []).includes(a)}
                            onCheckedChange={() => togglePerm(r.chave, a)}
                          />
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Field>

        </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <span className="text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <KeyRound className="size-3.5 text-primary" /> Perfil padrão
            </span>
            <span className="mt-0.5 block text-muted-foreground">
              Quem não pertence a nenhum grupo mapeado recebe este perfil.
            </span>
          </span>
          <Switch
            checked={form.padrao}
            onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, padrao: v }))}
          />
        </label>
      </FormDialog>
    </div>
  );
}
