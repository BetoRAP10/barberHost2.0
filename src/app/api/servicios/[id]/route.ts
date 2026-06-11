import { NextResponse } from "next/server";
import { deleteServicio, getServicioById, updateServicio } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { servicioSchema } from "@/lib/validators";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const servicio = getServicioById(Number(id));
  if (!servicio) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(servicio);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();

  if ("activo" in body) {
    updateServicio(Number(id), { activo: Number(body.activo) });
    return NextResponse.json({ success: true });
  }

  const parsed = servicioSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  updateServicio(Number(id), parsed.data);
  return NextResponse.json({ success: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  deleteServicio(Number(id));
  return NextResponse.json({ success: true });
}
