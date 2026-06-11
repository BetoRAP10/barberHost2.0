"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Scissors,
  Ban,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/layout/logout-button";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/citas", label: "Citas", icon: Calendar },
  { href: "/admin/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/admin/servicios", label: "Servicios", icon: Scissors },
  { href: "/admin/dias-bloqueados", label: "Días Bloqueados", icon: Ban },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative hidden w-64 shrink-0 border-r bg-card lg:block">
      <div className="flex h-16 items-center border-b px-6 font-semibold text-primary">
        BarberHost Admin
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="absolute bottom-4 left-4 w-56">
        <LogoutButton />
      </div>
    </aside>
  );
}
