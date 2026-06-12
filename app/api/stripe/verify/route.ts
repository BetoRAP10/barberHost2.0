import { NextResponse } from "next/server";
import Stripe from "stripe";
import { attachClienteToCita, getCitaById, getCitaByStripeSession, updateCitaStripe } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-05-27.dahlia" });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "session_id requerido" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid    = session.payment_status === "paid";
    const meta    = session.metadata ?? {};

    // Auto-confirmar siempre que el pago haya sido exitoso
    let citaId: number | undefined;
    if (paid) {
      try {
        let cita = await getCitaByStripeSession(sessionId);

        // Fallback: si attachClienteToCita falló silenciosamente antes y stripe_session_id
        // nunca se guardó en la cita, recuperarla por hold_id del metadata de Stripe
        if (!cita && meta.hold_id) {
          const holdCita = await getCitaById(Number(meta.hold_id));
          if (holdCita && meta.cliente_id) {
            console.log(`[verify] stripe_session_id no encontrado, reparando cita ${meta.hold_id}`);
            await attachClienteToCita(Number(meta.hold_id), Number(meta.cliente_id), sessionId);
            cita = await getCitaById(Number(meta.hold_id));
          }
        }

        if (cita) {
          citaId = cita.id;
          if (cita.estado === "pendiente" || cita.stripe_payment_status !== "pagado") {
            await updateCitaStripe(cita.id, "pagado", "confirmada");
          }
        } else {
          console.warn(`[verify] no se encontró cita para session_id=${sessionId} hold_id=${meta.hold_id ?? "N/A"}`);
        }
      } catch (e) {
        console.error("[verify] auto-confirm:", e);
      }
    }

    return NextResponse.json({
      paid,
      cita_id:        citaId,
      nombre:         meta.cliente_nombre  ?? "",
      email:          meta.cliente_email   ?? "",
      telefono:       meta.cliente_tel     ?? "",
      servicio:       meta.servicios_txt   ?? "",
      fecha_hora:     meta.fecha_hora      ?? "",
      precio_total:   Number(meta.precio_total   ?? 0),
      duracion_total: Number(meta.duracion_total ?? 0),
      notas:          meta.notas           ?? "",
      referencia:     session.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al verificar";
    console.error("[stripe/verify]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
