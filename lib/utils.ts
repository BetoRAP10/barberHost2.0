import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extrae fecha y hora tal como se reservó (sin convertir UTC). */
export function fechaHoraParts(fechaHora: string): { fecha: string; hora: string; horaMin: string } {
  const match = fechaHora.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return { fecha: "", hora: "", horaMin: "" };
  return { fecha: match[1], hora: `${match[2]}:${match[3]}`, horaMin: `${match[2]}:${match[3]}` };
}

/**
 * Hora de cita del negocio — siempre los números del string (15:00 = 3 p.m.),
 * sin desfase por Z/UTC de Supabase.
 */
export function parseFechaHoraLocal(fechaHora: string): Date {
  const match = fechaHora.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return new Date(fechaHora);
  const [, y, mo, d, h, mi, se] = match;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    se ? Number(se) : 0,
    0
  );
}

/** La cita ya empezó (hora local, sin desfase UTC). */
export function citaYaEmpezo(fechaHora: string): boolean {
  return parseFechaHoraLocal(fechaHora).getTime() <= Date.now();
}

/** La cita ya terminó según su duración. */
export function citaYaTermino(fechaHora: string, duracionMinutos: number): boolean {
  const inicio = parseFechaHoraLocal(fechaHora);
  const fin = new Date(inicio.getTime() + duracionMinutos * 60000);
  return fin.getTime() <= Date.now();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? parseFechaHoraLocal(date) : date;
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? parseFechaHoraLocal(date) : date;
  return new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Hora de slot "HH:mm" → fin según duración en minutos. */
export function horaFinSlot(hora: string, duracionMin: number): string {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + duracionMin;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Slot "09:30" en formato 12 h (ej. 9:30 a.m.). */
export function formatSlot12h(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(2000, 0, 1, h, m));
}

export function formatSlotRange12h(hora: string, duracionMin: number): string {
  return `${formatSlot12h(hora)} – ${formatSlot12h(horaFinSlot(hora, duracionMin))}`;
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} · ${formatTime(date)}`;
}
