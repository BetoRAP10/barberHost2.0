"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Plus, Trash2, Clock, CalendarOff } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { EmptyState, LoadingState } from "@/components/shared/status-badge";
import { exportTableToPdf } from "@/lib/pdf-export";
import type { DiaBloqueado } from "@/lib/types";
import { handleAdminUnauthorized } from "@/lib/admin-utils";
import { format } from "date-fns";

export default function AdminDiasBloqueadosPage() {
  const [bloqueos, setBloqueos] = useState<DiaBloqueado[]>([]);
  const [loading, setLoading]   = useState(true);

  // Modal: múltiples días
  const [openDias, setOpenDias]         = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [motivoDias, setMotivoDias]     = useState("");
  const [horaInicioDias, setHoraInicioDias] = useState("");
  const [horaFinDias, setHoraFinDias]   = useState("");

  // Modal: tiempo muerto diario
  const [openMuerto, setOpenMuerto]     = useState(false);
  const [motivoMuerto, setMotivoMuerto] = useState("Hora de comida");
  const [horaInicioM, setHoraInicioM]  = useState("14:00");
  const [horaFinM, setHoraFinM]        = useState("15:00");

  const load = () => {
    setLoading(true);
    fetch("/api/dias-bloqueados")
      .then((r) => r.json())
      .then((data) => setBloqueos(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const bloqueosDiarios = bloqueos.filter((b) => b.tipo === "diario");
  const bloqueosFecha   = bloqueos.filter((b) => b.tipo !== "diario");

  const guardarDias = async () => {
    if (!selectedDates.length || !motivoDias) return;
    // Validar horas si se especifican
    if (horaInicioDias && !horaFinDias) {
      toast.error("Si especificas hora de inicio, debes indicar también la hora de fin");
      return;
    }
    if (!horaInicioDias && horaFinDias) {
      toast.error("Si especificas hora de fin, debes indicar también la hora de inicio");
      return;
    }
    if (horaInicioDias && horaFinDias && horaFinDias <= horaInicioDias) {
      toast.error("La hora de fin debe ser posterior a la hora de inicio");
      return;
    }
    try {
      const res = await fetch("/api/dias-bloqueados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechas:      selectedDates.map((d) => format(d, "yyyy-MM-dd")),
          motivo:      motivoDias,
          hora_inicio: horaInicioDias || null,
          hora_fin:    horaFinDias    || null,
        }),
      });
      if (!handleAdminUnauthorized(res)) return;
      if (!res.ok) throw new Error();
      toast.success(`${selectedDates.length} día(s) bloqueado(s)`);
      setOpenDias(false);
      setSelectedDates([]);
      setMotivoDias("");
      setHoraInicioDias("");
      setHoraFinDias("");
      load();
    } catch {
      toast.error("Error al bloquear");
    }
  };

  const guardarMuerto = async () => {
    if (!horaInicioM || !horaFinM || !motivoMuerto) return;
    if (horaFinM <= horaInicioM) {
      toast.error("La hora de fin debe ser posterior a la hora de inicio");
      return;
    }
    // Verificar duplicados
    const duplicado = bloqueosDiarios.some(
      (b) => b.hora_inicio === horaInicioM && b.hora_fin === horaFinM
    );
    if (duplicado) {
      toast.error("Ya existe un tiempo muerto con ese mismo horario");
      return;
    }
    try {
      const res = await fetch("/api/dias-bloqueados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo:        "diario",
          motivo:      motivoMuerto,
          hora_inicio: horaInicioM,
          hora_fin:    horaFinM,
        }),
      });
      if (!handleAdminUnauthorized(res)) return;
      if (!res.ok) throw new Error();
      toast.success("Tiempo muerto agregado");
      setOpenMuerto(false);
      load();
    } catch {
      toast.error("Error al guardar");
    }
  };

  const eliminar = async (id: number) => {
    const res = await fetch(`/api/dias-bloqueados?id=${id}`, { method: "DELETE" });
    if (!handleAdminUnauthorized(res)) return;
    if (!res.ok) {
      toast.error("Error al eliminar bloqueo");
      return;
    }
    toast.success("Bloqueo eliminado");
    load();
  };

  const exportPdf = () => {
    exportTableToPdf(
      "Días Bloqueados",
      new Date().toLocaleDateString("es-MX"),
      [{ header: "Fecha", key: "fecha" }, { header: "Horario", key: "horario" }, { header: "Motivo", key: "motivo" }],
      bloqueosFecha.map((b) => ({
        fecha:   b.fecha,
        horario: b.hora_inicio && b.hora_fin ? `${b.hora_inicio}–${b.hora_fin}` : "Todo el día",
        motivo:  b.motivo,
      }))
    );
    toast.success("PDF exportado");
  };

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Días Bloqueados" }]} />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Horarios y Días Bloqueados</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportPdf}><Download className="size-4" /> PDF</Button>

          {/* Modal: tiempo muerto diario */}
          <Dialog open={openMuerto} onOpenChange={setOpenMuerto}>
            <DialogTrigger asChild>
              <Button variant="outline"><Clock className="size-4" /> Tiempo muerto</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Agregar tiempo muerto diario</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">
                Este horario se bloqueará todos los días (ej. hora de comida).
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Hora inicio</Label>
                    <Input type="time" value={horaInicioM} onChange={(e) => setHoraInicioM(e.target.value)} />
                  </div>
                  <div>
                    <Label>Hora fin</Label>
                    <Input type="time" value={horaFinM} onChange={(e) => setHoraFinM(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Input value={motivoMuerto} onChange={(e) => setMotivoMuerto(e.target.value)} placeholder="Hora de comida, descanso..." />
                </div>
                <Button className="w-full" onClick={guardarMuerto} disabled={!horaInicioM || !horaFinM}>
                  Guardar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal: bloquear días */}
          <Dialog open={openDias} onOpenChange={(o) => { setOpenDias(o); if (!o) { setSelectedDates([]); setMotivoDias(""); } }}>
            <DialogTrigger asChild>
              <Button><CalendarOff className="size-4" /> Bloquear días</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Bloquear uno o varios días</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">
                Selecciona varios días en el calendario. {selectedDates.length > 0 && <strong>{selectedDates.length} seleccionado(s)</strong>}
              </p>
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates ?? [])}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date < today || date.getDay() === 0;
                }}
              />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Hora inicio (opcional)</Label>
                    <Input type="time" value={horaInicioDias} onChange={(e) => setHoraInicioDias(e.target.value)} />
                  </div>
                  <div>
                    <Label>Hora fin (opcional)</Label>
                    <Input type="time" value={horaFinDias} onChange={(e) => setHoraFinDias(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Motivo *</Label>
                  <Input value={motivoDias} onChange={(e) => setMotivoDias(e.target.value)} placeholder="Festivo, vacaciones..." />
                </div>
                <Button className="w-full" disabled={!selectedDates.length || !motivoDias} onClick={guardarDias}>
                  Bloquear {selectedDates.length > 1 ? `${selectedDates.length} días` : "día"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="dias">
        <TabsList className="mb-4">
          <TabsTrigger value="dias">Días bloqueados</TabsTrigger>
          <TabsTrigger value="muertos">
            Tiempos muertos
            {bloqueosDiarios.length > 0 && (
              <Badge variant="secondary" className="ml-2">{bloqueosDiarios.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Días bloqueados ── */}
        <TabsContent value="dias">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Calendario</CardTitle></CardHeader>
              <CardContent>
                <Calendar
                  mode="multiple"
                  selected={bloqueosFecha.map((b) => new Date(b.fecha + "T12:00:00"))}
                  modifiers={{ blocked: bloqueosFecha.map((b) => new Date(b.fecha + "T12:00:00")) }}
                  modifiersClassNames={{ blocked: "bg-destructive/20 text-destructive rounded-md font-bold" }}
                />
              </CardContent>
            </Card>

            {loading ? <LoadingState /> : bloqueosFecha.length === 0 ? (
              <EmptyState title="Sin bloqueos" description="No hay días bloqueados actualmente." />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Horario</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bloqueosFecha.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>{b.fecha}</TableCell>
                          <TableCell className="text-sm">
                            {b.hora_inicio && b.hora_fin ? `${b.hora_inicio}–${b.hora_fin}` : "Todo el día"}
                          </TableCell>
                          <TableCell>{b.motivo}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="destructive" onClick={() => eliminar(b.id)}>
                              <Trash2 className="size-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Tiempos muertos ── */}
        <TabsContent value="muertos">
          {loading ? <LoadingState /> : bloqueosDiarios.length === 0 ? (
            <EmptyState
              title="Sin tiempos muertos"
              description="Agrega horarios recurrentes que se bloquean todos los días (hora de comida, descanso, etc.)."
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Horario</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bloqueosDiarios.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="size-3.5 text-primary" />
                            {b.hora_inicio} – {b.hora_fin}
                          </span>
                        </TableCell>
                        <TableCell>{b.motivo}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="destructive" onClick={() => eliminar(b.id)}>
                            <Trash2 className="size-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
