import { NextResponse } from "next/server";
import { getCitaById } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cita = getCitaById(Number(id));
  if (!cita) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(cita);
}
