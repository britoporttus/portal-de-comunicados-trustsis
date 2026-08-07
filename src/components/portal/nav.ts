import {
  Home, Megaphone, CalendarDays, Cake, Plane, Network, LayoutGrid, Share2,
  Trophy, MessageSquareHeart, Ticket, ScrollText, MessageSquareWarning, ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Item de administração: só aparece para quem tem perfil admin. */
  admin?: boolean;
}

export const NAV: NavItem[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/comunicados", label: "Comunicados", icon: Megaphone },
  { to: "/eventos", label: "Eventos", icon: CalendarDays },
  { to: "/aniversariantes", label: "Aniversariantes", icon: Cake },
  { to: "/ferias", label: "Quem está de férias", icon: Plane },
  { to: "/organograma", label: "Organograma", icon: Network },
  { to: "/links", label: "Links úteis", icon: LayoutGrid },
  { to: "/politicas", label: "Políticas internas", icon: ScrollText },
  { to: "/social", label: "Redes sociais", icon: Share2 },
  { to: "/tickets", label: "Tickets", icon: Ticket },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/feedback", label: "Feedback", icon: MessageSquareHeart },
  { to: "/reportar", label: "Feedback do portal", icon: MessageSquareWarning },
  // Administração: página ÚNICA com tudo de admin (perfis de acesso, auditoria de pontos,
  // diagnóstico). Só aparece para quem tem perfil admin.
  { to: "/admin", label: "Administração", icon: ShieldCheck, admin: true },
];
