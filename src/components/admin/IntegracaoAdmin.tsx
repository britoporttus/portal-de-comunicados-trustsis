// CONFIGURAÇÃO DE INTEGRAÇÃO (SSO / Entra ID • Graph • Políticas • ITSM).
//
// Irmã da tela de Perfis: aqui o admin configura as CREDENCIAIS e URLs que antes viviam
// presas no `.env` do servidor. Precedência real (implementada em server/src/settings.ts):
//
//   STORE (o que é salvo nesta tela)  →  ENV (bootstrap da instalação)  →  vazio
//
// Por isso cada campo mostra a sua ORIGEM: sem isso o admin não tem como saber se o valor
// que ele está vendo já é "dele" (store) ou ainda é o de partida do `.env`.
import { useState } from "react";
import {
  KeyRound, ShieldCheck, FileText, LifeBuoy, PlugZap, Save, TriangleAlert,
  CircleCheckBig, Wifi, Lock, RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { usePortal } from "@/context/PortalProvider";
import { tempoRelativo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IntegracaoConfig, OrigemCampo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/portal/crud";
import { EmptyState, ListSkeleton } from "@/components/portal/page-kit";

/** Campos de texto que a tela edita (o clientSecret é tratado à parte — ver abaixo). */
type CampoTexto =
  | "tenantId" | "clientId" | "adminGroupId" | "demoUserUpn"
  | "politicasShareUrl" | "itsmBaseUrl" | "itsmApiScope" | "itsmTenantSubdomain";

interface FormState extends Record<CampoTexto, string> {
  authRequired: boolean;
  /** Sempre começa VAZIO: vazio significa "mantém o segredo atual" (o GET nunca o devolve). */
  clientSecret: string;
}

const VAZIO: FormState = {
  tenantId: "",
  clientId: "",
  clientSecret: "",
  adminGroupId: "",
  demoUserUpn: "",
  politicasShareUrl: "",
  itsmBaseUrl: "",
  itsmApiScope: "",
  itsmTenantSubdomain: "",
  authRequired: false,
};

/** Onde o valor efetivo do campo está sendo lido AGORA. "vazio" não vira badge: a ausência
 *  de badge já comunica "não configurado" sem poluir o formulário. */
function OrigemBadge({ origem }: { origem?: OrigemCampo }) {
  if (origem === "env") {
    return (
      <Badge
        variant="outline"
        className="border-warning/40 bg-warning/10 text-warning"
        title="Valor vindo do .env do servidor (bootstrap). Salvar aqui passa a ter precedência."
      >
        definido no .env
      </Badge>
    );
  }
  if (origem === "store") {
    return (
      <Badge
        variant="outline"
        className="border-primary/40 bg-primary/10 text-primary"
        title="Valor salvo no portal — tem precedência sobre o .env."
      >
        salvo no portal
      </Badge>
    );
  }
  return null;
}

/** Badge de estado derivado (o backend é quem decide se algo está de fato ligado). */
function FlagBadge({
  ligado, label, ligadoTexto = "ativo", desligadoTexto = "inativo",
}: {
  ligado: boolean;
  label: string;
  ligadoTexto?: string;
  desligadoTexto?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        ligado
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-warning/40 bg-warning/10 text-warning",
      )}
      title={`${label}: ${ligado ? ligadoTexto : desligadoTexto}`}
    >
      {ligado ? <CircleCheckBig className="size-3" /> : <TriangleAlert className="size-3" />}
      {label}
    </Badge>
  );
}

/** Campo de texto com a origem do valor ao lado — o "de onde vem" é parte do dado.
 *  Fica FORA do componente de tela de propósito: definido dentro, cada render criaria um
 *  tipo novo e o input remontaria a cada tecla (perdendo o foco). */
function Campo({
  id, label, hint, placeholder, type, valor, origem, onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  type?: string;
  valor: string;
  origem?: OrigemCampo;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} htmlFor={`integracao-${id}`} hint={hint}>
      <div className="flex items-center gap-2">
        <Input
          id={`integracao-${id}`}
          type={type}
          value={valor}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        <OrigemBadge origem={origem} />
      </div>
    </Field>
  );
}

