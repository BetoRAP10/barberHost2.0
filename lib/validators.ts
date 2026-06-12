import { z } from "zod";

export const clienteSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Introduce un email válido"),
  telefono: z.string().min(9, "Introduce un teléfono válido"),
  notas: z.string().optional(),
});

export const servicioSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  descripcion: z.string().min(5, "La descripción es obligatoria"),
  duracion_minutos: z.coerce.number().superRefine((v, ctx) => {
    if (v !== 30 && v !== 60) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La duración debe ser 30 o 60 minutos" });
    }
  }),
  precio: z.coerce.number().min(0, "El precio debe ser positivo"),
  categoria: z.string().min(1, "Selecciona una categoría"),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const bloqueoSchema = z.object({
  tipo: z.enum(["dia", "rango", "semana", "mes", "indefinido"]),
  fecha: z.string().min(1, "Selecciona una fecha"),
  fecha_fin: z.string().optional().nullable(),
  hora_inicio: z.string().optional().nullable(),
  hora_fin: z.string().optional().nullable(),
  motivo: z.string().min(2, "Indica el motivo del bloqueo"),
  hasta_nuevo_aviso: z.boolean(),
});

export const checkoutSchema = z.object({
  servicio_ids: z.array(z.number()).min(1, "Selecciona al menos un servicio"),
  fecha_hora: z.string().min(1, "Selecciona fecha y hora"),
  cliente: clienteSchema,
});

export type ClienteFormData = z.infer<typeof clienteSchema>;
export type ServicioFormData = z.infer<typeof servicioSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type BloqueoFormData = z.infer<typeof bloqueoSchema>;
export type CheckoutFormData = z.infer<typeof checkoutSchema>;
