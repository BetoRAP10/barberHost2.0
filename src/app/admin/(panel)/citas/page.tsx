"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, ArrowUpDown } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { EmptyState, EstadoBadge, LoadingState } from "@/components/shared/status-badge";
import { exportTableToPdf } from "@/lib/pdf-export";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { ESTADOS_CITA, type CitaConDetalles, type EstadoCita } from "@/lib/types";
import { format } from "date-fns";

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

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroEstado !== "all") params.set("estado", filtroEstado);
    if (filtroFecha) {
      params.set("fecha_desde", filtroFecha);
      params.set("fecha_hasta", filtroFecha);
    }
    fetch(`/api/citas?${params}`)
      .then((r) => r.json())
      .then(setCitas)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filtroEstado, filtroFecha]);

  const sorted = useMemo(() => {
    return [...citas].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
  }, [citas, sortKey, sortAsc]);

  const cambiarEstado = async (id: number, estado: EstadoCita) => {
    try {
      const res = await fetch("/api/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "estado", id, estado }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Cita ${estado}`);
      load();
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const exportPdf = () => {
    exportTableToPdf(
      "Listado de Citas",
      `Generado el ${new Date().toLocaleDateString("es-ES")}`,
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
        precio: formatCurrency(c.servicio_precio),
      }))
    );
    toast.success("PDF exportado");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Citas" }]} />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Gestión de Citas</h1>
        <Button variant="outline" onClick={exportPdf}>
          <Download className="size-4" /> Exportar PDF
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap gap-4 pt-6">
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ESTADOS_CITA.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} className="w-auto" />
        </CardContent>
      </Card>

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
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((cita) => (
                  <TableRow key={cita.id}>
                    <TableCell>{cita.cliente_nombre}</TableCell>
                    <TableCell>{cita.servicio_nombre}</TableCell>
                    <TableCell>{formatDateTime(cita.fecha_hora)}</TableCell>
                    <TableCell><EstadoBadge estado={cita.estado} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {cita.estado !== "confirmada" && (
                          <Button size="sm" variant="outline" onClick={() => cambiarEstado(cita.id, "confirmada")}>Confirmar</Button>
                        )}
                        {cita.estado !== "completada" && (
                          <Button size="sm" variant="outline" onClick={() => cambiarEstado(cita.id, "completada")}>Completar</Button>
                        )}
                        {cita.estado !== "cancelada" && (
                          <Button size="sm" variant="destructive" onClick={() => cambiarEstado(cita.id, "cancelada")}>Cancelar</Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => { setReprogramarCita(cita); setNewDate(undefined); setNewSlot(""); setSlots([]); }}>
                          Reprogramar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!reprogramarCita} onOpenChange={() => setReprogramarCita(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reprogramar cita</DialogTitle></DialogHeader>
          {reprogramarCita && (
            <div className="space-y-4">
              <Calendar
                mode="single"
                selected={newDate}
                onSelect={async (d: Date | undefined) => {
                  if (!d) return;
                  setNewDate(d);
                  const fecha = format(d, "yyyy-MM-dd");
                  const res = await fetch(`/api/citas?fecha=${fecha}&duracion=${reprogramarCita.servicio_duracion}&exclude_id=${reprogramarCita.id}`);
                  setSlots(await res.json());
                }}
                disabled={(date) => date < new Date() || date.getDay() === 0}
              />
              {slots.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot) => (
                    <Button key={slot} variant={newSlot === slot ? "default" : "outline"} size="sm" onClick={() => setNewSlot(slot)}>
                      {slot}
                    </Button>
                  ))}
                </div>
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
                Confirmar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
