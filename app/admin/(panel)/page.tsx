"use client";

import { useEffect, useState } from "react";
import { Calendar, DollarSign, TrendingUp, Users, Store, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AdminBreadcrumb } from "@/components/layout/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, EstadoBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { handleAdminUnauthorized, getAdminBase } from "@/lib/admin-utils";
import type { DashboardStats, EstadoTienda } from "@/lib/types";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const COLORS = ["#ea580c", "#16a34a", "#dc2626", "#ca8a04"];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [estadoTienda, setEstadoTienda] = useState<EstadoTienda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [motivoCierre, setMotivoCierre] = useState("Cerrado temporalmente");
  const [cerrando, setCerrando] = useState(false);

  const BASE = getAdminBase();

  const loadEstadoTienda = async () => {
    try {
      const r = await fetch("/api/estado");
      if (r.ok) setEstadoTienda(await r.json());
    } catch {
      // no crítico
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [dashRes] = await Promise.all([
          fetch("/api/admin/dashboard"),
          loadEstadoTienda(),
        ]);
        if (!handleAdminUnauthorized(dashRes)) return;
        const data = await dashRes.json();
        if (!dashRes.ok || data?.error) {
          setError(true);
          return;
        }
        setStats(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cerrarTienda = async () => {
    if (!motivoCierre.trim()) {
      toast.error("Indica un motivo para el cierre");
      return;
    }
    setCerrando(true);
    try {
      const res = await fetch("/api/estado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cerrar", motivo: motivoCierre.trim() }),
      });
      if (!handleAdminUnauthorized(res)) return;
      if (!res.ok) throw new Error();
      toast.success("Tienda cerrada — no se aceptarán nuevas reservas");
      await loadEstadoTienda();
    } catch {
      toast.error("Error al cerrar la tienda");
    } finally {
      setCerrando(false);
    }
  };

  const abrirTienda = async () => {
    setCerrando(true);
    try {
      const res = await fetch("/api/estado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abrir" }),
      });
      if (!handleAdminUnauthorized(res)) return;
      if (!res.ok) throw new Error();
      toast.success("Tienda reabierta");
      await loadEstadoTienda();
    } catch {
      toast.error("Error al reabrir la tienda");
    } finally {
      setCerrando(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats || !Array.isArray(stats.estados_distribucion)) {
    return (
      <div>
        <AdminBreadcrumb items={[{ label: "Dashboard" }]} />
        <EmptyState
          title="Error al cargar el panel"
          description="No se pudieron obtener las estadísticas. Intenta recargar la página."
        />
      </div>
    );
  }

  const chartData = stats.estados_distribucion.map((e) => ({
    name: e.estado.charAt(0).toUpperCase() + e.estado.slice(1),
    value: e.total,
  }));

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Dashboard" }]} />
      <h1 className="mb-6 text-2xl font-bold">Panel de Control</h1>

      {/* Estado de la tienda */}
      <Card className={`mb-6 ${estadoTienda && !estadoTienda.abierta ? "border-destructive/50 bg-destructive/5" : ""}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Store className="size-4" />
            Estado de reservas
          </CardTitle>
          {estadoTienda && (
            <span className={`text-sm font-semibold ${estadoTienda.abierta ? "text-green-600" : "text-destructive"}`}>
              {estadoTienda.abierta ? "Abierta" : "Cerrada"}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {estadoTienda && !estadoTienda.abierta ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <p>{estadoTienda.motivo ?? "La tienda está cerrada y no se aceptan nuevas reservas."}</p>
              </div>
              <Button onClick={abrirTienda} disabled={cerrando}>
                Reabrir tienda
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Motivo del cierre</label>
                <Input
                  value={motivoCierre}
                  onChange={(e) => setMotivoCierre(e.target.value)}
                  placeholder="Ej. Vacaciones, mantenimiento..."
                />
              </div>
              <Button variant="destructive" onClick={cerrarTienda} disabled={cerrando}>
                Cerrar reservas
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Citas hoy</CardTitle>
            <Calendar className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.citas_hoy}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Citas esta semana</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.citas_semana}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ingresos semana</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(stats.ingresos_semana)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Próximas citas</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.proximas_citas.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximas citas</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.proximas_citas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay citas próximas</p>
            ) : (
              <div className="space-y-3">
                {stats.proximas_citas.map((cita) => (
                  <a
                    key={cita.id}
                    href={`${BASE}/admin/citas/`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{cita.cliente_nombre}</p>
                      <p className="text-sm text-muted-foreground">{cita.servicio_nombre}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(cita.fecha_hora)}</p>
                    </div>
                    <EstadoBadge estado={cita.estado} />
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución de estados</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
