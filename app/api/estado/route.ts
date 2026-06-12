import { NextResponse } from "next/server";
import { getEstadoTienda, bloquearHastaAviso, reactivarTienda } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  return NextResponse.json(await getEstadoTienda());
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await request.json();

  if (body.action === "cerrar") {
    const id = await bloquearHastaAviso(body.motivo ?? "Cerrado temporalmente");
    return NextResponse.json({ id });
  }

  if (body.action === "abrir") {
    await reactivarTienda();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
