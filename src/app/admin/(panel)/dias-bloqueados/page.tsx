"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Download, Plus, Trash2 } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { EmptyState, LoadingState } from "@/components/shared/status-badge";
import { exportTableToPdf } from "@/lib/pdf-export";
import { bloqueoSchema, type BloqueoFormData } from "@/lib/validators";
import type { DiaBloqueado } from "@/lib/types";
import { format } from "date-fns";

export default function AdminDiasBloqueadosPage() {
  const [bloqueos, setBloqueos] = useState<DiaBloqueado[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const form = useForm<BloqueoFormData>({
    resolver: zodResolver(bloqueoSchema),
    defaultValues: { fecha: "", hora_inicio: "", hora_fin: "", motivo: "" },
  });

  const load = () => {
    setLoading(true);
    fetch("/api/dias-bloqueados")
      .then((r) => r.json())
      .then(setBloqueos)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (data: BloqueoFormData) => {
    try {
      const res = await fetch("/api/dias-bloqueados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success("Día bloqueado");
      setOpen(false);
      form.reset();
      setSelectedDate(undefined);
      load();
    } catch {
      toast.error("Error al bloquear");
    }
  };

  const desbloquear = async (id: number) => {
    await fetch(`/api/dias-bloqueados?id=${id}`, { method: "DELETE" });
    toast.success("Día desbloqueado");
    load();
  };

  const exportPdf = () => {
    exportTableToPdf(
      "Días Bloqueados",
      new Date().toLocaleDateString("es-ES"),
      [
        { header: "Fecha", key: "fecha" },
        { header: "Inicio", key: "inicio" },
        { header: "Fin", key: "fin" },
        { header: "Motivo", key: "motivo" },
      ],
      bloqueos.map((b) => ({
        fecha: b.fecha,
        inicio: b.hora_inicio ?? "Todo el día",
        fin: b.hora_fin ?? "—",
        motivo: b.motivo,
      }))
    );
    toast.success("PDF exportado");
  };

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Días Bloqueados" }]} />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Días Bloqueados</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf}><Download className="size-4" /> PDF</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> Bloquear día</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bloquear fecha u horario</DialogTitle></DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d: Date | undefined) => {
                    setSelectedDate(d);
                    if (d) form.setValue("fecha", format(d, "yyyy-MM-dd"));
                  }}
                  disabled={(date) => date < new Date()}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Hora inicio (opcional)</Label>
                    <Input type="time" {...form.register("hora_inicio")} />
                  </div>
                  <div>
                    <Label>Hora fin (opcional)</Label>
                    <Input type="time" {...form.register("hora_fin")} />
                  </div>
                </div>
                <div>
                  <Label>Motivo</Label>
                  <Input placeholder="Festivo, vacaciones..." {...form.register("motivo")} />
                  {form.formState.errors.motivo && (
                    <p className="text-sm text-destructive">{form.formState.errors.motivo.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full">Bloquear</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Calendario de bloqueos</CardTitle></CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              modifiers={{
                blocked: bloqueos.map((b) => new Date(b.fecha + "T12:00:00")),
              }}
              modifiersClassNames={{ blocked: "bg-destructive/20 text-destructive rounded-md" }}
            />
          </CardContent>
        </Card>

        {loading ? (
          <LoadingState />
        ) : bloqueos.length === 0 ? (
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
                  {bloqueos.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.fecha}</TableCell>
                      <TableCell>
                        {b.hora_inicio && b.hora_fin
                          ? `${b.hora_inicio} - ${b.hora_fin}`
                          : "Todo el día"}
                      </TableCell>
                      <TableCell>{b.motivo}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="destructive" onClick={() => desbloquear(b.id)}>
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
    </div>
  );
}
