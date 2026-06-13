export type EstadoCita = "confirmada" | "cancelada" | "completada" | "pendiente";
export type TipoBloqueo = "dia" | "rango" | "semana" | "mes" | "indefinido" | "diario";
export type EstadoPago = "sin_pago" | "pendiente" | "pagado" | "reembolsado";

export interface Servicio {
  id: number;
  nombre: string;
  descripcion: string;
  duracion_minutos: number;
  precio: number;
  categoria: string;
  activo: number;
  creado_en: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  creado_en: string;
}

export interface Cita {
  id: number;
  servicio_id: number;
  cliente_id: number;
  fecha_hora: string;
  estado: EstadoCita;
  notas: string;
  duracion_total: number;
  precio_total: number;
  stripe_session_id: string | null;
  stripe_payment_status: EstadoPago;
  creado_en: string;
  actualizado_en: string;
}

export interface CitaServicio {
  id: number;
  cita_id: number;
  servicio_id: number;
  precio: number;
  duracion_minutos: number;
  servicio_nombre?: string;
}

export interface CitaConDetalles extends Cita {
  servicio_nombre: string;
  servicio_precio: number;
  servicio_duracion: number;
  servicio_categoria: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
  servicios_adicionales?: CitaServicio[];
}

export interface DiaBloqueado {
  id: number;
  tipo: TipoBloqueo;
  fecha: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  motivo: string;
  hasta_nuevo_aviso: number;
  creado_en: string;
}

export interface EstadoTienda {
  abierta: boolean;
  motivo?: string;
  bloqueo_id?: number;
}

export interface UsuarioAdmin {
  id: number;
  nombre: string;
  email: string;
  contrasena_hash: string;
  creado_en: string;
}

export interface ClienteConHistorial extends Cliente {
  total_citas: number;
  citas: CitaConDetalles[];
}

export interface DashboardStats {
  citas_hoy: number;
  citas_semana: number;
  ingresos_semana: number;
  proximas_citas: CitaConDetalles[];
  estados_distribucion: { estado: EstadoCita; total: number }[];
}

export const ESTADOS_CITA: { value: EstadoCita; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "confirmada", label: "Confirmada" },
  { value: "completada", label: "Completada" },
  { value: "cancelada", label: "Cancelada" },
];

export const TIPOS_BLOQUEO: { value: TipoBloqueo; label: string }[] = [
  { value: "dia", label: "Día específico" },
  { value: "rango", label: "Rango de fechas" },
  { value: "semana", label: "Semana completa" },
  { value: "mes", label: "Mes completo" },
  { value: "indefinido", label: "Hasta nuevo aviso" },
];

export const CATEGORIAS_SERVICIO = [
  "Corte",
  "Barba",
  "Tratamiento",
  "Combo",
  "Otros",
] as const;

export const HORARIO_APERTURA = 9;
export const HORARIO_CIERRE = 19;
export const INTERVALO_MINUTOS = 15;

/** Fecha sentinel para tiempos muertos recurrentes (hora de comida, etc.). */
export const FECHA_TIEMPO_MUERTO = "2000-01-01";

/** Fecha sentinel para cierre de tienda hasta nuevo aviso. */
export const FECHA_INDEFINIDO = "2099-12-31";

export function isTiempoMuertoRecurrente(b: Pick<DiaBloqueado, "fecha" | "hora_inicio" | "hora_fin">): boolean {
  return b.fecha === FECHA_TIEMPO_MUERTO && !!b.hora_inicio && !!b.hora_fin;
}

export function isBloqueoIndefinido(b: Pick<DiaBloqueado, "fecha">): boolean {
  return b.fecha === FECHA_INDEFINIDO;
}
