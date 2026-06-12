import { NextResponse } from "next/server";
import { createDiaBloqueado, deleteDiaBloqueado, getDiasBloqueados } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  return NextResponse.json(await getDiasBloqueados());
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await request.json();

  // Soporte para crear múltiples días de golpe: { fechas: ["2026-06-15", ...], motivo, hora_inicio?, hora_fin? }
  if (Array.isArray(body.fechas)) {
    const ids: number[] = [];
    for (const fecha of body.fechas as string[]) {
      const id = await createDiaBloqueado({
        tipo:        "dia",
        fecha,
        hora_inicio: body.hora_inicio || null,
        hora_fin:    body.hora_fin    || null,
        motivo:      body.motivo      || "Bloqueado",
      });
      ids.push(id);
    }
    return NextResponse.json({ ids }, { status: 201 });
  }

  // Tiempo muerto diario (recurrente): { tipo: "diario", hora_inicio, hora_fin, motivo }
  if (body.tipo === "diario") {
    const id = await createDiaBloqueado({
      tipo:        "diario",
      fecha:       "2000-01-01", // fecha placeholder para bloqueos diarios
      hora_inicio: body.hora_inicio,
      hora_fin:    body.hora_fin,
      motivo:      body.motivo || "Tiempo muerto",
    });
    return NextResponse.json({ id }, { status: 201 });
  }

  // Bloqueo individual de fecha
  if (!body.fecha || !body.motivo) {
    return NextResponse.json({ error: "fecha y motivo requeridos" }, { status: 400 });
  }
  const id = await createDiaBloqueado({
    tipo:        body.tipo        || "dia",
    fecha:       body.fecha,
    fecha_fin:   body.fecha_fin   || null,
    hora_inicio: body.hora_inicio || null,
    hora_fin:    body.hora_fin    || null,
    motivo:      body.motivo,
  });
  return NextResponse.json({ id }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await deleteDiaBloqueado(Number(id));
  return NextResponse.json({ success: true });
}
