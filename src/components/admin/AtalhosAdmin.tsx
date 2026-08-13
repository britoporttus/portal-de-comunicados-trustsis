// CRUD dos ATALHOS DA EMPRESA (Fase 2 do PLANO-INTRANET.md).
//
// São os links INSTITUCIONAIS publicados pelo admin — sistemas internos, registro de projetos
// do comercial e, principalmente, os DASHBOARDS EXTERNOS (Power BI e afins). O portal não
// hospeda indicador nenhum: ele aponta para a ferramenta onde o dashboard já vive, e a
// segregação de quem vê o quê é feita pelos perfis de acesso.
//
// Não confundir com "Links úteis" (/api/links), que são os atalhos PESSOAIS de cada
// colaborador — estes aqui aparecem para todo mundo que tem o perfil, no topo daquela página.
import { useMemo, useState } from "react";
import { LayoutGrid, Plus, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { LinkUtil } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Droplist } from "@/components/ui/droplist";
import { Field, FormDialog, ConfirmDelete } from "@/components/portal/crud";
import { EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { PerfisPicker, RestritoBadge } from "@/components/portal/PerfisPicker";
import { LinkIcon, iconForLink } from "@/components/portal/shared";

/** Categorias sugeridas (o campo é livre — o admin pode digitar outra). */
const CATEGORIAS = ["Dashboards", "Sistemas", "Comercial", "RH", "Marketing", "Geral"];

const ICON_OPCOES: Array<[string, string]> = [
  ["link", "Link genérico"],
  ["layout-grid", "Aplicações"],
  ["folder", "Arquivos"],
  ["cloud", "Nuvem"],
  ["users", "Pessoas"],
  ["mail", "E-mail"],
  ["calendar", "Calendário"],
  ["video", "Vídeo/Reunião"],
  ["life-buoy", "Suporte"],
];

interface FormState {
  label: string;
  url: string;
  icon: string;
  categoria: string;
  descricao: string;
  ordem: string;
  departamentos: string[];
  perfis: string[];
}

const VAZIO: FormState = {
  label: "", url: "", icon: "link", categoria: "Dashboards", descricao: "", ordem: "",
  departamentos: [], perfis: [],
};

export function AtalhosAdmin() {
  const { data, loading, reload } = useAsync(() => api.atalhos.list(), []);
  // Departamentos existentes (Entra) para segmentar o atalho — igual aos Comunicados.
  const { data: deptData } = useAsync(() => api.departamentos(), []);
  const deptOptions = deptData ?? [];
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<LinkUtil | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const lista = data ?? [];

  const grupos = useMemo(() => {
    const mapa = new Map<string, LinkUtil[]>();
    for (const a of data ?? []) {
      const cat = a.categoria?.trim() || "Geral";
      const arr = mapa.get(cat);
      if (arr) arr.push(a);
      else mapa.set(cat, [a]);
    }
    return [...mapa.entries()];
  }, [data]);

  const abrirNovo = () => {
    setEditando(null);
    setErro(null);
    setForm(VAZIO);
    setAberto(true);
  };

  const abrirEdicao = (a: LinkUtil) => {
    setEditando(a);
    setErro(null);
    setForm({
      label: a.label,
      url: a.url,
      icon: a.icon ?? "link",
      categoria: a.categoria ?? "Geral",
      descricao: a.descricao ?? "",
      ordem: a.ordem === undefined ? "" : String(a.ordem),
      departamentos: a.departamentos ?? [],
      perfis: a.perfis ?? [],
    });
    setAberto(true);
  };

  const salvar = async () => {
    if (!form.label.trim() || !form.url.trim()) {
      setErro("Informe o nome e a URL do atalho.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const corpo: Partial<LinkUtil> = {
        label: form.label.trim(),
        url: form.url.trim(),
        icon: form.icon,
        categoria: form.categoria.trim() || "Geral",
        descricao: form.descricao.trim() || undefined,
        ordem: form.ordem.trim() ? Number(form.ordem) : undefined,
        departamentos: form.departamentos,
        perfis: form.perfis,
      };
      if (editando) await api.atalhos.update(editando.id, corpo);
      else await api.atalhos.create(corpo);
      await reload();
      setAberto(false);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string) => {
    await api.atalhos.remove(id);
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Atalhos institucionais exibidos no topo de{" "}
          <strong className="font-medium text-foreground">Links úteis</strong> e no Acesso rápido da
          home. Segmente por <strong className="font-medium text-foreground">departamento</strong>{" "}
          (igual aos comunicados) — ex.: o link do SAP aparece só para a AMS — e, se precisar,
          restrinja também por perfil de acesso. É aqui que entram os dashboards externos (Power BI)
          e os sistemas do time.
        </p>
        <Button onClick={abrirNovo}>
          <Plus className="size-4" /> Novo atalho
        </Button>
      </div>

      {loading ? (
        <ListSkeleton rows={2} />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Nenhum atalho publicado"
          description="Cadastre os links que todo mundo (ou só alguns perfis) precisa ter à mão."
          action={
            <Button onClick={abrirNovo}>
              <Plus className="size-4" /> Novo atalho
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {grupos.map(([categoria, itens]) => (
            <section key={categoria}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {categoria}
              </h3>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {itens.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <LinkIcon url={a.url} icon={a.icon} label={a.label} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{a.label}</p>
                        {(a.departamentos ?? []).map((d) => (
                          <span
                            key={d}
                            className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                          >
                            {d}
                          </span>
                        ))}
                        <RestritoBadge perfis={a.perfis} />
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {a.descricao ? `${a.descricao} · ` : ""}
                        {a.url}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirEdicao(a)} title="Editar">
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDelete onConfirm={() => excluir(a.id)} label="Excluir atalho" />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <FormDialog
        open={aberto}
        onOpenChange={setAberto}
        title={editando ? "Editar atalho" : "Novo atalho da empresa"}
        description="O atalho aparece em Links úteis e no Acesso rápido para os departamentos (e perfis) selecionados."
        onSubmit={salvar}
        submitting={salvando}
      >
        {erro && <p className="text-xs text-destructive">{erro}</p>}
        <Field label="Nome" htmlFor="atl-label">
          <Input
            id="atl-label"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Ex.: Painel de vendas (Power BI)"
          />
        </Field>
        <Field label="URL" htmlFor="atl-url">
          <Input
            id="atl-url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://app.powerbi.com/…"
          />
        </Field>
        <Field label="Descrição" htmlFor="atl-desc" hint="Texto curto exibido sob o nome do atalho.">
          <Input
            id="atl-desc"
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            placeholder="Faturamento e pipeline atualizados diariamente"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria" htmlFor="atl-cat" hint="Agrupa os atalhos na página de links.">
            <Input
              id="atl-cat"
              list="atl-categorias"
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              placeholder="Dashboards"
            />
            <datalist id="atl-categorias">
              {CATEGORIAS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Ordem" htmlFor="atl-ordem" hint="Menor aparece primeiro (opcional).">
            <Input
              id="atl-ordem"
              type="number"
              value={form.ordem}
              onChange={(e) => setForm((f) => ({ ...f, ordem: e.target.value }))}
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Ícone" htmlFor="atl-icon" hint="Usado quando o site não tem favicon próprio.">
          <Droplist<string>
            id="atl-icon"
            className="w-full"
            value={form.icon}
            onChange={(v) => setForm((f) => ({ ...f, icon: v }))}
            options={ICON_OPCOES.map(([k, label]) => {
              const Icone = iconForLink(k);
              return { value: k, label, icon: <Icone /> };
            })}
          />
        </Field>
        <Field
          label="Departamentos"
          htmlFor="atl-deptos"
          hint={
            deptOptions.length > 0
              ? form.departamentos.length === 0
                ? "Nenhum selecionado = todos os departamentos. Ex.: escolha AMS e o atalho aparece só para a AMS."
                : `${form.departamentos.length} departamento(s) selecionado(s).`
              : "Separe por vírgula. Vazio = todos."
          }
        >
          {deptOptions.length > 0 ? (
            <div className="space-y-2">
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto rounded-lg border border-border bg-background p-2.5">
                {deptOptions.map((d) => {
                  const sel = form.departamentos.includes(d);
                  return (
                    <button
                      type="button"
                      key={d}
                      aria-pressed={sel}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          departamentos: sel
                            ? f.departamentos.filter((x) => x !== d)
                            : [...f.departamentos, d],
                        }))
                      }
                      className={
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
                        (sel
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-secondary text-secondary-foreground hover:border-primary/40")
                      }
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              {form.departamentos.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setForm((f) => ({ ...f, departamentos: [] }))}
                >
                  Limpar seleção
                </Button>
              )}
            </div>
          ) : (
            <Input
              id="atl-deptos"
              value={form.departamentos.join(", ")}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  departamentos: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                }))
              }
              placeholder="Ex.: AMS, Comercial, Projetos"
            />
          )}
        </Field>

        <PerfisPicker
          valor={form.perfis}
          onChange={(perfis) => setForm((f) => ({ ...f, perfis }))}
          label="Restringir também por perfil de acesso (opcional)"
        />
      </FormDialog>
    </div>
  );
}
