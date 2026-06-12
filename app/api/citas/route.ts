import { NextResponse } from "next/server";
import {
  createCita,
  getAvailableDays,
  getAvailableSlots,
  getSlotsStatus,
  getCitas,
  getCitasByEmail,
  getCitaById,
  getOrCreateCliente,
  getServicioById,
  isSlotAvailable,
  reprogramarCita,
  updateCitaEstado,
} from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { clienteSchema } from "@/lib/validators";
import type { EstadoCita } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const fecha = searchParams.get("fecha");
    const servicioId = searchParams.get("servicio_id");
    const excludeId = searchParams.get("exclude_id");
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const duracion = searchParams.get("duracion");

    if (email) {
      return NextResponse.json(await getCitasByEmail(email));
    }

    if (fecha && duracion) {
      const mostrarOcupados = searchParams.get("ocupados") === "true";
      if (mostrarOcupados) {
        const slots = await getSlotsStatus(
          fecha,
          Number(duracion),
          excludeId ? Number(excludeId) : undefined
        );
        return NextResponse.json(slots);
      }
      const slots = await getAvailableSlots(
        fecha,
        Number(duracion),
        excludeId ? Number(excludeId) : undefined
      );
      return NextResponse.json(slots);
    }

    if (year && month && duracion) {
      const days = await getAvailableDays(Number(year), Number(month), Number(duracion));
      return NextResponse.json(days);
    }

    const filters = {
      estado: searchParams.get("estado") as EstadoCita | undefined,
      servicio_id: servicioId ? Number(servicioId) : undefined,
      fecha_desde: searchParams.get("fecha_desde") ?? undefined,
      fecha_hasta: searchParams.get("fecha_hasta") ?? undefined,
    };

    return NextResponse.json(await getCitas(filters));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    console.error("[GET /api/citas]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.action === "reprogramar") {
    const { id, fecha_hora } = body;
    const cita = await getCitaById(Number(id));
    if (!cita) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

    const fecha = fecha_hora.split("T")[0];
    const hora = fecha_hora.split("T")[1]?.slice(0, 5);
    const duracion = (cita.duracion_total ?? 0) > 0 ? cita.duracion_total : cita.servicio_duracion;
    if (!(await isSlotAvailable(fecha, hora, duracion, cita.id))) {
      return NextResponse.json({ error: "Horario no disponible" }, { status: 409 });
    }

    await reprogramarCita(Number(id), fecha_hora);
    return NextResponse.json({ success: true });
  }

  if (body.action === "cancelar") {
    await updateCitaEstado(Number(body.id), "cancelada");
    return NextResponse.json({ success: true });
  }

  if (body.action === "estado") {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    await updateCitaEstado(Number(body.id), body.estado as EstadoCita);
    return NextResponse.json({ success: true });
  }

  const parsed = clienteSchema.safeParse(body.cliente);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { servicio_id, fecha_hora } = body;
  if (!servicio_id || !fecha_hora) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const fecha = fecha_hora.split("T")[0];
  const hora = fecha_hora.split("T")[1]?.slice(0, 5);
  const servicio = await getServicioById(Number(servicio_id));
  if (!servicio) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });

  if (!(await isSlotAvailable(fecha, hora, servicio.duracion_minutos))) {
    return NextResponse.json({ error: "Horario no disponible" }, { status: 409 });
  }

  const clienteId = await getOrCreateCliente(
    parsed.data.nombre,
    parsed.data.email,
    parsed.data.telefono
  );

  const citaId = await createCita({
    servicio_id: Number(servicio_id),
    cliente_id: clienteId,
    fecha_hora,
    notas: parsed.data.notas,
  });

  const cita = await getCitaById(citaId);
  return NextResponse.json(cita, { status: 201 });
}
