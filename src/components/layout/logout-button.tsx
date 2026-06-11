"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    toast.success("Sesión cerrada");
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <Button variant="outline" className="w-full" onClick={handleLogout}>
      <LogOut className="size-4" />
      Cerrar sesión
    </Button>
  );
}
