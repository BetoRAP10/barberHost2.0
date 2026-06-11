"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { clienteSchema, type ClienteFormData } from "@/lib/validators";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Servicio, CitaConDetalles } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Servicio", "Fecha", "Horario", "Datos", "Confirmación"];

function ReservarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedCita, setConfirmedCita] = useState<CitaConDetalles | null>(null);

  const form = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: { nombre: "", email: "", telefono: "", notas: "" },
  });

  useEffect(() => {
    fetch("/api/servicios?activos=true")
      .then((r) => r.json())
      .then((data: Servicio[]) => {
        setServicios(data);
        const preselect = searchParams.get("servicio");
        if (preselect) {
          const s = data.find((x) => x.id === Number(preselect));
          if (s) {
            setSelectedServicio(s);
            setStep(1);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const loadAvailableDays = useCallback(async (servicio: Servicio, date: Date) => {
    const res = await fetch(
      `/api/citas?year=${date.getFullYear()}&month=${date.getMonth()}&duracion=${servicio.duracion_minutos}`
    );
    const days = await res.json();
    setAvailableDays(days);
  }, []);

  useEffect(() => {
    if (selectedServicio && selectedDate) {
      loadAvailableDays(selectedServicio, selectedDate);
    }
  }, [selectedServicio, selectedDate, loadAvailableDays]);

  useEffect(() => {
    if (selectedServicio && selectedDate) {
      const fecha = format(selectedDate, "yyyy-MM-dd");
      fetch(`/api/citas?fecha=${fecha}&duracion=${selectedServicio.duracion_minutos}`)
        .then((r) => r.json())
        .then(setAvailableSlots);
    }
  }, [selectedServicio, selectedDate]);

  const isDayAvailable = (date: Date) => {
    const fecha = format(date, "yyyy-MM-dd");
    return availableDays.includes(fecha);
  };

  const handleSubmit = async (data: ClienteFormData) => {
    if (!selectedServicio || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    try {
      const fecha_hora = `${format(selectedDate, "yyyy-MM-dd")}T${selectedSlot}:00`;
      const res = await fetch("/api/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicio_id: selectedServicio.id,
          fecha_hora,
          cliente: data,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al reservar");
      }
      const cita = await res.json();
      setConfirmedCita(cita);
      setStep(4);
      toast.success("¡Cita reservada con éxito!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al reservar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Skeleton className="mx-auto h-96 max-w-2xl rounded-xl" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {i < step ? <CheckCircle2 className="size-4" /> : i + 1}
              </div>
              <span className="mt-1 hidden text-xs sm:block">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 h-1 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
          <CardDescription>
            {step === 0 && "Elige el servicio que deseas reservar"}
            {step === 1 && "Selecciona un día disponible"}
            {step === 2 && "Elige tu horario preferido"}
            {step === 3 && "Completa tus datos de contacto"}
            {step === 4 && "Tu cita ha sido confirmada"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <div className="grid gap-3">
              {servicios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedServicio(s)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-all hover:border-primary",
                    selectedServicio?.id === s.id && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{s.nombre}</span>
                    <span className="font-semibold text-primary">{formatCurrency(s.precio)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.descripcion}</p>
                  <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" /> {s.duracion_minutos} min
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && selectedServicio && (
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d: Date | undefined) => {
                setSelectedDate(d);
                setSelectedSlot("");
              }}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (date < today) return true;
                if (date.getDay() === 0) return true;
                if (selectedDate?.getMonth() === date.getMonth()) {
                  return !isDayAvailable(date);
                }
                return false;
              }}
            />
          )}

          {step === 2 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {availableSlots.length === 0 ? (
                <p className="col-span-full text-center text-muted-foreground">No hay horarios disponibles</p>
              ) : (
                availableSlots.map((slot) => (
                  <Button
                    key={slot}
                    variant={selectedSlot === slot ? "default" : "outline"}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot}
                  </Button>
                ))
              )}
            </div>
          )}

          {step === 3 && (
            <form id="cliente-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input id="nombre" {...form.register("nombre")} />
                {form.formState.errors.nombre && (
                  <p className="mt-1 text-sm text-destructive">{form.formState.errors.nombre.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register("email")} />
                {form.formState.errors.email && (
                  <p className="mt-1 text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" {...form.register("telefono")} />
                {form.formState.errors.telefono && (
                  <p className="mt-1 text-sm text-destructive">{form.formState.errors.telefono.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="notas">Notas (opcional)</Label>
                <Textarea id="notas" {...form.register("notas")} placeholder="Alergias, preferencias..." />
              </div>
            </form>
          )}

          {step === 4 && confirmedCita && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto size-16 text-primary" />
              <div className="rounded-lg bg-muted/50 p-4 text-left text-sm">
                <p><strong>Servicio:</strong> {confirmedCita.servicio_nombre}</p>
                <p><strong>Fecha:</strong> {formatDateTime(confirmedCita.fecha_hora)}</p>
                <p><strong>Cliente:</strong> {confirmedCita.cliente_nombre}</p>
                <p><strong>Email:</strong> {confirmedCita.cliente_email}</p>
                <p><strong>Referencia:</strong> #{confirmedCita.id}</p>
              </div>
              <Button onClick={() => router.push("/mis-citas")}>Ver mis citas</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {step < 4 && (
        <div className="mt-6 flex justify-between">
          <Button
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft className="size-4" /> Anterior
          </Button>
          {step < 3 ? (
            <Button
              disabled={
                (step === 0 && !selectedServicio) ||
                (step === 1 && !selectedDate) ||
                (step === 2 && !selectedSlot)
              }
              onClick={() => {
                if (step === 0 && selectedServicio) {
                  setSelectedDate(undefined);
                  loadAvailableDays(selectedServicio, new Date());
                }
                setStep((s) => s + 1);
              }}
            >
              Siguiente <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="submit" form="cliente-form" disabled={submitting}>
              {submitting ? "Reservando..." : "Confirmar reserva"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReservarPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
        <Suspense fallback={<Skeleton className="mx-auto mt-12 h-96 max-w-2xl rounded-xl" />}>
          <ReservarContent />
        </Suspense>
      </main>
      <PublicFooter />
    </div>
  );
}
