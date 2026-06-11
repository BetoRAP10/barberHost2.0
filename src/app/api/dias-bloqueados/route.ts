import { NextResponse } from "next/server";
import { createDiaBloqueado, deleteDiaBloqueado, getDiasBloqueados } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { bloqueoSchema } from "@/lib/validators";

export async function GET() {
  return NextResponse.json(getDiasBloqueados());
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = bloqueoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const id = createDiaBloqueado(parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  deleteDiaBloqueado(Number(id));
  return NextResponse.json({ success: true });
}
