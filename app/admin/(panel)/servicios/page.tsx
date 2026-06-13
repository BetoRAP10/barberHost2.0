"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Download, Plus, Pencil, Trash2 } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/shared/status-badge";
import { exportTableToPdf } from "@/lib/pdf-export";
import { formatCurrency } from "@/lib/utils";
import { servicioSchema, type ServicioFormData } from "@/lib/validators";
import { CATEGORIAS_SERVICIO, type Servicio } from "@/lib/types";
import { handleAdminUnauthorized } from "@/lib/admin-utils";
import { cn } from "@/lib/utils";

export default function AdminServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Servicio | null>(null);

  const form = useForm<ServicioFormData>({
    resolver: zodResolver(servicioSchema),
    defaultValues: { nombre: "", descripcion: "", duracion_minutos: 30, precio: 0, categoria: "Corte" },
  });

  const load = () => {
    setLoading(true);
    fetch("/api/servicios")
      .then((r) => {
        if (!handleAdminUnauthorized(r)) return null;
        return r.json();
      })
      .then((data) => {
        if (data === null) return;
        setServicios(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (data: ServicioFormData) => {
    try {
      const url = editing ? `/api/servicios/${editing.id}` : "/api/admin/servicios";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!handleAdminUnauthorized(res)) return;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Error al guardar");
        return;
      }
      toast.success(editing ? "Servicio actualizado" : "Servicio creado");
      setOpen(false);
      setEditing(null);
      form.reset();
      load();
    } catch {
      toast.error("Error al guardar");
    }
  };

  const toggleActivo = async (s: Servicio) => {
    const res = await fetch(`/api/servicios/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: s.activo ? 0 : 1 }),
    });
    if (!handleAdminUnauthorized(res)) return;
    if (!res.ok) {
      toast.error("Error al cambiar estado");
      return;
    }
    toast.success(s.activo ? "Servicio desactivado" : "Servicio activado");
    load();
  };

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar este servicio? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/servicios/${id}`, { method: "DELETE" });
    if (!handleAdminUnauthorized(res)) return;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "No se pudo eliminar el servicio");
      return;
    }
    toast.success("Servicio eliminado");
    load();
  };

  const abrirEditar = (s: Servicio) => {
    setEditing(s);
    form.reset({
      nombre: s.nombre,
      descripcion: s.descripcion,
      duracion_minutos: s.duracion_minutos,
      precio: s.precio,
      categoria: s.categoria,
    });
    setOpen(true);
  };

  const exportPdf = () => {
    exportTableToPdf(
      "Catálogo de Servicios",
      new Date().toLocaleDateString("es-ES"),
      [
        { header: "Nombre", key: "nombre" },
        { header: "Categoría", key: "categoria" },
        { header: "Duración", key: "duracion" },
        { header: "Precio", key: "precio" },
        { header: "Estado", key: "estado" },
      ],
      servicios.map((s) => ({
        nombre: s.nombre,
        categoria: s.categoria,
        duracion: `${s.duracion_minutos} min`,
        precio: formatCurrency(s.precio),
        estado: s.activo ? "Activo" : "Inactivo",
      }))
    );
    toast.success("PDF exportado");
  };

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Servicios" }]} />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Gestión de Servicios</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf}><Download className="size-4" /> PDF</Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); form.reset(); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> Nuevo servicio</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} servicio</DialogTitle></DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label>Nombre</Label>
                  <Input {...form.register("nombre")} />
                  {form.formState.errors.nombre && <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>}
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Textarea {...form.register("descripcion")} />
                </div>
                <div>
                  <Label>Duración</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5 mb-2">
                    {[15, 30, 45, 60, 90].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => form.setValue("duracion_minutos", mins, { shouldValidate: true })}
                        className={cn(
                          "rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition-all",
                          form.watch("duracion_minutos") === mins
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:border-primary/50 hover:bg-muted/40"
                        )}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min={15}
                    max={180}
                    step={15}
                    placeholder="Otro (múltiplo de 15)"
                    value={form.watch("duracion_minutos") || ""}
                    onChange={(e) => form.setValue("duracion_minutos", Number(e.target.value), { shouldValidate: true })}
                  />
                  {form.formState.errors.duracion_minutos && (
                    <p className="mt-1 text-sm text-destructive">{form.formState.errors.duracion_minutos.message}</p>
                  )}
                </div>
                <div>
                  <Label>Precio (MXN)</Label>
                  <Input type="number" step="0.01" min={1} {...form.register("precio")} />
                  {form.formState.errors.precio && (
                    <p className="mt-1 text-sm text-destructive">{form.formState.errors.precio.message}</p>
                  )}
                </div>
                <div>
                  <Label>Categoría</Label>
                  <Select value={form.watch("categoria")} onValueChange={(v) => form.setValue("categoria", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_SERVICIO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">{editing ? "Guardar" : "Crear"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? <LoadingState /> : servicios.length === 0 ? (
        <EmptyState title="Sin servicios" description="Crea tu primer servicio." />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicios.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nombre}</TableCell>
                    <TableCell>{s.categoria}</TableCell>
                    <TableCell>{s.duracion_minutos} min</TableCell>
                    <TableCell>{formatCurrency(s.precio)}</TableCell>
                    <TableCell>
                      <Badge variant={s.activo ? "default" : "secondary"}>
                        {s.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => abrirEditar(s)}><Pencil className="size-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => toggleActivo(s)}>
                          {s.activo ? "Desactivar" : "Activar"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => eliminar(s.id)}><Trash2 className="size-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
