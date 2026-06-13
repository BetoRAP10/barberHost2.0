"use client";

import { useEffect, useState } from "react";
import { LoadingState } from "@/components/shared/status-badge";
import { redirectToAdminLogin } from "@/lib/admin-utils";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/session", { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          redirectToAdminLogin();
          return;
        }
        if (!res.ok) {
          redirectToAdminLogin();
          return;
        }
        setAuthorized(true);
      } catch {
        if (!cancelled) redirectToAdminLogin();
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  return <>{children}</>;
}
