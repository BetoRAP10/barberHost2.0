import { NextResponse } from "next/server";
import {
  createHoldCita,
  getServiciosByIds,
  isSlotAvailable,
  updateCitaEstado,
} from "@/lib/db";

// POST /api/citas/hold — reserva el slot sin datos de cliente
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const { items, fecha_hora } = body as {
      items: { id: number; cantidad: number }[];
      fecha_hora: string;
    };

    if (!items?.length || !fecha_hora) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const uniqueIds    = [...new Set(items.map((i) => i.id))];
    const servicioList = await getServiciosByIds(uniqueIds);
    if (!servicioList.length) {
      return NextResponse.json({ error: "Servicios no encontrados" }, { status: 404 });
    }

    const servicioMap = new Map(servicioList.map((s) => [s.id, s]));
    const serviciosExpandidos = items.flatMap((item) => {
      const sv = servicioMap.get(item.id)!;
      return Array.from({ length: item.cantidad }, () => sv);
    });

    const duracionTotal = serviciosExpandidos.reduce((s, sv) => s + sv.duracion_minutos, 0);
    const fecha = fecha_hora.split("T")[0];
    const hora  = fecha_hora.split("T")[1]?.slice(0, 5);

    // Pre-check: slot disponible antes de insertar
    if (!(await isSlotAvailable(fecha, hora, duracionTotal))) {
      return NextResponse.json({ error: "Horario no disponible" }, { status: 409 });
    }

    // Insertar el hold
    const holdId = await createHoldCita({ servicios: serviciosExpandidos, fecha_hora });

    // Post-check: verificar que no hubo race condition
    if (!(await isSlotAvailable(fecha, hora, duracionTotal, holdId))) {
      await updateCitaEstado(holdId, "cancelada");
      return NextResponse.json({ error: "Horario no disponible" }, { status: 409 });
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    return NextResponse.json({ hold_id: holdId, expires_at: expiresAt });
  } catch (err) {
    console.error("[citas/hold POST]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/citas/hold — cancela un hold (usuario retrocede o abandona)
export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const hold_id = body?.hold_id;

    if (!hold_id) {
      return NextResponse.json({ error: "hold_id requerido" }, { status: 400 });
    }

    await updateCitaEstado(Number(hold_id), "cancelada");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[citas/hold DELETE]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
