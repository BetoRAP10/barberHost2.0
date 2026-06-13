import { NextResponse } from "next/server";
import { createDiaBloqueado, deleteDiaBloqueado, getDiasBloqueados } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { FECHA_TIEMPO_MUERTO } from "@/lib/types";

function normHora(hora: string | null | undefined): string | null {
  if (!hora) return null;
  return hora.trim().slice(0, 5);
}

export async function GET() {
  return NextResponse.json(await getDiasBloqueados());
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Soporte para crear múltiples días de golpe: { fechas: ["2026-06-15", ...], motivo, hora_inicio?, hora_fin? }
    if (Array.isArray(body.fechas)) {
      const ids: number[] = [];
      for (const fecha of body.fechas as string[]) {
        const id = await createDiaBloqueado({
          tipo:        "dia",
          fecha,
          hora_inicio: normHora(body.hora_inicio),
          hora_fin:    normHora(body.hora_fin),
          motivo:      body.motivo || "Bloqueado",
        });
        ids.push(id);
      }
      return NextResponse.json({ ids }, { status: 201 });
    }

    // Tiempo muerto diario (recurrente)
    if (body.tipo === "diario") {
      const horaInicio = normHora(body.hora_inicio);
      const horaFin = normHora(body.hora_fin);
      if (!horaInicio || !horaFin) {
        return NextResponse.json({ error: "Hora de inicio y fin requeridas" }, { status: 400 });
      }
      if (horaFin <= horaInicio) {
        return NextResponse.json({ error: "La hora de fin debe ser posterior a la de inicio" }, { status: 400 });
      }
      const id = await createDiaBloqueado({
        tipo:        "dia",
        fecha:       FECHA_TIEMPO_MUERTO,
        hora_inicio: horaInicio,
        hora_fin:    horaFin,
        motivo:      body.motivo || "Tiempo muerto",
      });
      return NextResponse.json({ id }, { status: 201 });
    }

    // Bloqueo individual de fecha
    if (!body.fecha || !body.motivo) {
      return NextResponse.json({ error: "fecha y motivo requeridos" }, { status: 400 });
    }
    const id = await createDiaBloqueado({
      tipo:        body.tipo || "dia",
      fecha:       body.fecha,
      hora_inicio: normHora(body.hora_inicio),
      hora_fin:    normHora(body.hora_fin),
      motivo:      body.motivo,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al guardar bloqueo";
    console.error("[POST /api/dias-bloqueados]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
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
