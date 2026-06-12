# BarberHost — Sistema de Gestión de Citas

Sistema completo de reservas para barbería construido con Next.js 16, Supabase y Stripe.

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (base de datos PostgreSQL)
- Cuenta en [Stripe](https://stripe.com) (pagos en modo test)
- Cuenta en [Resend](https://resend.com) (envío de emails — opcional)

## Instalación

```bash
npm install
```

## Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key de Supabase>
SUPABASE_SERVICE_KEY=<service_role key de Supabase>

# Stripe
STRIPE_SECRET_KEY=sk_test_<tu clave secreta>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_<tu clave pública>

# URL base de la app (para las URLs de Stripe)
NEXT_PUBLIC_URL=http://localhost:3000

# Resend (opcional, para emails de confirmación)
RESEND_API_KEY=re_<tu api key>
EMAIL_FROM=no-reply@tudominio.com
```

## Base de datos

Ejecuta el archivo `schema.sql` en el **SQL Editor** de Supabase para crear todas las tablas.  
Los servicios y el usuario administrador se insertan automáticamente al arrancar si las tablas están vacías.

## Correr el proyecto

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

> El servidor escucha en `0.0.0.0:3000` — accesible tanto desde `localhost` como desde la red local.

## Credenciales de administrador (demo)

- **Email:** admin@barberhost.com
- **Contraseña:** admin123

Panel admin: [http://localhost:3000/admin](http://localhost:3000/admin)

## Dependencias principales

| Paquete | Versión | Uso |
|---------|---------|-----|
| `next` | ^16 | Framework (App Router) |
| `react` / `react-dom` | ^19 | UI |
| `typescript` | 5.9 | Tipado estático |
| `tailwindcss` | ^4 | Estilos |
| `@supabase/supabase-js` | ^2 | Base de datos PostgreSQL |
| `stripe` | ^22 | Pagos con tarjeta |
| `date-fns` | ^4 | Manipulación de fechas |
| `react-day-picker` | ^9 | Selector de fecha |
| `react-hook-form` + `zod` | latest | Formularios y validación |
| `@react-pdf/renderer` | ^4 | Generación de PDF |
| `recharts` | ^2 | Gráficas del dashboard |
| `sonner` | ^2 | Toasts/notificaciones |
| `bcryptjs` | ^3 | Hash de contraseñas admin |
| `lucide-react` | latest | Íconos |
| `shadcn/ui` (via Radix) | latest | Componentes de UI |

## Estructura del proyecto

```
app/
  (public)/            # Rutas públicas
    page.tsx           # Catálogo de servicios
    reservar/          # Flujo multipaso de reserva
    mis-citas/         # Consulta de citas por email
  admin/(panel)/       # Panel de administración (protegido)
    calendario/        # Vista mensual/semanal/diaria
    citas/             # Gestión de citas
    servicios/         # CRUD de servicios
    clientes/          # Historial de clientes
    dias-bloqueados/   # Bloqueo de días y horarios
  api/                 # API Routes (Next.js)
    citas/             # CRUD citas + hold de slots
    slots/             # Disponibilidad de horarios
    stripe/            # Checkout y verificación de pago
    email/             # Envío de comprobantes
lib/
  db.ts                # Funciones de base de datos (Supabase)
  utils.ts             # Utilidades (formateo de fechas/moneda)
  types.ts             # Tipos TypeScript
  validators.ts        # Esquemas Zod
components/            # Componentes reutilizables (shadcn/ui)
```

## Flujo de reserva

1. **Paso 1** — El cliente elige servicios
2. **Paso 2** — Elige fecha y horario (se crea un *hold* que bloquea el slot por 15 min)
3. **Paso 3** — Ingresa sus datos y paga con Stripe
4. **Éxito** — Se confirma la cita y se envía comprobante por email

## Scripts disponibles

```bash
npm run dev      # Servidor de desarrollo (localhost + red local, puerto 3000)
npm run build    # Build de producción
npm run start    # Servidor de producción
npm run lint     # Linter (ESLint)
```
