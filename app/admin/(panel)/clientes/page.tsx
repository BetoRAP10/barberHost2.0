"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Search } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, EstadoBadge, LoadingState } from "@/components/shared/status-badge";
import { exportTableToPdf } from "@/lib/pdf-export";
import { formatDateTime } from "@/lib/utils";
import type { ClienteConHistorial } from "@/lib/types";

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<ClienteConHistorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = (q?: string) => {
    setLoading(true);
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    fetch(`/api/clientes${params}`)
      .then((r) => r.json())
      .then(setClientes)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const exportPdf = () => {
    exportTableToPdf(
      "Listado de Clientes",
      new Date().toLocaleDateString("es-ES"),
      [
        { header: "Nombre", key: "nombre" },
        { header: "Email", key: "email" },
        { header: "Teléfono", key: "telefono" },
        { header: "Total citas", key: "total" },
      ],
      clientes.map((c) => ({
        nombre: c.nombre,
        email: c.email,
        telefono: c.telefono,
        total: String(c.total_citas),
      }))
    );
    toast.success("PDF exportado");
  };

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Clientes" }]} />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Gestión de Clientes</h1>
        <Button variant="outline" onClick={exportPdf}><Download className="size-4" /> Exportar PDF</Button>
      </div>

      <Card className="mb-6">
        <CardContent className="flex gap-4 pt-6">
          <Input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(search)}
          />
          <Button onClick={() => load(search)}><Search className="size-4" /> Buscar</Button>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingState />
      ) : clientes.length === 0 ? (
        <EmptyState title="Sin clientes" description="Aún no hay clientes registrados." />
      ) : (
        <div className="space-y-4">
          {clientes.map((cliente) => (
            <Card key={cliente.id}>
              <CardHeader
                className="cursor-pointer"
                onClick={() => setExpanded(expanded === cliente.id ? null : cliente.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{cliente.nombre}</CardTitle>
                    <p className="text-sm text-muted-foreground">{cliente.email} · {cliente.telefono}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    {cliente.total_citas} citas
                  </span>
                </div>
              </CardHeader>
              {expanded === cliente.id && cliente.citas.length > 0 && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Servicio</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cliente.citas.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.servicio_nombre}</TableCell>
                          <TableCell>{formatDateTime(c.fecha_hora)}</TableCell>
                          <TableCell><EstadoBadge estado={c.estado} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
