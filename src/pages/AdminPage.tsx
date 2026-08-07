// ADMINISTRAÇÃO — página ÚNICA com tudo que é de admin do portal (só aparece para quem tem
// perfil admin; a rota é protegida em App.tsx e cada endpoint é validado no backend).
// Abas: Perfis de acesso (RBAC) • Atividade de pontos (auditoria) • Diagnóstico.
// Novas capacidades de admin (bibliotecas, links por perfil, auditoria…) entram aqui como
// novas abas, em vez de virarem itens soltos no menu.
import { useMemo, useState } from "react";
import { ShieldCheck, Activity, Stethoscope, Users, LayoutList, Wifi, WifiOff, PlugZap } from "lucide-react";
import { usePortal } from "@/context/PortalProvider";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { ultimosMeses, nomeDoMes } from "@/lib/gamification";
import { tempoRelativo } from "@/lib/format";
import { PageHeader } from "@/components/portal/page-kit";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PerfisAdmin } from "@/components/admin/PerfisAdmin";
import { IntegracaoAdmin } from "@/components/admin/IntegracaoAdmin";
import { AtividadePontosAdmin } from "@/components/portal/AtividadePontosAdmin";
import { ScanStatus } from "@/components/portal/ScanStatus";

export default function AdminPage() {
  const meses = useMemo(() => ultimosMeses(), []);
  const [mes, setMes] = useState(meses[0]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Administração"
        description="Perfis de acesso, integração com o Entra ID, auditoria e diagnóstico — tudo em um só lugar."
      />

      <Tabs defaultValue="perfis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="perfis">
            <ShieldCheck className="size-4" /> Perfis de acesso
          </TabsTrigger>
          <TabsTrigger value="integracao">
            <PlugZap className="size-4" /> Integração
          </TabsTrigger>
          <TabsTrigger value="atividade">
            <Activity className="size-4" /> Atividade de pontos
          </TabsTrigger>
          <TabsTrigger value="diagnostico">
            <Stethoscope className="size-4" /> Diagnóstico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfis">
          <PerfisAdmin />
        </TabsContent>

        {/* SSO / Entra ID / Graph / ITSM — configuração que antes vivia só no .env. */}
        <TabsContent value="integracao">
          <IntegracaoAdmin />
        </TabsContent>

        <TabsContent value="atividade" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Extrato de pontuação por dia: quem pontuou e como (auditoria da gamificação).
            </p>
            <NativeSelect
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-44"
              aria-label="Mês"
            >
              {meses.map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {nomeDoMes(m)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <AtividadePontosAdmin mes={mes} />
        </TabsContent>

        <TabsContent value="diagnostico">
          <Diagnostico />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Estado da integração (Graph/Entra), do scan diário e do acesso do próprio admin. */
function Diagnostico() {
  const { me, mode, perfis, paginas } = usePortal();
  const { data: saude } = useAsync(() => api.health(), []);
  const { data: scan, reload } = useAsync(() => api.scan.status(), []);
  const grupos = me?.acesso?.grupos ?? [];

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          {saude?.graph ? <Wifi className="size-4 text-primary" /> : <WifiOff className="size-4 text-warning" />}
          Integração Microsoft Graph
        </h3>
        <dl className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Modo</dt>
            <dd>
              <Badge variant="outline" className={mode === "graph" ? "border-primary/40 bg-primary/10 text-primary" : "border-warning/40 bg-warning/10 text-warning"}>
                {mode === "graph" ? "Graph (Entra ID)" : "Demo (dados de exemplo)"}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Sincronização (organograma / férias)</dt>
            <dd className="text-foreground">
              {scan?.atualizadoEm ? tempoRelativo(scan.atualizadoEm) : "ainda não sincronizado"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Pessoas no último scan</dt>
            <dd className="font-medium text-foreground">{scan?.pessoas ?? 0}</dd>
          </div>
        </dl>
        <div className="mt-3 border-t border-border pt-3">
          <ScanStatus onRefreshed={reload} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="size-4 text-primary" /> Seu acesso
        </h3>
        <dl className="space-y-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Perfis aplicados</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {perfis.length === 0 ? (
                <span className="text-foreground">—</span>
              ) : (
                perfis.map((p) => (
                  <Badge key={p.id} variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                    {p.nome}
                  </Badge>
                ))
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Grupos do Entra do seu usuário</dt>
            <dd className="font-medium text-foreground">{grupos.length}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <LayoutList className="size-3.5" /> Páginas liberadas ({paginas.length})
            </dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {paginas.map((r) => (
                <Badge key={r} variant="outline" className="border-border text-muted-foreground">
                  {r}
                </Badge>
              ))}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