/** Card de seção — mesmo formato dos cards da página de Administração. */
function Secao({
  titulo, descricao, icon: Icon, children,
}: {
  titulo: string;
  descricao?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="size-4 text-primary" /> {titulo}
      </h3>
      {descricao && <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>}
      <Separator className="my-3" />
      {children}
    </section>
  );
}

export function IntegracaoAdmin() {
  const { me } = usePortal();
  const upn = me?.email;
  const { data, loading, error, reload } = useAsync(() => api.integracao.get(upn), [upn]);

  const [form, setForm] = useState<FormState>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<{ ok: boolean; detalhe: string; grupos?: number } | null>(null);

  // Espelha a configuração vinda do backend no formulário. O clientSecret NÃO vem no GET,
  // então o campo é sempre reaberto em branco (= "não mexer no segredo").
  //
  // Ajuste DURANTE O RENDER (padrão oficial do React para "estado derivado de props que
  // mudaram"), em vez de um useEffect com setState: o efeito renderizava uma vez com o
  // formulário vazio e só então preenchia — um flash de campos em branco a cada carga/reload.
  const [espelhado, setEspelhado] = useState<IntegracaoConfig | null>(null);
  if (data && data !== espelhado) {
    setEspelhado(data);
    setForm({
      tenantId: data.tenantId ?? "",
      clientId: data.clientId ?? "",
      clientSecret: "",
      adminGroupId: data.adminGroupId ?? "",
      demoUserUpn: data.demoUserUpn ?? "",
      politicasShareUrl: data.politicasShareUrl ?? "",
      itsmBaseUrl: data.itsmBaseUrl ?? "",
      itsmApiScope: data.itsmApiScope ?? "",
      itsmTenantSubdomain: data.itsmTenantSubdomain ?? "",
      authRequired: Boolean(data.authRequired),
    });
  }

  const set = (campo: keyof FormState, valor: string | boolean) => {
    setSalvo(false);
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      const corpo: Partial<IntegracaoConfig> & { clientSecret?: string } = {
        tenantId: form.tenantId.trim(),
        clientId: form.clientId.trim(),
        adminGroupId: form.adminGroupId.trim(),
        demoUserUpn: form.demoUserUpn.trim(),
        politicasShareUrl: form.politicasShareUrl.trim(),
        itsmBaseUrl: form.itsmBaseUrl.trim(),
        itsmApiScope: form.itsmApiScope.trim(),
        itsmTenantSubdomain: form.itsmTenantSubdomain.trim(),
        authRequired: form.authRequired,
      };
      // Só envia o segredo se o admin digitou algo: campo em branco preserva o atual.
      const secret = form.clientSecret.trim();
      if (secret) corpo.clientSecret = secret;

      await api.integracao.save(corpo, upn);
      setTeste(null); // o resultado anterior virou histórico: a config mudou
      setSalvo(true);
      // Recarrega para refletir `origem` (env → store) e as flags derivadas do backend.
      await reload();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    setTestando(true);
    setTeste(null);
    try {
      setTeste(await api.integracao.testar(upn));
    } catch (e) {
      setTeste({ ok: false, detalhe: (e as Error).message });
    } finally {
      setTestando(false);
    }
  };

  if (loading) return <ListSkeleton rows={4} />;

  if (error || !data) {
    return (
      <EmptyState
        icon={PlugZap}
        title="Não foi possível carregar a configuração"
        description={error ?? "A API de integração não respondeu."}
        action={<Button onClick={() => reload()}><RefreshCw className="size-4" /> Tentar de novo</Button>}
      />
    );
  }

  const origem = data.origem ?? {};

  /** Props repetidas de todo campo de texto (valor + origem + setter). */
  const props = (campo: CampoTexto) => ({
    id: campo,
    valor: form[campo],
    origem: origem[campo],
    onChange: (v: string) => set(campo, v),
  });

  return (
    <div className="space-y-4">
      {/* Ajuda de topo: a regra de precedência em uma frase. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
        <PlugZap className="size-3.5 text-primary" />
        <span>
          A configuração é <span className="font-medium text-foreground">salva no portal</span> e
          tem <span className="font-medium text-foreground">precedência sobre o .env</span> do
          servidor — o <span className="font-medium text-foreground">.env</span> é apenas o valor
          inicial de uma instalação nova.
        </span>
      </div>

      {/* ---------- Estado atual ---------- */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Wifi className="size-4 text-primary" /> Estado atual
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <FlagBadge
                ligado={data.ssoConfigurado}
                label="SSO configurado"
                desligadoTexto="faltam tenantId e/ou clientId"
              />
              <FlagBadge
                ligado={data.graphAtivo}
                label="Graph ativo"
                desligadoTexto="faltam tenant, client ou segredo"
              />
              <FlagBadge
                ligado={data.barreiraAtiva}
                label="Barreira de login"
                desligadoTexto="portal aberto (modo demo)"
              />
              <FlagBadge
                ligado={data.itsmAtivo}
                label="Chamados (ITSM)"
                desligadoTexto="URL ou escopo não configurados"
              />
            </div>
            {data.atualizadoEm && (
              <p className="mt-2 text-xs text-muted-foreground">
                Última alteração {tempoRelativo(data.atualizadoEm)}
                {data.atualizadoPor ? ` por ${data.atualizadoPor}` : ""}.
              </p>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={testar} disabled={testando}>
            <PlugZap className="size-4" /> {testando ? "Testando…" : "Testar conexão"}
          </Button>
        </div>

        {/* Resultado do teste: fala com as credenciais SALVAS, não com o formulário. */}
        {teste && (
          <Alert
            variant={teste.ok ? "default" : "destructive"}
            className={cn("mt-3", teste.ok && "border-primary/40")}
          >
            {teste.ok ? <CircleCheckBig /> : <TriangleAlert />}
            <AlertTitle>{teste.ok ? "Conexão bem-sucedida" : "Falha ao conectar"}</AlertTitle>
            <AlertDescription>
              {teste.detalhe}
              {typeof teste.grupos === "number" && ` (${teste.grupos} grupo(s))`}
            </AlertDescription>
          </Alert>
        )}
      </section>

      {/* ---------- SSO / Entra ID ---------- */}
      <Secao
        icon={ShieldCheck}
        titulo="SSO / Entra ID"
        descricao="Registro de app usado pelo login dos usuários e pelo acesso app-only ao Microsoft Graph."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            {...props("tenantId")}
            label="Tenant ID"
            hint="GUID do diretório (Entra ID)."
            placeholder="00000000-0000-0000-0000-000000000000"
          />
          <Campo
            {...props("clientId")}
            label="Client ID"
            hint="ID do aplicativo (cliente) registrado no Entra."
            placeholder="00000000-0000-0000-0000-000000000000"
          />

          {/* Segredo: o backend nunca o devolve (só `temSecret`). Campo em branco = mantém. */}
          <Field
            label="Client secret"
            htmlFor="integracao-clientSecret"
            hint={
              data.temSecret
                ? "Já existe um segredo salvo. Deixe em branco para mantê-lo; digite um novo para substituir."
                : "Nenhum segredo salvo — sem ele o Graph e o ITSM não sobem."
            }
          >
            <div className="flex items-center gap-2">
              <Input
                id="integracao-clientSecret"
                type="password"
                autoComplete="new-password"
                value={form.clientSecret}
                placeholder={data.temSecret ? "•••••••• (mantém o atual)" : "cole o segredo do app"}
                onChange={(e) => set("clientSecret", e.target.value)}
                className="flex-1"
              />
              {data.temSecret ? (
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                  <Lock className="size-3" /> segredo salvo
                </Badge>
              ) : (
                <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                  <TriangleAlert className="size-3" /> sem segredo
                </Badge>
              )}
            </div>
          </Field>

          <Campo
            {...props("adminGroupId")}
            label="Grupo de administradores (ID)"
            hint="Rede de segurança: quem está neste grupo do Entra é admin do portal."
            placeholder="00000000-0000-0000-0000-000000000000"
          />
          <Campo
            {...props("demoUserUpn")}
            label="Identidade do preview (UPN)"
            hint="ÚNICO usuário que o portal assume quando roda embutido (preview), onde o login do Entra é impossível. Vazio = sem SSO o portal não exibe conteúdo."
            placeholder="pessoa@empresa.com.br"
          />
        </div>

        {/* Barreira no backend: só vale ligar depois que o SSO estiver configurado. */}
        <label className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <span className="text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <KeyRound className="size-3.5 text-primary" /> Exigir login SSO (barreira no backend)
            </span>
            <span className="mt-0.5 block text-muted-foreground">
              Com a barreira ativa, toda chamada à API precisa de um token válido do tenant.
              {!data.ssoConfigurado && " Configure tenantId e clientId antes de ligar."}
            </span>
          </span>
          <Switch
            checked={form.authRequired}
            onCheckedChange={(v: boolean) => set("authRequired", v)}
          />
        </label>
        <div className="mt-1.5 flex justify-end">
          <OrigemBadge origem={origem.authRequired} />
        </div>

        {/* Aviso de TRANCA: ligar a barreira com um SSO que não funciona bloqueia todo mundo,
            inclusive esta tela (ela também fica atrás da barreira). Mostramos a saída de
            emergência ANTES do estrago, e só quando o admin está de fato ligando a chave. */}
        {form.authRequired && !data.barreiraAtiva && (
          <Alert className="mt-3 border-warning/40 bg-warning/10 text-warning">
            <TriangleAlert className="size-4" />
            <AlertTitle>Confira o SSO antes de salvar</AlertTitle>
            <AlertDescription className="text-warning/90">
              Se o login não estiver funcionando, ninguém entra no portal — nem esta tela, que
              também exige token. Para destravar sem mexer nos dados, defina{" "}
              <code className="rounded bg-warning/15 px-1">AUTH_REQUIRED=false</code> no ambiente
              do servidor e reinicie: isso força a barreira desligada mesmo com a chave ligada aqui.
            </AlertDescription>
          </Alert>
        )}
      </Secao>

      {/* ---------- Políticas internas ---------- */}
      <Secao
        icon={FileText}
        titulo="Políticas internas"
        descricao="Pasta compartilhada do SharePoint/OneDrive de onde os documentos são listados (leitura)."
      >
        <Campo
          {...props("politicasShareUrl")}
          label="URL da pasta compartilhada"
          hint="Link de compartilhamento da pasta — o portal lista os arquivos via Graph."
          placeholder="https://empresa.sharepoint.com/:f:/s/..."
        />
      </Secao>

      {/* ---------- Chamados (ITSM) ---------- */}
      <Secao
        icon={LifeBuoy}
        titulo="Chamados (ITSM)"
        descricao="Integração com o trustsis-itsm para abrir e listar chamados a partir do portal."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            {...props("itsmBaseUrl")}
            label="URL base da API"
            hint="Sem barra no final (o backend normaliza)."
            placeholder="https://itsm.empresa.com.br"
          />
          <Campo
            {...props("itsmApiScope")}
            label="Escopo da API"
            hint="Escopo app-only exposto pelo ITSM."
            placeholder="api://.../.default"
          />
          <Campo
            {...props("itsmTenantSubdomain")}
            label="Subdomínio do tenant no ITSM"
            hint="Identifica a organização dentro do ITSM."
            placeholder="trustsis"
          />
        </div>
      </Secao>

      {/* ---------- Salvar ---------- */}
      {erro && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {salvo && !erro && (
          <p className="text-xs text-muted-foreground">
            Configuração salva — agora ela tem precedência sobre o .env.
          </p>
        )}
        <Button onClick={salvar} disabled={salvando}>
          <Save className="size-4" /> {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
