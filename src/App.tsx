import type { ReactElement } from "react";
import { Routes, Route } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/portal/page-kit";
import { PortalProvider, usePortal } from "@/context/PortalProvider";
import AppLayout from "@/components/portal/AppLayout";
import AuthGate from "@/components/portal/AuthGate";
import HomePage from "@/pages/HomePage";
import ComunicadosPage from "@/pages/ComunicadosPage";
import ComunicadoDetalhePage from "@/pages/ComunicadoDetalhePage";
import EventosPage from "@/pages/EventosPage";
import EventoDetalhePage from "@/pages/EventoDetalhePage";
import AniversariantesPage from "@/pages/AniversariantesPage";
import FeriasPage from "@/pages/FeriasPage";
import OrganogramaPage from "@/pages/OrganogramaPage";
import LinksPage from "@/pages/LinksPage";
import SocialPage from "@/pages/SocialPage";
import RankingPage from "@/pages/RankingPage";
import FeedbackPage from "@/pages/FeedbackPage";
import TicketsPage from "@/pages/TicketsPage";
import PoliticasPage from "@/pages/PoliticasPage";
import DocumentosPage from "@/pages/DocumentosPage";
import MeusArquivosPage from "@/pages/MeusArquivosPage";
import ReportarPage from "@/pages/ReportarPage";
import AdminPage from "@/pages/AdminPage";

// Portal interno TrustSis: PortalProvider carrega o /api/me (Graph/Entra ou demo) e
// o AppLayout (sidebar + topbar) envolve as páginas via <Outlet/>.
// Em produção (SSO ligado), sem usuário autenticado = gate de login obrigatório (força o
// SSO, nunca mostra os dados de demo). No preview (auth desligado) needsLogin é sempre
// false → o portal roda normal com os dados de demo.
/** Rota protegida pelo RBAC: sem a página liberada no perfil, mostra o aviso em vez do
 *  conteúdo (o backend também nega — isto é só usabilidade). `admin` exige perfil admin. */
function Protegida({ rota, admin, children }: { rota: string; admin?: boolean; children: ReactElement }) {
  const { isAdmin, podeVerPagina, loading } = usePortal();
  if (loading) return null;
  const liberada = admin ? isAdmin : podeVerPagina(rota);
  if (!liberada) return <SemAcesso />;
  return children;
}

function SemAcesso() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Sem acesso a esta página"
      description="Seu perfil de acesso não inclui esta área do portal. Fale com o administrador se precisar dela."
    />
  );
}

function Gated() {
  const { needsLogin } = usePortal();
  if (needsLogin) return <AuthGate />;
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="comunicados" element={<Protegida rota="/comunicados"><ComunicadosPage /></Protegida>} />
        <Route path="comunicados/:id" element={<Protegida rota="/comunicados"><ComunicadoDetalhePage /></Protegida>} />
        <Route path="eventos" element={<Protegida rota="/eventos"><EventosPage /></Protegida>} />
        <Route path="eventos/:id" element={<Protegida rota="/eventos"><EventoDetalhePage /></Protegida>} />
        <Route path="aniversariantes" element={<Protegida rota="/aniversariantes"><AniversariantesPage /></Protegida>} />
        <Route path="ferias" element={<Protegida rota="/ferias"><FeriasPage /></Protegida>} />
        <Route path="organograma" element={<Protegida rota="/organograma"><OrganogramaPage /></Protegida>} />
        <Route path="links" element={<Protegida rota="/links"><LinksPage /></Protegida>} />
        <Route path="politicas" element={<Protegida rota="/politicas"><PoliticasPage /></Protegida>} />
        <Route path="documentos" element={<Protegida rota="/documentos"><DocumentosPage /></Protegida>} />
        <Route path="meus-arquivos" element={<Protegida rota="/meus-arquivos"><MeusArquivosPage /></Protegida>} />
        <Route path="social" element={<Protegida rota="/social"><SocialPage /></Protegida>} />
        <Route path="tickets" element={<Protegida rota="/tickets"><TicketsPage /></Protegida>} />
        <Route path="ranking" element={<Protegida rota="/ranking"><RankingPage /></Protegida>} />
        <Route path="feedback" element={<Protegida rota="/feedback"><FeedbackPage /></Protegida>} />
        <Route path="reportar" element={<Protegida rota="/reportar"><ReportarPage /></Protegida>} />
        {/* Administração: página única (abas) com tudo que é de admin. */}
        <Route path="admin" element={<Protegida rota="/admin" admin><AdminPage /></Protegida>} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <PortalProvider>
      <Gated />
    </PortalProvider>
  );
}
