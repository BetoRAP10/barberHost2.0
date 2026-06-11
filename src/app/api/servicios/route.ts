import { NextResponse } from "next/server";
import { getServicios } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activos = searchParams.get("activos") === "true";
  const servicios = getServicios(activos);
  return NextResponse.json(servicios);
}
