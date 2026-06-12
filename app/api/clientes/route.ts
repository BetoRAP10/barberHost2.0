import { NextResponse } from "next/server";
import { getClientesConHistorial } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q") ?? undefined;
  return NextResponse.json(await getClientesConHistorial(search));
}
