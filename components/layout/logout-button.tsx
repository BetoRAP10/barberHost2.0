"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { redirectToAdminLogin } from "@/lib/admin-utils";

export function LogoutButton({ className }: { className?: string }) {
  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    toast.success("Sesión cerrada");
    redirectToAdminLogin();
  };

  return (
    <Button variant="outline" className={cn("w-full", className)} onClick={handleLogout}>
      <LogOut className="size-4" />
      Cerrar sesión
    </Button>
  );
}
