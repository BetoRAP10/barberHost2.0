"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Download, Search, Calendar, X } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/layout/public-header";
import { PublicBreadcrumb } from "@/components/layout/public-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { EmptyState, EstadoBadge, LoadingState } from "@/components/shared/status-badge";
import { exportCitaComprobante } from "@/lib/pdf-export";
import { formatDateTime, formatCurrency, formatSlotRange12h, parseFechaHoraLocal } from "@/lib/utils";
import type { CitaConDetalles } from "@/lib/types";

const normalizeTel = (tel: string) => tel.replace(/[\s\-\(\)\+\.]/g, "");

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function MisCitasPage() {
  const [email, setEmail] = useState("");
  const [citas, setCitas] = useState<CitaConDetalles[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Verificación de teléfono (usada para reprogramar Y cancelar)
  const [verifyFor, setVerifyFor]     = useState<CitaConDetalles | null>(null);
  const [verifyAction, setVerifyAction] = useState<"reprogramar" | "cancelar">("reprogramar");
  const [phoneInput, setPhoneInput]   = useState("");
  const [phoneError, setPhoneError]   = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState("");

  // Reprogramar
  const [reprogramarId, setReprogramarId] = useState<number | null>(null);
  const [newDate, setNewDate]   = useState<Date | undefined>();
  const [newSlot, setNewSlot]   = useState("");
  const [slots, setSlots]       = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const buscar = async () => {
    if (!email.trim()) { toast.error("Introduce tu email"); return; }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/citas?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setCitas(data);
      if (data.length === 0) toast.info("No se encontraron citas con ese email");
    } catch {
      toast.error("Error al buscar citas");
    } finally {
      setLoading(false);
    }
  };

  // Determina si la cita es futura (puede cancelarse o reprogramarse)
  const esFutura = (cita: CitaConDetalles) => parseFechaHoraLocal(cita.fecha_hora).getTime() > Date.now();

  // Abre el diálogo de verificación de teléfono
  const pedirVerificacion = (cita: CitaConDetalles, action: "reprogramar" | "cancelar") => {
    setVerifyFor(cita);
    setVerifyAction(action);
    setPhoneInput("");
    setPhoneError(false);
  };

  // Confirmación del teléfono: si coincide, procede con la acción
  const confirmarTelefono = async () => {
    if (!verifyFor) return;
    if (normalizeTel(phoneInput) !== normalizeTel(verifyFor.cliente_telefono ?? "")) {
      setPhoneError(true);
      return;
    }
    const phone = phoneInput;
    const cita  = verifyFor;
    setVerifyFor(null);

    if (verifyAction === "cancelar") {
      await cancelarVerificado(cita, phone);
    } else {
      setVerifiedPhone(phone);
      setReprogramarId(cita.id);
      setNewDate(undefined);
      setNewSlot("");
      setSlots([]);
    }
  };

  // Cancela una cita con verificación de teléfono (servidor también lo verifica)
  const cancelarVerificado = async (cita: CitaConDetalles, telefono: string) => {
    try {
      const res = await fetch("/api/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancelar_publico", id: cita.id, telefono }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Error al cancelar");
        return;
      }
      if (json.reembolsado) {
        toast.success("Cita cancelada — se procesó un reembolso automático");
      } else {
        toast.success("Cita cancelada");
      }
      buscar();
    } catch {
      toast.error("Error al cancelar");
    }
  };

  const cargarSlots = async (date: Date, cita: CitaConDetalles) => {
    setNewDate(date);
    setNewSlot("");
    setSlotsLoading(true);
    try {
      const fecha = format(date, "yyyy-MM-dd");
      const duracion = (cita.duracion_total ?? 0) > 0 ? cita.duracion_total : cita.servicio_duracion;
      const res = await fetch(`/api/citas?fecha=${fecha}&duracion=${duracion}&exclude_id=${cita.id}`);
      const data = await res.json();
      setSlots(Array.isArray(data) ? data : []);
    } catch {
      setSlots([]);
      toast.error("Error al cargar horarios");
    } finally {
      setSlotsLoading(false);
    }
  };

  const reprogramar = async (cita: CitaConDetalles) => {
    if (!newDate || !newSlot) return;
    try {
      const fecha_hora = `${format(newDate, "yyyy-MM-dd")}T${newSlot}:00`;
      const res = await fetch("/api/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:    "reprogramar_publico",
          id:        cita.id,
          fecha_hora,
          telefono:  verifiedPhone,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success("Cita reprogramada");
      setReprogramarId(null);
      buscar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al reprogramar");
    }
  };

  const citaReprogramar = citas.find((c) => c.id === reprogramarId);

  // Límite de 2 meses para el calendario de reprogramar
  const maxFechaReprogramar = new Date();
  maxFechaReprogramar.setMonth(maxFechaReprogramar.getMonth() + 2);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="container mx-auto flex-1 px-4 py-12">
        <PublicBreadcrumb items={[{ label: "Mis Citas" }]} />
        <h1 className="mb-2 text-3xl font-bold">Mis Citas</h1>
        <p className="mb-8 text-muted-foreground">
          Consulta tus citas introduciendo el email con el que reservaste
        </p>

        <Card className="mb-8">
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscar()}
              />
            </div>
            <Button className="self-end" onClick={buscar} disabled={loading}>
              <Search className="size-4" />
              {loading ? "Buscando..." : "Buscar citas"}
            </Button>
          </CardContent>
        </Card>

        {loading && <LoadingState />}
        {!loading && searched && citas.length === 0 && (
          <EmptyState title="Sin citas" description="No encontramos citas asociadas a este email." />
        )}

        <div className="grid gap-4">
          {citas.map((cita) => {
            const futura = esFutura(cita);
            const puedeCancelar  = futura && cita.estado !== "cancelada" && cita.estado !== "completada";
            const puedeReprogramar = futura && cita.estado === "confirmada";

            return (
              <Card key={cita.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{cita.servicio_nombre}</CardTitle>
                    <p className="text-sm text-muted-foreground">{formatDateTime(cita.fecha_hora)}</p>
                  </div>
                  <EstadoBadge estado={cita.estado} />
                </CardHeader>
                <CardContent>
                  {/* precio_total muestra lo que realmente pagó (no el precio unitario del servicio) */}
                  <p className="text-sm">{formatCurrency(cita.precio_total)} · Ref. #{cita.id}</p>

                  {!futura && cita.estado === "confirmada" && (
                    <p className="mt-2 text-xs text-muted-foreground italic">Esta cita ya ocurrió</p>
                  )}

                  {(puedeReprogramar || puedeCancelar) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {puedeReprogramar && (
                        <Button size="sm" variant="outline" onClick={() => pedirVerificacion(cita, "reprogramar")}>
                          <Calendar className="size-4" /> Reprogramar
                        </Button>
                      )}
                      {puedeCancelar && (
                        <Button size="sm" variant="destructive" onClick={() => pedirVerificacion(cita, "cancelar")}>
                          <X className="size-4" /> Cancelar
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => exportCitaComprobante({ ...cita, cliente_telefono: undefined })}>
                        <Download className="size-4" /> PDF
                      </Button>
                    </div>
                  )}

                  {(cita.estado === "cancelada" || cita.estado === "completada" || !futura) && (
                    <Button size="sm" variant="secondary" className="mt-4" onClick={() => exportCitaComprobante({ ...cita, cliente_telefono: undefined })}>
                      <Download className="size-4" /> Descargar comprobante
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Dialog: verificación de teléfono (para reprogramar Y cancelar) ── */}
        <Dialog open={!!verifyFor} onOpenChange={() => setVerifyFor(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verificar identidad</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {verifyAction === "cancelar"
                  ? "Introduce el teléfono con el que registraste la cita para confirmar la cancelación."
                  : "Introduce el teléfono con el que registraste la cita para poder reprogramarla."}
              </p>
              {verifyAction === "cancelar" && verifyFor?.stripe_payment_status === "pagado" && (
                <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  Esta cita fue pagada — si cancelas se procesará un reembolso automático.
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="tel-verify">Número de teléfono</Label>
                <Input
                  id="tel-verify"
                  type="tel"
                  placeholder="ej. 555 123 4567"
                  value={phoneInput}
                  onChange={(e) => { setPhoneInput(e.target.value); setPhoneError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && confirmarTelefono()}
                  className={phoneError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {phoneError && (
                  <p className="text-sm text-destructive">El número no coincide. Intenta de nuevo.</p>
                )}
              </div>
              <Button
                className="w-full"
                variant={verifyAction === "cancelar" ? "destructive" : "default"}
                onClick={confirmarTelefono}
                disabled={!phoneInput.trim()}
              >
                {verifyAction === "cancelar" ? "Confirmar cancelación" : "Continuar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Dialog: reprogramar ── */}
        <Dialog open={!!reprogramarId} onOpenChange={() => setReprogramarId(null)}>
          <DialogContent className="flex max-h-[min(90vh,700px)] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
              <DialogTitle>Reprogramar cita</DialogTitle>
            </DialogHeader>
            {citaReprogramar && (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
                  <p className="text-sm text-muted-foreground">
                    Cita actual: <strong>{formatDateTime(citaReprogramar.fecha_hora)}</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Elige una nueva fecha (máximo 2 meses, sin domingos).
                  </p>
                  <DateCalendar
                    className="mx-auto rounded-lg border p-2"
                    mode="single"
                    selected={newDate}
                    onSelect={(d: Date | undefined) => d && cargarSlots(d, citaReprogramar)}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      if (date < today) return true;
                      if (date > maxFechaReprogramar) return true;
                      if (date.getDay() === 0) return true;
                      return false;
                    }}
                  />

                  {newDate && slotsLoading && (
                    <div className="py-4">
                      <LoadingState />
                    </div>
                  )}

                  {newDate && !slotsLoading && slots.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="slot-select">Horario disponible</Label>
                      <Select value={newSlot} onValueChange={setNewSlot}>
                        <SelectTrigger id="slot-select" className="w-full">
                          <SelectValue placeholder="Selecciona un horario" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {slots.map((slot) => {
                            const duracion =
                              (citaReprogramar.duracion_total ?? 0) > 0
                                ? citaReprogramar.duracion_total
                                : citaReprogramar.servicio_duracion;
                            return (
                              <SelectItem key={slot} value={slot}>
                                {formatSlotRange12h(slot, duracion)}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {newDate && !slotsLoading && slots.length === 0 && (
                    <p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-center text-sm text-orange-700">
                      No hay horarios disponibles este día. Elige otra fecha.
                    </p>
                  )}

                  {newSlot && newDate && (
                    <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
                      Nueva cita:{" "}
                      <strong>
                        {format(newDate, "dd/MM/yyyy")} ·{" "}
                        {formatSlotRange12h(
                          newSlot,
                          (citaReprogramar.duracion_total ?? 0) > 0
                            ? citaReprogramar.duracion_total
                            : citaReprogramar.servicio_duracion
                        )}
                      </strong>
                    </p>
                  )}
                </div>

                <div className="shrink-0 border-t bg-background px-6 py-4">
                  <Button
                    className="w-full"
                    disabled={!newDate || !newSlot || slotsLoading}
                    onClick={() => reprogramar(citaReprogramar)}
                  >
                    Confirmar nueva fecha
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
      <PublicFooter />
    </div>
  );
}
