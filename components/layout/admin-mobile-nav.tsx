"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getAdminBase } from "@/lib/admin-utils";
import { LogoutButton } from "@/components/layout/logout-button";
import { adminNavItems } from "@/components/layout/admin-nav-items";

export function AdminMobileNav() {
  const pathname = usePathname();
  const BASE = getAdminBase();

  return (
    <div className="border-b bg-card lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-semibold text-primary">BarberHost Admin</p>
        <LogoutButton className="w-auto shrink-0 text-xs" />
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
        {adminNavItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <a
              key={item.href}
              href={`${BASE}${item.href}/`}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
