import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Scissors,
  Ban,
  Users,
} from "lucide-react";

export const adminNavItems = [
  { href: "/admin",                 label: "Dashboard",       icon: LayoutDashboard },
  { href: "/admin/citas",           label: "Citas",           icon: Calendar },
  { href: "/admin/calendario",      label: "Calendario",      icon: CalendarDays },
  { href: "/admin/servicios",       label: "Servicios",       icon: Scissors },
  { href: "/admin/dias-bloqueados", label: "Días Bloqueados", icon: Ban },
  { href: "/admin/clientes",        label: "Clientes",        icon: Users },
] as const;
