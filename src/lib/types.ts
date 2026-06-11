export type EstadoCita = "confirmada" | "cancelada" | "completada" | "pendiente";

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
  creado_en: string;
  actualizado_en: string;
}

export interface CitaConDetalles extends Cita {
  servicio_nombre: string;
  servicio_precio: number;
  servicio_duracion: number;
  servicio_categoria: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
}

export interface DiaBloqueado {
  id: number;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  motivo: string;
  creado_en: string;
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

export const CATEGORIAS_SERVICIO = [
  "Corte",
  "Barba",
  "Tratamiento",
  "Combo",
  "Otros",
] as const;

export const HORARIO_APERTURA = 9;
export const HORARIO_CIERRE = 19;
export const INTERVALO_MINUTOS = 30;
