"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Filter } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/status-badge";
import { formatCurrency } from "@/lib/utils";
import type { Servicio } from "@/lib/types";

export default function HomePage() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState<string>("all");

  useEffect(() => {
    fetch("/api/servicios?activos=true")
      .then((r) => r.json())
      .then((data) => setServicios(data))
      .finally(() => setLoading(false));
  }, []);

  const categorias = [...new Set(servicios.map((s) => s.categoria))];
  const filtered =
    categoria === "all" ? servicios : servicios.filter((s) => s.categoria === categoria);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-orange-50 to-amber-50 py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Reserva tu cita en segundos
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Descubre nuestros servicios de barbería y bienestar. Elige el que prefieras y reserva al instante.
            </p>
            <Button size="lg" className="mt-8" asChild>
              <Link href="/reservar">Reservar ahora</Link>
            </Button>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Nuestros Servicios</h2>
              <p className="text-muted-foreground">Selecciona el servicio que mejor se adapte a ti</p>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categorias.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No hay servicios disponibles"
              description="No encontramos servicios en esta categoría. Prueba con otra."
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((servicio) => (
                <Card key={servicio.id} className="flex flex-col transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle>{servicio.nombre}</CardTitle>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {servicio.categoria}
                      </span>
                    </div>
                    <CardDescription className="line-clamp-2">{servicio.descripcion}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="size-4" />
                        {servicio.duracion_minutos} min
                      </span>
                      <span className="text-lg font-semibold text-primary">
                        {formatCurrency(servicio.precio)}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" asChild>
                      <Link href={`/reservar?servicio=${servicio.id}`}>Reservar Cita</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
