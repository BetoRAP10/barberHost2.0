import { NextResponse } from "next/server";
import { loginAdmin } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const success = await loginAdmin(parsed.data.email, parsed.data.password);
  if (!success) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
