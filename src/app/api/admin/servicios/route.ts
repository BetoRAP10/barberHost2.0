import { NextResponse } from "next/server";
import { createServicio } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { servicioSchema } from "@/lib/validators";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = servicioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const id = createServicio(parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}
