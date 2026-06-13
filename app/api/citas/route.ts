import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  createCita,
  getAvailableDays,
  getAvailableSlots,
  getSlotsStatus,
  getCitas,
  getCitasByEmail,
  getCitaById,
  getOrCreateCliente,
  getServicioById,
  isSlotAvailable,
  reprogramarCita,
  updateCitaEstado,
  updateCitaStripe,
} from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { clienteSchema } from "@/lib/validators";
import type { EstadoCita } from "@/lib/types";

const normTel = (t: string) => t.replace(/[\s\-\(\)\+\.]/g, "");

async function tryStripeRefund(citaId: number, stripeSessionId: string): Promise<boolean> {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-05-27.dahlia" });
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
    if (session.payment_intent) {
      await stripe.refunds.create({ payment_intent: session.payment_intent as string });
      await updateCitaStripe(citaId, "reembolsado", "cancelada");
      return true;
    }
  } catch (e) {
    console.error("[citas] Stripe refund error:", e instanceof Error ? e.message : e);
  }
  return false;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const fecha = searchParams.get("fecha");
    const servicioId = searchParams.get("servicio_id");
    const excludeId = searchParams.get("exclude_id");
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const duracion = searchParams.get("duracion");

    if (email) {
      return NextResponse.json(await getCitasByEmail(email));
    }

    if (fecha && duracion) {
      const mostrarOcupados = searchParams.get("ocupados") === "true";
      if (mostrarOcupados) {
        const slots = await getSlotsStatus(
          fecha,
          Number(duracion),
          excludeId ? Number(excludeId) : undefined
        );
        return NextResponse.json(slots);
      }
      const slots = await getAvailableSlots(
        fecha,
        Number(duracion),
        excludeId ? Number(excludeId) : undefined
      );
      return NextResponse.json(slots);
    }

    if (year && month && duracion) {
      const days = await getAvailableDays(
        Number(year),
        Number(month),
        Number(duracion),
        excludeId ? Number(excludeId) : undefined
      );
      return NextResponse.json(days);
    }

    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const filters = {
      estado: searchParams.get("estado") as EstadoCita | undefined,
      servicio_id: servicioId ? Number(servicioId) : undefined,
      fecha_desde: searchParams.get("fecha_desde") ?? undefined,
      fecha_hasta: searchParams.get("fecha_hasta") ?? undefined,
    };

    return NextResponse.json(await getCitas(filters));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    console.error("[GET /api/citas]", msg);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    // ── Reprogramar (admin) ──────────────────────────────────────────────────
    if (body.action === "reprogramar") {
      if (!(await isAdminAuthenticated())) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      const { id, fecha_hora } = body;
      if (!id || !fecha_hora) {
        return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
      }
      const cita = await getCitaById(Number(id));
      if (!cita) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

      const fecha = fecha_hora.split("T")[0];
      const hora = fecha_hora.split("T")[1]?.slice(0, 5);
      const duracion = (cita.duracion_total ?? 0) > 0 ? cita.duracion_total : cita.servicio_duracion;
      if (!(await isSlotAvailable(fecha, hora, duracion, cita.id))) {
        return NextResponse.json({ error: "Horario no disponible" }, { status: 409 });
      }
      await reprogramarCita(Number(id), fecha_hora);
      return NextResponse.json({ success: true });
    }

    // ── Reprogramar público (verificación por teléfono) ──────────────────────
    if (body.action === "reprogramar_publico") {
      const { id, fecha_hora, telefono } = body;
      if (!id || !fecha_hora || !telefono) {
        return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
      }
      const cita = await getCitaById(Number(id));
      if (!cita) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

      // Verificar identidad por teléfono
      if (normTel(String(telefono)) !== normTel(cita.cliente_telefono ?? "")) {
        return NextResponse.json({ error: "Teléfono incorrecto" }, { status: 403 });
      }
      // Solo citas futuras pueden reprogramarse
      if (new Date(cita.fecha_hora) <= new Date()) {
        return NextResponse.json({ error: "Esta cita ya ocurrió y no puede reprogramarse" }, { status: 400 });
      }
      if (cita.estado === "cancelada" || cita.estado === "completada") {
        return NextResponse.json({ error: "Esta cita no puede reprogramarse" }, { status: 400 });
      }
      // Límite de 2 meses
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 2);
      if (new Date(fecha_hora) > maxDate) {
        return NextResponse.json({ error: "No se puede reagendar a más de 2 meses" }, { status: 400 });
      }
      const fecha = fecha_hora.split("T")[0];
      const hora = fecha_hora.split("T")[1]?.slice(0, 5);
      const duracion = (cita.duracion_total ?? 0) > 0 ? cita.duracion_total : cita.servicio_duracion;
      if (!(await isSlotAvailable(fecha, hora, duracion, cita.id))) {
        return NextResponse.json({ error: "Horario no disponible" }, { status: 409 });
      }
      await reprogramarCita(Number(id), fecha_hora);
      return NextResponse.json({ success: true });
    }

    // ── Cancelar (admin) ─────────────────────────────────────────────────────
    if (body.action === "cancelar") {
      if (!(await isAdminAuthenticated())) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      if (!body.id) {
        return NextResponse.json({ error: "ID requerido" }, { status: 400 });
      }
      const cita = await getCitaById(Number(body.id));
      if (!cita) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

      let reembolsado = false;
      if (cita.stripe_session_id && cita.stripe_payment_status === "pagado") {
        reembolsado = await tryStripeRefund(cita.id, cita.stripe_session_id);
      }
      if (!reembolsado) {
        await updateCitaEstado(Number(body.id), "cancelada");
      }
      return NextResponse.json({ success: true, reembolsado });
    }

    // ── Cancelar público (verificación por teléfono) ─────────────────────────
    if (body.action === "cancelar_publico") {
      const { id, telefono } = body;
      if (!id || !telefono) {
        return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
      }
      const cita = await getCitaById(Number(id));
      if (!cita) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

      if (normTel(String(telefono)) !== normTel(cita.cliente_telefono ?? "")) {
        return NextResponse.json({ error: "Teléfono incorrecto" }, { status: 403 });
      }
      if (new Date(cita.fecha_hora) <= new Date()) {
        return NextResponse.json({ error: "Esta cita ya ocurrió y no puede cancelarse" }, { status: 400 });
      }
      if (cita.estado === "cancelada" || cita.estado === "completada") {
        return NextResponse.json({ error: "Esta cita no puede cancelarse" }, { status: 400 });
      }

      let reembolsado = false;
      if (cita.stripe_session_id && cita.stripe_payment_status === "pagado") {
        reembolsado = await tryStripeRefund(cita.id, cita.stripe_session_id);
      }
      if (!reembolsado) {
        await updateCitaEstado(Number(id), "cancelada");
      }
      return NextResponse.json({ success: true, reembolsado });
    }

    // ── Cambio de estado (admin) ─────────────────────────────────────────────
    if (body.action === "estado") {
      if (!(await isAdminAuthenticated())) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      if (!body.id || !body.estado) {
        return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
      }
      const nuevoEstado = body.estado as EstadoCita;
      const cita = await getCitaById(Number(body.id));
      if (!cita) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

      if (nuevoEstado === "cancelada") {
        return NextResponse.json(
          { error: "Usa action: cancelar para cancelar citas" },
          { status: 400 }
        );
      }

      if (nuevoEstado === "confirmada") {
        if (cita.estado !== "pendiente") {
          return NextResponse.json(
            { error: "Solo se pueden confirmar citas pendientes" },
            { status: 400 }
          );
        }
        if (cita.stripe_session_id && cita.stripe_payment_status !== "pagado") {
          return NextResponse.json(
            { error: "El pago aún no ha sido confirmado" },
            { status: 400 }
          );
        }
      }

      if (nuevoEstado === "completada") {
        if (cita.estado !== "confirmada") {
          return NextResponse.json(
            { error: "Solo se pueden completar citas confirmadas" },
            { status: 400 }
          );
        }
        if (new Date(cita.fecha_hora) > new Date()) {
          return NextResponse.json(
            { error: "No puedes completar una cita que aún no ha ocurrido" },
            { status: 400 }
          );
        }
      }

      await updateCitaEstado(Number(body.id), nuevoEstado);
      return NextResponse.json({ success: true });
    }

    // ── Crear cita pública (sin pago directo) ────────────────────────────────
    const parsed = clienteSchema.safeParse(body.cliente);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { servicio_id, fecha_hora } = body;
    if (!servicio_id || !fecha_hora) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const fecha = fecha_hora.split("T")[0];
    const hora = fecha_hora.split("T")[1]?.slice(0, 5);
    const servicio = await getServicioById(Number(servicio_id));
    if (!servicio) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });

    if (!(await isSlotAvailable(fecha, hora, servicio.duracion_minutos))) {
      return NextResponse.json({ error: "Horario no disponible" }, { status: 409 });
    }

    const clienteId = await getOrCreateCliente(
      parsed.data.nombre,
      parsed.data.email,
      parsed.data.telefono
    );

    const citaId = await createCita({
      servicio_id: Number(servicio_id),
      cliente_id: clienteId,
      fecha_hora,
      notas: parsed.data.notas,
    });

    const cita = await getCitaById(citaId);
    return NextResponse.json(cita, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    console.error("[POST /api/citas]", msg);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
