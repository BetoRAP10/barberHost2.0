import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  attachClienteToCita,
  createCitaConServicios,
  getCitaById,
  getOrCreateCliente,
  getServiciosByIds,
  isSlotAvailable,
} from "@/lib/db";
import { clienteSchema } from "@/lib/validators";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-05-27.dahlia" });

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = clienteSchema.safeParse(body.cliente);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Aceptar formato { items: [{id, cantidad}] } o legacy { servicio_ids: [1,1,2] }
    type Item = { id: number; cantidad: number };
    let items: Item[];

    if (Array.isArray(body.items)) {
      items = body.items.map((i: Item) => ({ id: Number(i.id), cantidad: Number(i.cantidad) }));
    } else if (Array.isArray(body.servicio_ids)) {
      const countMap = new Map<number, number>();
      for (const id of body.servicio_ids as number[]) {
        countMap.set(id, (countMap.get(id) ?? 0) + 1);
      }
      items = Array.from(countMap.entries()).map(([id, cantidad]) => ({ id, cantidad }));
    } else {
      items = [{ id: Number(body.servicio_id), cantidad: 1 }];
    }

    const { fecha_hora } = body;
    if (!items.length || !fecha_hora) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const uniqueIds = [...new Set(items.map((i) => i.id))];
    const servicioList = await getServiciosByIds(uniqueIds);
    if (!servicioList.length) {
      return NextResponse.json({ error: "Servicios no encontrados" }, { status: 404 });
    }

    const servicioMap = new Map(servicioList.map((s) => [s.id, s]));

    // Calcular duración y precio con cantidades
    const duracionTotal = items.reduce((s, item) => {
      const sv = servicioMap.get(item.id);
      return s + (sv ? sv.duracion_minutos * item.cantidad : 0);
    }, 0);

    const fecha = fecha_hora.split("T")[0];
    const hora  = fecha_hora.split("T")[1]?.slice(0, 5);

    // Si viene un hold_id, verificar que sigue vigente
    const holdId = body.hold_id ? Number(body.hold_id) : null;
    if (holdId) {
      const holdCita = await getCitaById(holdId);
      if (!holdCita || holdCita.estado !== "pendiente") {
        return NextResponse.json({ error: "La reserva temporal expiró. Elige otro horario." }, { status: 409 });
      }
      const creado = new Date(holdCita.creado_en ?? 0).getTime();
      if (Date.now() - creado > 15 * 60 * 1000) {
        return NextResponse.json({ error: "La reserva temporal expiró. Elige otro horario." }, { status: 409 });
      }
      // Verificar que nadie más pagó el mismo slot mientras el hold estaba activo
      if (!(await isSlotAvailable(fecha, hora, duracionTotal, holdId))) {
        return NextResponse.json({ error: "Ese horario ya fue reservado. Elige otro." }, { status: 409 });
      }
    } else if (!(await isSlotAvailable(fecha, hora, duracionTotal))) {
      return NextResponse.json({ error: "Horario no disponible" }, { status: 409 });
    }

    const clienteId = await getOrCreateCliente(
      parsed.data.nombre,
      parsed.data.email,
      parsed.data.telefono
    );

    const baseUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";

    // Stripe line items con cantidad real
    const lineItems = items.map((item) => {
      const sv = servicioMap.get(item.id)!;
      return {
        price_data: {
          currency: "mxn",
          product_data: {
            name: sv.nombre,
            description: sv.descripcion ?? undefined,
          },
          unit_amount: Math.max(50, Math.round(Number(sv.precio) * 100)),
        },
        quantity: item.cantidad,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      currency: "mxn",
      line_items: lineItems,
      success_url: `${baseUrl}/reservar/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  holdId
        ? `${baseUrl}/reservar?cancel_hold=${holdId}`
        : `${baseUrl}/reservar`,
      metadata: {
        cliente_id:     String(clienteId),
        items_json:     JSON.stringify(items),
        fecha_hora,
        notas:          parsed.data.notas ?? "",
        cliente_nombre: parsed.data.nombre,
        cliente_email:  parsed.data.email,
        cliente_tel:    parsed.data.telefono,
        servicios_txt:  items.map((i) => `${servicioMap.get(i.id)?.nombre}×${i.cantidad}`).join(", "),
        precio_total:   String(items.reduce((s, i) => s + Number(servicioMap.get(i.id)?.precio ?? 0) * i.cantidad, 0)),
        duracion_total: String(duracionTotal),
      },
    });

    let citaId: number;
    if (holdId) {
      // Reutilizar el hold: adjuntar cliente y session de Stripe
      await attachClienteToCita(holdId, clienteId, session.id);
      citaId = holdId;
    } else {
      // Flujo sin hold: crear cita desde cero
      const serviciosExpandidos = items.flatMap((item) => {
        const sv = servicioMap.get(item.id)!;
        return Array.from({ length: item.cantidad }, () => sv);
      });
      citaId = await createCitaConServicios({
        servicios: serviciosExpandidos,
        cliente_id: clienteId,
        fecha_hora,
        notas: parsed.data.notas,
        stripe_session_id: session.id,
        stripe_payment_status: "pendiente",
        estado: "pendiente",
      });
    }

    return NextResponse.json({ url: session.url, cita_id: citaId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    console.error("[stripe/checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
