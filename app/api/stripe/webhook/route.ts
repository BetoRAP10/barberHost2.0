import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getCitaByStripeSession, updateCitaStripe } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-05-27.dahlia" });

export async function POST(request: Request) {
  const body   = await request.text();
  const sig    = request.headers.get("stripe-signature") ?? "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: Stripe.Event;

  const secretConfigured = secret && secret !== "whsec_PENDIENTE";

  if (secretConfigured) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, secret);
    } catch {
      return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // En producción SIEMPRE se requiere STRIPE_WEBHOOK_SECRET
    console.error("[webhook] STRIPE_WEBHOOK_SECRET no configurado en producción");
    return NextResponse.json({ error: "Webhook no configurado correctamente" }, { status: 500 });
  } else {
    // Solo en desarrollo: parsear sin verificar firma
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const cita    = await getCitaByStripeSession(session.id);
    if (cita && cita.estado !== "confirmada") {
      await updateCitaStripe(cita.id, "pagado", "confirmada");
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const cita    = await getCitaByStripeSession(session.id);
    if (cita && cita.estado === "pendiente") {
      await updateCitaStripe(cita.id, "sin_pago", "cancelada");
    }
  }

  return NextResponse.json({ received: true });
}
