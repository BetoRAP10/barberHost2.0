"use client";

import { useEffect, useMemo, useState } from "react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths,
  addDays, subDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, User, Scissors, CreditCard } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EstadoBadge, LoadingState } from "@/components/shared/status-badge";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { HORARIO_APERTURA, HORARIO_CIERRE, type CitaConDetalles } from "@/lib/types";
import { cn } from "@/lib/utils";

const HORAS = Array.from({ length: HORARIO_CIERRE - HORARIO_APERTURA }, (_, i) => i + HORARIO_APERTURA);

export default function AdminCalendarioPage() {
  const [citas, setCitas]               = useState<CitaConDetalles[]>([]);
  const [loading, setLoading]           = useState(true);
  const [currentDate, setCurrentDate]   = useState(new Date());
  const [view, setView]                 = useState<"mes" | "semana" | "dia">("mes");
  const [selectedCita, setSelectedCita] = useState<CitaConDetalles | null>(null);

  useEffect(() => {
    fetch("/api/citas")
      .then((r) => r.json())
      .then((d) => setCitas(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const citasDelDia = (date: Date) =>
    citas.filter(
      (c) => c.fecha_hora.startsWith(format(date, "yyyy-MM-dd")) && c.estado !== "cancelada"
    );

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(currentDate),   { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end   = endOfWeek(currentDate,   { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const prev = () => {
    if (view === "mes")    setCurrentDate(subMonths(currentDate, 1));
    if (view === "semana") setCurrentDate(subDays(currentDate, 7));
    if (view === "dia")    setCurrentDate(subDays(currentDate, 1));
  };
  const next = () => {
    if (view === "mes")    setCurrentDate(addMonths(currentDate, 1));
    if (view === "semana") setCurrentDate(addDays(currentDate, 7));
    if (view === "dia")    setCurrentDate(addDays(currentDate, 1));
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Calendario" }]} />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendario</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="size-4" /></Button>
          <span className="min-w-[200px] text-center font-medium capitalize text-sm">
            {view === "dia"
              ? format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es })
              : format(currentDate, "MMMM yyyy", { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={next}><ChevronRight className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoy</Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList className="mb-4">
          <TabsTrigger value="mes">Mensual</TabsTrigger>
          <TabsTrigger value="semana">Semanal</TabsTrigger>
          <TabsTrigger value="dia">Diario</TabsTrigger>
        </TabsList>

        {/* ── Vista Mensual ── */}
        <TabsContent value="mes">
          <Card>
            <CardContent className="pt-4">
              <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground">
                {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d) => (
                  <div key={d} className="py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day) => {
                  const dayCitas  = citasDelDia(day);
                  const pendientes = dayCitas.filter((c) => c.estado === "pendiente").length;
                  const isToday   = isSameDay(day, new Date());
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => { setCurrentDate(day); setView("dia"); }}
                      className={cn(
                        "min-h-[90px] rounded-lg border p-1.5 text-left text-sm transition-all hover:border-primary hover:bg-muted/30",
                        !isSameMonth(day, currentDate) && "opacity-30",
                        isToday && "border-primary bg-primary/5",
                        dayCitas.length > 0 && !isToday && "border-primary/20 bg-primary/3"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-xs font-semibold", isToday && "text-primary")}>{format(day, "d")}</span>
                        {dayCitas.length > 0 && (
                          <span className={cn(
                            "text-[10px] font-bold rounded-full px-1.5 py-0.5",
                            pendientes > 0 ? "bg-orange-500 text-white" : "bg-primary text-primary-foreground"
                          )}>
                            {dayCitas.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayCitas.slice(0, 3).map((c) => (
                          <div
                            key={c.id}
                            className={cn(
                              "truncate rounded px-1 text-[10px] leading-4",
                              c.estado === "pendiente"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-primary/15 text-primary"
                            )}
                          >
                            {format(new Date(c.fecha_hora), "HH:mm")} · {c.cliente_nombre.split(" ")[0]}
                          </div>
                        ))}
                        {dayCitas.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{dayCitas.length - 3} más</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Vista Semanal ── */}
        <TabsContent value="semana">
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const dayCitas = citasDelDia(day);
              const isToday  = isSameDay(day, new Date());
              return (
                <Card key={day.toISOString()} className={cn(isToday && "border-primary")}>
                  <CardHeader className="pb-2 pt-3 px-3">
                    <button
                      type="button"
                      onClick={() => { setCurrentDate(day); setView("dia"); }}
                      className="text-left hover:text-primary transition-colors"
                    >
                      <CardTitle className={cn("text-sm capitalize", isToday && "text-primary")}>
                        {format(day, "EEE d", { locale: es })}
                      </CardTitle>
                    </button>
                  </CardHeader>
                  <CardContent className="space-y-1 px-2 pb-3">
                    {dayCitas.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground px-1">Libre</p>
                    ) : (
                      dayCitas.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCita(c)}
                          className={cn(
                            "block w-full rounded px-1.5 py-1 text-left text-[10px] leading-tight hover:opacity-80 transition-opacity",
                            c.estado === "pendiente"
                              ? "bg-orange-100 text-orange-800 border border-orange-200"
                              : "bg-primary/10 text-primary border border-primary/20"
                          )}
                        >
                          <span className="font-semibold">{format(new Date(c.fecha_hora), "HH:mm")}</span>
                          <span className="block truncate">{c.cliente_nombre.split(" ")[0]}</span>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Vista Diaria — timeline ── */}
        <TabsContent value="dia">
          <Card>
            <CardHeader>
              <CardTitle className="capitalize flex items-center gap-3">
                {format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
                {citasDelDia(currentDate).length > 0 && (
                  <Badge variant="secondary">{citasDelDia(currentDate).length} cita(s)</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {HORAS.map((hour) => {
                  const hourCitas = citasDelDia(currentDate).filter(
                    (c) => parseInt(c.fecha_hora.split("T")[1]?.slice(0, 2) ?? "-1", 10) === hour
                  );
                  const isCurrentHour = new Date().getHours() === hour && isSameDay(currentDate, new Date());
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "flex gap-3 border-b min-h-[64px] py-2",
                        isCurrentHour && "bg-primary/3"
                      )}
                    >
                      {/* Hora */}
                      <div className="w-14 shrink-0 pt-0.5">
                        <span className={cn(
                          "text-sm font-medium tabular-nums",
                          isCurrentHour ? "text-primary font-bold" : "text-muted-foreground"
                        )}>
                          {String(hour).padStart(2, "0")}:00
                        </span>
                      </div>

                      {/* Citas de esta hora */}
                      <div className="flex-1 space-y-1.5">
                        {hourCitas.length === 0 ? (
                          <div className="flex items-center h-full">
                            <span className="text-xs text-muted-foreground/40">— libre</span>
                          </div>
                        ) : (
                          hourCitas.map((c) => {
                            const inicio  = format(new Date(c.fecha_hora), "HH:mm");
                            const durMin  = c.duracion_total > 0 ? c.duracion_total : c.servicio_duracion;
                            const finDate = new Date(new Date(c.fecha_hora).getTime() + durMin * 60000);
                            const fin     = format(finDate, "HH:mm");
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setSelectedCita(c)}
                                className={cn(
                                  "w-full rounded-lg border px-3 py-2 text-left transition-all hover:shadow-md",
                                  c.estado === "pendiente"
                                    ? "border-orange-300 bg-orange-50 hover:bg-orange-100"
                                    : c.estado === "completada"
                                    ? "border-green-200 bg-green-50 hover:bg-green-100"
                                    : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-bold text-sm tabular-nums shrink-0">{inicio}–{fin}</span>
                                    <span className="font-semibold text-sm truncate">{c.cliente_nombre}</span>
                                  </div>
                                  <EstadoBadge estado={c.estado} />
                                </div>
                                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Scissors className="size-3" /> {c.servicio_nombre}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="size-3" /> {durMin} min
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <CreditCard className="size-3" /> {formatCurrency(c.precio_total)}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog detalle ── */}
      <Dialog open={!!selectedCita} onOpenChange={() => setSelectedCita(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de cita</DialogTitle></DialogHeader>
          {selectedCita && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{selectedCita.cliente_nombre}</p>
                  {selectedCita.cliente_email    && <p className="text-muted-foreground text-xs">{selectedCita.cliente_email}</p>}
                  {selectedCita.cliente_telefono && <p className="text-muted-foreground text-xs">{selectedCita.cliente_telefono}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Scissors className="size-4 text-muted-foreground" />
                <span>{selectedCita.servicio_nombre}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <span>{formatDateTime(selectedCita.fecha_hora)} · {selectedCita.duracion_total || selectedCita.servicio_duracion} min</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-muted-foreground" />
                <span>{formatCurrency(selectedCita.precio_total)} · {selectedCita.stripe_payment_status}</span>
              </div>
              <EstadoBadge estado={selectedCita.estado} />
              {selectedCita.notas && (
                <p className="border-t pt-2 text-muted-foreground italic">{selectedCita.notas}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
