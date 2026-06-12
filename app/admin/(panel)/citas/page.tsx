"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, ArrowUpDown, Clock, AlertCircle, User, Scissors, MoreVertical, Phone, Mail, CreditCard } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { EmptyState, EstadoBadge, LoadingState } from "@/components/shared/status-badge";
import { exportTableToPdf } from "@/lib/pdf-export";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { ESTADOS_CITA, type CitaConDetalles, type EstadoCita } from "@/lib/types";
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = "fecha_hora" | "cliente_nombre" | "servicio_nombre" | "estado";

export default function AdminCitasPage() {
  const [citas, setCitas] = useState<CitaConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("all");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fecha_hora");
  const [sortAsc, setSortAsc] = useState(true);
  const [reprogramarCita, setReprogramarCita] = useState<CitaConDetalles | null>(null);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newSlot, setNewSlot] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [calMonth, setCalMonth] = useState(new Date());

  const load = () => {
    setLoading(true);
    fetch("/api/citas")
      .then((r) => r.json())
      .then(async (data: CitaConDetalles[]) => {
        setCitas(data);
        // Auto-verificar citas pendientes con stripe_session_id para confirmarlas si ya fueron pagadas
        const pendientesConStripe = data.filter(
          (c) => c.estado === "pendiente" && c.stripe_session_id && c.stripe_payment_status !== "pagado"
        );
        if (pendientesConStripe.length > 0) {
          await Promise.allSettled(
            pendientesConStripe.map((c) =>
              fetch(`/api/stripe/verify?session_id=${encodeURIComponent(c.stripe_session_id!)}`)
                .catch(() => null)
            )
          );
          // Recargar citas después de verificar
          const r2 = await fetch("/api/citas");
          if (r2.ok) setCitas(await r2.json());
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const pendientes = useMemo(
    () => citas.filter((c) => c.estado === "pendiente"),
    [citas]
  );

  const filtered = useMemo(() => {
    return citas.filter((c) => {
      // Ocultar canceladas por defecto — solo mostrarlas si se filtran explícitamente
      if (filtroEstado === "all" && c.estado === "cancelada") return false;
      if (filtroEstado !== "all" && c.estado !== filtroEstado) return false;
      if (filtroFecha && !c.fecha_hora.startsWith(filtroFecha)) return false;
      return true;
    });
  }, [citas, filtroEstado, filtroFecha]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortAsc]);

  const cambiarEstado = async (id: number, estado: EstadoCita) => {
    try {
      const res = await fetch("/api/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "estado", id, estado }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Cita marcada como ${estado}`);
      load();
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const exportPdf = () => {
    exportTableToPdf(
      "Listado de Citas",
      `Generado el ${new Date().toLocaleDateString("es-MX")}`,
      [
        { header: "Cliente", key: "cliente" },
        { header: "Servicio", key: "servicio" },
        { header: "Fecha", key: "fecha" },
        { header: "Estado", key: "estado" },
        { header: "Precio", key: "precio" },
      ],
      sorted.map((c) => ({
        cliente: c.cliente_nombre,
        servicio: c.servicio_nombre,
        fecha: formatDateTime(c.fecha_hora),
        estado: c.estado,
        precio: formatCurrency(c.precio_total),
      }))
    );
    toast.success("PDF exportado");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  // Calendario: días con citas
  const citasDelDia = (date: Date) =>
    citas.filter((c) => isSameDay(new Date(c.fecha_hora), date) && c.estado !== "cancelada");

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calMonth), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(calMonth),   { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calMonth]);

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Citas" }]} />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Gestión de Citas</h1>
          {pendientes.length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button variant="outline" onClick={exportPdf}>
          <Download className="size-4" /> Exportar PDF
        </Button>
      </div>

      {/* ── Citas pendientes de pago ── */}
      {pendientes.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-orange-600">
            <AlertCircle className="size-4" />
            Citas pendientes de confirmación / pago
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendientes.map((cita) => (
              <Card key={cita.id} className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="pt-4 pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold truncate">
                        <User className="size-3.5 shrink-0 text-muted-foreground" />
                        {cita.cliente_nombre}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 truncate">
                        <Scissors className="size-3 shrink-0" />
                        {cita.servicio_nombre}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Clock className="size-3 shrink-0" />
                        {formatDateTime(cita.fecha_hora)}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary shrink-0">
                      {formatCurrency(cita.precio_total)}
                    </span>
                  </div>
                  <div className="flex gap-1 pt-1 border-t border-orange-200">
                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => cambiarEstado(cita.id, "confirmada")}>
                      Confirmar
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => cambiarEstado(cita.id, "cancelada")}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs: Tabla / Calendario ── */}
      <Tabs defaultValue="tabla">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="tabla">Tabla</TabsTrigger>
            <TabsTrigger value="calendario">Calendario</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {ESTADOS_CITA.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="w-auto"
            />
          </div>
        </div>

        {/* ── Vista Tabla ── */}
        <TabsContent value="tabla">
          {loading ? (
            <LoadingState />
          ) : sorted.length === 0 ? (
            <EmptyState title="Sin citas" description="No hay citas que coincidan con los filtros." />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("cliente_nombre")}>
                          Cliente <ArrowUpDown className="size-3" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("servicio_nombre")}>
                          Servicio <ArrowUpDown className="size-3" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("fecha_hora")}>
                          Fecha <ArrowUpDown className="size-3" />
                        </button>
                      </TableHead>
                      <TableHead>Duración</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((cita) => (
                      <TableRow
                        key={cita.id}
                        className={cn(cita.estado === "pendiente" && "bg-orange-50 dark:bg-orange-950/10")}
                      >
                        <TableCell>
                          <div>{cita.cliente_nombre}</div>
                          {cita.cliente_email && (
                            <div className="text-xs text-muted-foreground">{cita.cliente_email}</div>
                          )}
                        </TableCell>
                        <TableCell>{cita.servicio_nombre}</TableCell>
                        <TableCell>{formatDateTime(cita.fecha_hora)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {cita.duracion_total > 0 ? `${cita.duracion_total} min` : `${cita.servicio_duracion} min`}
                        </TableCell>
                        <TableCell>{formatCurrency(cita.precio_total)}</TableCell>
                        <TableCell><EstadoBadge estado={cita.estado} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {/* Botón 3 puntos — info del cliente */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button size="sm" variant="ghost" className="size-8 p-0">
                                  <MoreVertical className="size-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64" align="end">
                                <p className="mb-2 font-semibold text-sm">{cita.cliente_nombre}</p>
                                {cita.cliente_email && (
                                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                    <Mail className="size-3" /> {cita.cliente_email}
                                  </p>
                                )}
                                {cita.cliente_telefono && (
                                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                    <Phone className="size-3" /> {cita.cliente_telefono}
                                  </p>
                                )}
                                <div className="my-2 border-t" />
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                  <Scissors className="size-3" /> {cita.servicio_nombre}
                                </p>
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                  <Clock className="size-3" /> {formatDateTime(cita.fecha_hora)}
                                </p>
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <CreditCard className="size-3" />
                                  {formatCurrency(cita.precio_total)} · {cita.stripe_payment_status}
                                </p>
                                {cita.notas && (
                                  <p className="mt-2 text-xs italic text-muted-foreground border-t pt-2">{cita.notas}</p>
                                )}
                              </PopoverContent>
                            </Popover>

                            {/* pendiente sin Stripe: confirmar manualmente */}
                            {cita.estado === "pendiente" && !cita.stripe_session_id && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => cambiarEstado(cita.id, "confirmada")}>Confirmar</Button>
                                <Button size="sm" variant="destructive" onClick={() => cambiarEstado(cita.id, "cancelada")}>Cancelar</Button>
                              </>
                            )}
                            {/* pendiente con Stripe: pago en curso — solo cancelar */}
                            {cita.estado === "pendiente" && cita.stripe_session_id && (
                              <span className="text-xs text-muted-foreground italic px-1">Esperando pago…</span>
                            )}
                            {/* confirmada (pago listo): solo completar o reagendar */}
                            {cita.estado === "confirmada" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => cambiarEstado(cita.id, "completada")}>Completar</Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => { setReprogramarCita(cita); setNewDate(undefined); setNewSlot(""); setSlots([]); }}
                                >
                                  Reagendar
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Vista Calendario ── */}
        <TabsContent value="calendario">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="capitalize">
                  {format(calMonth, "MMMM yyyy", { locale: es })}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
                {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d) => (
                  <div key={d} className="py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day) => {
                  const dayCitas = citasDelDia(day);
                  const hasPending = dayCitas.some((c) => c.estado === "pendiente");
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[90px] rounded-lg border p-1 text-sm",
                        !isSameMonth(day, calMonth) && "opacity-30",
                        dayCitas.length > 0 && "border-primary/30 bg-primary/5",
                        hasPending && "border-orange-300 bg-orange-50 dark:bg-orange-950/20"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{format(day, "d")}</span>
                        {dayCitas.length > 0 && (
                          <span className={cn(
                            "text-[10px] font-bold rounded-full px-1",
                            hasPending ? "bg-orange-500 text-white" : "bg-primary text-primary-foreground"
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
                                ? "bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-100"
                                : "bg-primary/20 text-primary"
                            )}
                            title={`${format(new Date(c.fecha_hora), "HH:mm")} — ${c.cliente_nombre} (${c.servicio_nombre})`}
                          >
                            {format(new Date(c.fecha_hora), "HH:mm")} {c.cliente_nombre.split(" ")[0]}
                          </div>
                        ))}
                        {dayCitas.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{dayCitas.length - 3} más</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leyenda */}
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="size-3 rounded bg-primary/20" />
                  Confirmadas
                </div>
                <div className="flex items-center gap-1">
                  <div className="size-3 rounded bg-orange-200" />
                  Pendientes
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog Reprogramar ── */}
      <Dialog open={!!reprogramarCita} onOpenChange={() => setReprogramarCita(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprogramar cita — {reprogramarCita?.cliente_nombre}</DialogTitle>
          </DialogHeader>
          {reprogramarCita && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>Servicio: <strong>{reprogramarCita.servicio_nombre}</strong></p>
                <p>Hora actual: <strong>{format(new Date(reprogramarCita.fecha_hora), "dd MMM yyyy · HH:mm", { locale: es })}</strong></p>
              </div>
              <Calendar
                mode="single"
                selected={newDate}
                onSelect={async (d: Date | undefined) => {
                  if (!d) return;
                  setNewDate(d);
                  setNewSlot("");
                  const fecha = format(d, "yyyy-MM-dd");
                  const duracion = reprogramarCita.duracion_total > 0
                    ? reprogramarCita.duracion_total
                    : reprogramarCita.servicio_duracion;
                  const res = await fetch(`/api/citas?fecha=${fecha}&duracion=${duracion}&exclude_id=${reprogramarCita.id}`);
                  setSlots(await res.json());
                }}
                disabled={(date) => date < new Date() || date.getDay() === 0}
              />
              {slots.length > 0 && (() => {
                const slotActual = reprogramarCita.fecha_hora.split("T")[1]?.slice(0, 5) ?? "";
                return (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => {
                      const esMismaFecha = newDate && format(newDate, "yyyy-MM-dd") === reprogramarCita.fecha_hora.split("T")[0];
                      const esActual = esMismaFecha && slot === slotActual;
                      return (
                        <Button
                          key={slot}
                          variant={newSlot === slot ? "default" : "outline"}
                          size="sm"
                          disabled={esActual}
                          className={esActual ? "opacity-40 cursor-not-allowed" : ""}
                          onClick={() => setNewSlot(slot)}
                        >
                          {slot}{esActual ? " (actual)" : ""}
                        </Button>
                      );
                    })}
                  </div>
                );
              })()}
              {newDate && slots.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">No hay horarios disponibles este día</p>
              )}
              <Button
                className="w-full"
                disabled={!newDate || !newSlot}
                onClick={async () => {
                  const fecha_hora = `${format(newDate!, "yyyy-MM-dd")}T${newSlot}:00`;
                  const res = await fetch("/api/citas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "reprogramar", id: reprogramarCita.id, fecha_hora }),
                  });
                  if (res.ok) {
                    toast.success("Cita reprogramada");
                    setReprogramarCita(null);
                    load();
                  } else toast.error("Error al reprogramar");
                }}
              >
                Confirmar nueva fecha
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
