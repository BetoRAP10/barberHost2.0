"use client";

import { useEffect, useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EstadoBadge, LoadingState } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/utils";
import type { CitaConDetalles } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminCalendarioPage() {
  const [citas, setCitas] = useState<CitaConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"mes" | "semana" | "dia">("mes");
  const [selectedCita, setSelectedCita] = useState<CitaConDetalles | null>(null);

  useEffect(() => {
    fetch("/api/citas")
      .then((r) => r.json())
      .then(setCitas)
      .finally(() => setLoading(false));
  }, []);

  const citasDelDia = (date: Date) =>
    citas.filter((c) => isSameDay(new Date(c.fecha_hora), date) && c.estado !== "cancelada");

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  if (loading) return <LoadingState />;

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Calendario" }]} />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendario</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[180px] text-center font-medium capitalize">
            {format(currentDate, view === "dia" ? "EEEE, d MMMM yyyy" : "MMMM yyyy", { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="mes">Mensual</TabsTrigger>
          <TabsTrigger value="semana">Semanal</TabsTrigger>
          <TabsTrigger value="dia">Diario</TabsTrigger>
        </TabsList>

        <TabsContent value="mes">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day) => {
                  const dayCitas = citasDelDia(day);
                  const occupied = dayCitas.length > 0;
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => { setCurrentDate(day); setView("dia"); }}
                      className={cn(
                        "min-h-[80px] rounded-lg border p-1 text-left text-sm transition-colors hover:bg-muted/50",
                        !isSameMonth(day, currentDate) && "opacity-40",
                        occupied && "border-primary/30 bg-primary/5"
                      )}
                    >
                      <span className="font-medium">{format(day, "d")}</span>
                      {dayCitas.slice(0, 2).map((c) => (
                        <div key={c.id} className="mt-0.5 truncate rounded bg-primary/20 px-1 text-[10px]">
                          {format(new Date(c.fecha_hora), "HH:mm")} {c.cliente_nombre.split(" ")[0]}
                        </div>
                      ))}
                      {dayCitas.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{dayCitas.length - 2} más</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="semana">
          <div className="grid gap-2 md:grid-cols-7">
            {weekDays.map((day) => (
              <Card key={day.toISOString()}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm capitalize">
                    {format(day, "EEE d", { locale: es })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {citasDelDia(day).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Libre</p>
                  ) : (
                    citasDelDia(day).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCita(c)}
                        className="block w-full rounded bg-primary/10 p-1.5 text-left text-xs hover:bg-primary/20"
                      >
                        {format(new Date(c.fecha_hora), "HH:mm")} · {c.cliente_nombre}
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="dia">
          <Card>
            <CardHeader>
              <CardTitle className="capitalize">
                {format(currentDate, "EEEE, d 'de' MMMM", { locale: es })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {citasDelDia(currentDate).length === 0 ? (
                <p className="text-muted-foreground">No hay citas este día</p>
              ) : (
                <div className="space-y-2">
                  {Array.from({ length: 10 }, (_, i) => i + 9).map((hour) => {
                    const hourCitas = citasDelDia(currentDate).filter(
                      (c) => new Date(c.fecha_hora).getHours() === hour
                    );
                    return (
                      <div key={hour} className="flex gap-4 border-b py-2">
                        <span className="w-12 text-sm text-muted-foreground">{hour}:00</span>
                        <div className="flex-1 space-y-1">
                          {hourCitas.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setSelectedCita(c)}
                              className="block w-full rounded-lg border border-primary/30 bg-primary/5 p-2 text-left text-sm"
                            >
                              {format(new Date(c.fecha_hora), "HH:mm")} — {c.cliente_nombre} ({c.servicio_nombre})
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedCita} onOpenChange={() => setSelectedCita(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de cita</DialogTitle></DialogHeader>
          {selectedCita && (
            <div className="space-y-2 text-sm">
              <p><strong>Cliente:</strong> {selectedCita.cliente_nombre}</p>
              <p><strong>Email:</strong> {selectedCita.cliente_email}</p>
              <p><strong>Servicio:</strong> {selectedCita.servicio_nombre}</p>
              <p><strong>Fecha:</strong> {formatDateTime(selectedCita.fecha_hora)}</p>
              <EstadoBadge estado={selectedCita.estado} />
              {selectedCita.notas && <p><strong>Notas:</strong> {selectedCita.notas}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
