import { Routes, Route } from "react-router-dom";
import { PortalProvider } from "@/context/PortalProvider";
import AppLayout from "@/components/portal/AppLayout";
import HomePage from "@/pages/HomePage";
import ComunicadosPage from "@/pages/ComunicadosPage";
import EventosPage from "@/pages/EventosPage";
import AniversariantesPage from "@/pages/AniversariantesPage";
import FeriasPage from "@/pages/FeriasPage";
import OrganogramaPage from "@/pages/OrganogramaPage";
import LinksPage from "@/pages/LinksPage";
import SocialPage from "@/pages/SocialPage";

// Portal interno TrustSis: PortalProvider carrega o /api/me (Graph/Entra ou demo) e
// o AppLayout (sidebar + topbar) envolve as páginas via <Outlet/>.
export default function App() {
  return (
    <PortalProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="comunicados" element={<ComunicadosPage />} />
          <Route path="eventos" element={<EventosPage />} />
          <Route path="aniversariantes" element={<AniversariantesPage />} />
          <Route path="ferias" element={<FeriasPage />} />
          <Route path="organograma" element={<OrganogramaPage />} />
          <Route path="links" element={<LinksPage />} />
          <Route path="social" element={<SocialPage />} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </PortalProvider>
  );
}
