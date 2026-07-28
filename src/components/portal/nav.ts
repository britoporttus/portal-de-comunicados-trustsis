import {
  Home, Megaphone, CalendarDays, Cake, Plane, Network, LayoutGrid, Share2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/comunicados", label: "Comunicados", icon: Megaphone },
  { to: "/eventos", label: "Eventos", icon: CalendarDays },
  { to: "/aniversariantes", label: "Aniversariantes", icon: Cake },
  { to: "/ferias", label: "Quem está de férias", icon: Plane },
  { to: "/organograma", label: "Organograma", icon: Network },
  { to: "/links", label: "Links úteis", icon: LayoutGrid },
  { to: "/social", label: "Redes sociais", icon: Share2 },
];
