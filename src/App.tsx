import { Routes, Route } from "react-router-dom";
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
import ReportarPage from "@/pages/ReportarPage";

// Portal interno TrustSis: PortalProvider carrega o /api/me (Graph/Entra ou demo) e
// o AppLayout (sidebar + topbar) envolve as páginas via <Outlet/>.
// Em produção (SSO ligado), sem usuário autenticado = gate de login obrigatório (força o
// SSO, nunca mostra os dados de demo). No preview (auth desligado) needsLogin é sempre
// false → o portal roda normal com os dados de demo.
function Gated() {
  const { needsLogin } = usePortal();
  if (needsLogin) return <AuthGate />;
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="comunicados" element={<ComunicadosPage />} />
        <Route path="comunicados/:id" element={<ComunicadoDetalhePage />} />
        <Route path="eventos" element={<EventosPage />} />
        <Route path="eventos/:id" element={<EventoDetalhePage />} />
        <Route path="aniversariantes" element={<AniversariantesPage />} />
        <Route path="ferias" element={<FeriasPage />} />
        <Route path="organograma" element={<OrganogramaPage />} />
        <Route path="links" element={<LinksPage />} />
        <Route path="politicas" element={<PoliticasPage />} />
        <Route path="social" element={<SocialPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="ranking" element={<RankingPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="reportar" element={<ReportarPage />} />
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
