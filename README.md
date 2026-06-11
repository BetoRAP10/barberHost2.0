# BarberHost — Sistema de Gestión de Citas

Sistema completo de reservas para barbería/bienestar construido con Next.js App Router, TypeScript, shadcn/ui y SQLite.

## Requisitos

- Node.js 22+ (usa `node:sqlite` integrado)

## Instalación

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Credenciales de administrador (demo)

- **Email:** admin@barberhost.com
- **Contraseña:** admin123

Panel admin: [http://localhost:3000/admin](http://localhost:3000/admin)

## Estructura

### Público
- `/` — Catálogo de servicios con filtro por categoría
- `/reservar` — Flujo multipaso de reserva
- `/mis-citas` — Consulta por email, cancelar, reprogramar, PDF

### Admin
- `/admin` — Dashboard con estadísticas y gráfico
- `/admin/citas` — Gestión de citas (filtros, orden, PDF)
- `/admin/calendario` — Vista mensual/semanal/diaria
- `/admin/servicios` — CRUD de servicios
- `/admin/dias-bloqueados` — Bloqueo de días/horarios
- `/admin/clientes` — Clientes e historial

## Base de datos

El esquema SQL completo está en [`schema.sql`](schema.sql). La base de datos SQLite se crea automáticamente en `data/barber.db` al iniciar la aplicación, con datos de demostración precargados.

## Stack

- Next.js 15 · TypeScript · Tailwind CSS v4
- shadcn/ui · react-day-picker · date-fns
- @react-pdf/renderer · recharts · sonner
- SQLite via `node:sqlite` · bcryptjs
