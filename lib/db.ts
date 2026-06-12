import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { format } from "date-fns";
import {
  HORARIO_APERTURA,
  HORARIO_CIERRE,
  INTERVALO_MINUTOS,
} from "./types";
import type {
  CitaConDetalles,
  CitaServicio,
  Cliente,
  ClienteConHistorial,
  DashboardStats,
  DiaBloqueado,
  EstadoCita,
  EstadoPago,
  EstadoTienda,
  Servicio,
  TipoBloqueo,
} from "./types";

// ─── Cliente Supabase (server-side only) ──────────────────────────────────────

// Usa SUPABASE_SERVICE_KEY (sin NEXT_PUBLIC_) para omitir RLS en API routes
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey,
  { auth: { persistSession: false } }
);

// ─── Init / Seed ──────────────────────────────────────────────────────────────

let _initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!_initPromise) _initPromise = runSeed();
  return _initPromise;
}

async function runSeed(): Promise<void> {
  try {
    const { count: ac } = await supabase
      .from("usuarios_admin")
      .select("*", { count: "exact", head: true });
    if (ac === 0) {
      const hash = await bcrypt.hash("admin123", 10);
      await supabase.from("usuarios_admin").insert({
        nombre: "Administrador",
        email: "admin@barberhost.com",
        contrasena_hash: hash,
      });
    }
  } catch {
    // Si hay error RLS en usuarios_admin, continúa de todos modos
  }

  try {
    const { count: sc } = await supabase
      .from("servicios")
      .select("*", { count: "exact", head: true });
    if (sc === 0) {
      await supabase.from("servicios").insert([
        { nombre: "Corte Clásico",       descripcion: "Corte tradicional con acabado profesional y peinado.",   duracion_minutos: 30, precio: 200, categoria: "Corte" },
        { nombre: "Corte + Barba",        descripcion: "Servicio completo de corte y arreglo de barba.",          duracion_minutos: 45, precio: 350, categoria: "Combo" },
        { nombre: "Arreglo de Barba",     descripcion: "Perfilado y cuidado de barba con productos premium.",     duracion_minutos: 20, precio: 150, categoria: "Barba" },
        { nombre: "Tratamiento Capilar",  descripcion: "Hidratación profunda y masaje capilar relajante.",         duracion_minutos: 40, precio: 280, categoria: "Tratamiento" },
        { nombre: "Afeitado Clásico",     descripcion: "Afeitado tradicional con toalla caliente y bálsamo.",     duracion_minutos: 35, precio: 230, categoria: "Barba" },
        { nombre: "Corte Infantil",       descripcion: "Corte especial para niños con ambiente amigable.",        duracion_minutos: 25, precio: 180, categoria: "Corte" },
      ]);
    }
  } catch {
    // Si hay error RLS en servicios, continúa de todos modos
  }
}

// ─── Row helpers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toServicio(r: any): Servicio {
  return { ...r, activo: r.activo ? 1 : 0, precio: Number(r.precio) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBloqueo(r: any): DiaBloqueado {
  return { ...r, hasta_nuevo_aviso: r.hasta_nuevo_aviso ? 1 : 0 };
}

const SELECT_CITA = "*, servicios:servicio_id(*), clientes:cliente_id(*)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCitaConDetalles(r: any): CitaConDetalles {
  const { servicios: sv, clientes: cl, ...rest } = r;
  return {
    ...rest,
    servicio_nombre:    sv?.nombre           ?? "",
    servicio_precio:    Number(sv?.precio    ?? 0),
    servicio_duracion:  Number(sv?.duracion_minutos ?? 0),
    servicio_categoria: sv?.categoria        ?? "",
    cliente_nombre:     cl?.nombre           ?? "",
    cliente_email:      cl?.email            ?? "",
    cliente_telefono:   cl?.telefono         ?? "",
  };
}

// ─── Servicios ────────────────────────────────────────────────────────────────

export async function getServicios(activosOnly = false): Promise<Servicio[]> {
  await ensureInit();
  let query = supabase.from("servicios").select("*").order("categoria").order("nombre");
  if (activosOnly) query = query.eq("activo", true);
  const { data, error } = await query;
  if (error) { console.error("[DB] getServicios:", error.message); return []; }
  return (data ?? []).map(toServicio);
}

export async function getServicioById(id: number): Promise<Servicio | undefined> {
  await ensureInit();
  const { data } = await supabase.from("servicios").select("*").eq("id", id).single();
  return data ? toServicio(data) : undefined;
}

export async function getServiciosByIds(ids: number[]): Promise<Servicio[]> {
  if (ids.length === 0) return [];
  await ensureInit();
  const { data } = await supabase.from("servicios").select("*").in("id", ids);
  return (data ?? []).map(toServicio);
}

export async function createServicio(
  data: Omit<Servicio, "id" | "creado_en" | "activo">
): Promise<number> {
  await ensureInit();
  const { data: row, error } = await supabase
    .from("servicios")
    .insert(data)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return row.id;
}

export async function updateServicio(
  id: number,
  data: Partial<Omit<Servicio, "id" | "creado_en">>
): Promise<boolean> {
  await ensureInit();
  const current = await getServicioById(id);
  if (!current) return false;
  const update = {
    nombre:            data.nombre            ?? current.nombre,
    descripcion:       data.descripcion       ?? current.descripcion,
    duracion_minutos:  data.duracion_minutos  ?? current.duracion_minutos,
    precio:            data.precio            ?? current.precio,
    categoria:         data.categoria         ?? current.categoria,
    activo:            Boolean(data.activo    ?? current.activo),
  };
  const { error } = await supabase.from("servicios").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

export async function deleteServicio(id: number): Promise<void> {
  await ensureInit();
  await supabase.from("servicios").delete().eq("id", id);
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export async function getOrCreateCliente(
  nombre: string,
  email: string,
  telefono: string
): Promise<number> {
  await ensureInit();
  const lEmail = email.toLowerCase();
  const { data: existing } = await supabase
    .from("clientes")
    .select("id")
    .eq("email", lEmail)
    .single();

  if (existing) {
    await supabase.from("clientes").update({ nombre, telefono }).eq("id", existing.id);
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from("clientes")
    .insert({ nombre, email: lEmail, telefono })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return inserted.id;
}

export async function getClientes(search?: string): Promise<Cliente[]> {
  await ensureInit();
  let query = supabase.from("clientes").select("*").order("nombre");
  if (search) query = query.or(`nombre.ilike.%${search}%,email.ilike.%${search}%`);
  const { data } = await query;
  return data ?? [];
}

export async function getClientesConHistorial(
  search?: string
): Promise<ClienteConHistorial[]> {
  const [clientes, allCitas] = await Promise.all([getClientes(search), getCitas()]);
  return clientes.map((c) => ({
    ...c,
    total_citas: allCitas.filter((ci) => ci.cliente_id === c.id).length,
    citas: allCitas.filter((ci) => ci.cliente_id === c.id),
  }));
}

// ─── Citas ────────────────────────────────────────────────────────────────────

export async function getCitas(filters?: {
  estado?: EstadoCita;
  servicio_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
}): Promise<CitaConDetalles[]> {
  await ensureInit();
  let query = supabase
    .from("citas")
    .select(SELECT_CITA)
    .order("fecha_hora", { ascending: true });

  if (filters?.estado)      query = query.eq("estado", filters.estado);
  if (filters?.servicio_id) query = query.eq("servicio_id", filters.servicio_id);
  if (filters?.fecha_desde) query = query.gte("fecha_hora", filters.fecha_desde);
  if (filters?.fecha_hasta) query = query.lte("fecha_hora", filters.fecha_hasta + "T23:59:59");

  const { data, error } = await query;
  if (error) { console.error("[DB] getCitas:", error.message); return []; }
  return (data ?? []).map(toCitaConDetalles);
}

export async function getCitaById(id: number): Promise<CitaConDetalles | undefined> {
  await ensureInit();
  const { data } = await supabase.from("citas").select(SELECT_CITA).eq("id", id).single();
  if (!data) return undefined;
  const cita = toCitaConDetalles(data);
  cita.servicios_adicionales = await getCitaServicios(id);
  return cita;
}

export async function getCitaByStripeSession(
  sessionId: string
): Promise<CitaConDetalles | undefined> {
  await ensureInit();
  const { data } = await supabase
    .from("citas")
    .select(SELECT_CITA)
    .eq("stripe_session_id", sessionId)
    .single();
  if (!data) return undefined;
  const cita = toCitaConDetalles(data);
  cita.servicios_adicionales = await getCitaServicios(cita.id);
  return cita;
}

export async function getCitasByEmail(email: string): Promise<CitaConDetalles[]> {
  await ensureInit();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("email", email.toLowerCase())
    .single();
  if (!cliente) return [];

  const { data } = await supabase
    .from("citas")
    .select(SELECT_CITA)
    .eq("cliente_id", cliente.id)
    .order("fecha_hora", { ascending: false });

  return await Promise.all(
    (data ?? []).map(async (c) => {
      const cita = toCitaConDetalles(c);
      cita.servicios_adicionales = await getCitaServicios(cita.id);
      return cita;
    })
  );
}

export async function getCitaServicios(citaId: number): Promise<CitaServicio[]> {
  await ensureInit();
  const { data } = await supabase
    .from("cita_servicios")
    .select("*, servicios:servicio_id(nombre)")
    .eq("cita_id", citaId);
  return (data ?? []).map((r: any) => ({
    ...r,
    servicio_nombre: r.servicios?.nombre ?? "",
    servicios: undefined,
  }));
}

export async function createCita(data: {
  servicio_id: number;
  cliente_id: number;
  fecha_hora: string;
  notas?: string;
  duracion_total?: number;
  precio_total?: number;
  stripe_session_id?: string;
  stripe_payment_status?: EstadoPago;
  estado?: EstadoCita;
}): Promise<number> {
  await ensureInit();
  const { data: row, error } = await supabase
    .from("citas")
    .insert({
      servicio_id:            data.servicio_id,
      cliente_id:             data.cliente_id,
      fecha_hora:             data.fecha_hora,
      estado:                 data.estado                ?? "confirmada",
      notas:                  data.notas                 ?? "",
      duracion_total:         data.duracion_total        ?? 0,
      precio_total:           data.precio_total          ?? 0,
      stripe_session_id:      data.stripe_session_id     ?? null,
      stripe_payment_status:  data.stripe_payment_status ?? "sin_pago",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return row.id;
}

export async function createCitaConServicios(data: {
  servicios: Servicio[];
  cliente_id: number;
  fecha_hora: string;
  notas?: string;
  stripe_session_id?: string;
  stripe_payment_status?: EstadoPago;
  estado?: EstadoCita;
}): Promise<number> {
  await ensureInit();
  const duracion_total = data.servicios.reduce((s, sv) => s + sv.duracion_minutos, 0);
  const precio_total   = data.servicios.reduce((s, sv) => s + Number(sv.precio), 0);
  const primary        = data.servicios[0];

  const { data: row, error } = await supabase
    .from("citas")
    .insert({
      servicio_id:            primary.id,
      cliente_id:             data.cliente_id,
      fecha_hora:             data.fecha_hora,
      estado:                 data.estado                ?? "confirmada",
      notas:                  data.notas                 ?? "",
      duracion_total,
      precio_total,
      stripe_session_id:      data.stripe_session_id     ?? null,
      stripe_payment_status:  data.stripe_payment_status ?? "sin_pago",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const citaId: number = row.id;
  if (data.servicios.length > 0) {
    await supabase.from("cita_servicios").insert(
      data.servicios.map((sv) => ({
        cita_id:          citaId,
        servicio_id:      sv.id,
        precio:           sv.precio,
        duracion_minutos: sv.duracion_minutos,
      }))
    );
  }
  return citaId;
}

export async function createHoldCita(data: {
  servicios: Servicio[];
  fecha_hora: string;
  notas?: string;
}): Promise<number> {
  await ensureInit();
  const duracion_total = data.servicios.reduce((s, sv) => s + sv.duracion_minutos, 0);
  const precio_total   = data.servicios.reduce((s, sv) => s + Number(sv.precio), 0);
  const primary        = data.servicios[0];

  const { data: row, error } = await supabase
    .from("citas")
    .insert({
      servicio_id:           primary.id,
      cliente_id:            null,       // sin cliente hasta que pague
      fecha_hora:            data.fecha_hora,
      estado:                "pendiente",
      notas:                 data.notas ?? "",
      duracion_total,
      precio_total,
      stripe_payment_status: "sin_pago",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const citaId: number = row.id;
  await supabase.from("cita_servicios").insert(
    data.servicios.map((sv) => ({
      cita_id:          citaId,
      servicio_id:      sv.id,
      precio:           sv.precio,
      duracion_minutos: sv.duracion_minutos,
    }))
  );
  return citaId;
}

export async function attachClienteToCita(
  citaId: number,
  clienteId: number,
  stripeSessionId: string,
): Promise<void> {
  await ensureInit();
  await supabase
    .from("citas")
    .update({
      cliente_id:            clienteId,
      stripe_session_id:     stripeSessionId,
      stripe_payment_status: "pendiente",
      actualizado_en:        new Date().toISOString(),
    })
    .eq("id", citaId);
}

export async function updateCitaEstado(id: number, estado: EstadoCita): Promise<void> {
  await ensureInit();
  await supabase
    .from("citas")
    .update({ estado, actualizado_en: new Date().toISOString() })
    .eq("id", id);
}

export async function updateCitaStripe(
  citaId: number,
  status: EstadoPago,
  estado?: EstadoCita
): Promise<void> {
  await ensureInit();
  const update: Record<string, unknown> = {
    stripe_payment_status: status,
    actualizado_en: new Date().toISOString(),
  };
  if (estado) update.estado = estado;
  await supabase.from("citas").update(update).eq("id", citaId);
}

export async function reprogramarCita(id: number, fecha_hora: string): Promise<void> {
  await ensureInit();
  const { error } = await supabase
    .from("citas")
    .update({ fecha_hora, estado: "confirmada", actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Días Bloqueados ──────────────────────────────────────────────────────────

export async function getDiasBloqueados(): Promise<DiaBloqueado[]> {
  await ensureInit();
  const { data } = await supabase
    .from("dias_bloqueados")
    .select("*")
    .order("hasta_nuevo_aviso", { ascending: false })
    .order("fecha", { ascending: true });
  return (data ?? []).map(toBloqueo);
}

export async function getEstadoTienda(): Promise<EstadoTienda> {
  await ensureInit();
  const { data } = await supabase
    .from("dias_bloqueados")
    .select("id, motivo")
    .eq("hasta_nuevo_aviso", true)
    .limit(1)
    .single();
  return data
    ? { abierta: false, motivo: data.motivo, bloqueo_id: data.id }
    : { abierta: true };
}

export async function createDiaBloqueado(data: {
  tipo?: TipoBloqueo;
  fecha: string;
  fecha_fin?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  motivo: string;
  hasta_nuevo_aviso?: boolean;
}): Promise<number> {
  await ensureInit();
  const tipo = data.tipo ?? "dia";
  const esIndefinido = tipo === "indefinido" || data.hasta_nuevo_aviso === true;
  const { data: row, error } = await supabase
    .from("dias_bloqueados")
    .insert({
      tipo:              esIndefinido ? "indefinido" : tipo,
      fecha:             data.fecha,
      fecha_fin:         data.fecha_fin      ?? null,
      hora_inicio:       data.hora_inicio    ?? null,
      hora_fin:          data.hora_fin       ?? null,
      motivo:            data.motivo,
      hasta_nuevo_aviso: esIndefinido,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return row.id;
}

export async function deleteDiaBloqueado(id: number): Promise<void> {
  await ensureInit();
  await supabase.from("dias_bloqueados").delete().eq("id", id);
}

export async function bloquearHastaAviso(motivo: string): Promise<number> {
  await ensureInit();
  await supabase.from("dias_bloqueados").delete().eq("hasta_nuevo_aviso", true);
  const today = format(new Date(), "yyyy-MM-dd");
  return createDiaBloqueado({ tipo: "indefinido", fecha: today, motivo, hasta_nuevo_aviso: true });
}

export async function reactivarTienda(): Promise<void> {
  await ensureInit();
  await supabase.from("dias_bloqueados").delete().eq("hasta_nuevo_aviso", true);
}

// ─── Disponibilidad ───────────────────────────────────────────────────────────

function isFechaBlocked(fecha: string, bloqueos: DiaBloqueado[]): boolean {
  const date = new Date(fecha + "T12:00:00");
  for (const b of bloqueos) {
    if (b.hasta_nuevo_aviso) return true;
    const tipo = b.tipo ?? "dia";
    if (tipo === "indefinido") return true;
    if (tipo === "diario") return true; // aplica a todos los días (tiempo muerto recurrente)
    if (tipo === "dia" && b.fecha === fecha) return true;
    if (tipo === "rango") {
      const fin = b.fecha_fin ?? b.fecha;
      if (fecha >= b.fecha && fecha <= fin) return true;
    }
    if (tipo === "semana") {
      const blockDate = new Date(b.fecha + "T12:00:00");
      const blockDow  = (blockDate.getDay() + 6) % 7;
      const dateDow   = (date.getDay() + 6) % 7;
      const blockMon  = new Date(blockDate.getTime() - blockDow * 86400000);
      const dateMon   = new Date(date.getTime() - dateDow * 86400000);
      if (blockMon.toISOString().split("T")[0] === dateMon.toISOString().split("T")[0]) return true;
    }
    if (tipo === "mes" && fecha.substring(0, 7) === b.fecha.substring(0, 7)) return true;
  }
  return false;
}

function isHoraBlocked(fecha: string, hora: string, bloqueos: DiaBloqueado[]): boolean {
  for (const b of bloqueos) {
    const tipo = b.tipo ?? "dia";
    // Para bloqueos "diario" (tiempo muerto recurrente), solo verificar la hora sin chequear fecha
    if (tipo === "diario") {
      if (b.hora_inicio && b.hora_fin && hora >= b.hora_inicio && hora < b.hora_fin) return true;
      continue;
    }
    if (!isFechaBlocked(fecha, [b])) continue;
    if (!b.hora_inicio && !b.hora_fin) return true;
    if (b.hora_inicio && b.hora_fin && hora >= b.hora_inicio && hora < b.hora_fin) return true;
  }
  return false;
}

type CitaSlot = { fecha_hora: string; duracion_eff: number };

function slotFreeInMemory(
  fecha: string,
  hora: string,
  duracion: number,
  bloqueos: DiaBloqueado[],
  citas: CitaSlot[]
): boolean {
  if (isFechaBlocked(fecha, bloqueos)) {
    const hasTiempo = bloqueos.some(
      (b) => isFechaBlocked(fecha, [b]) && (b.hora_inicio || b.hora_fin)
    );
    if (!hasTiempo) return false;
  }
  if (isHoraBlocked(fecha, hora, bloqueos)) return false;

  const start = new Date(`${fecha}T${hora}:00`);
  const end   = new Date(start.getTime() + duracion * 60000);
  for (const c of citas) {
    const cs = new Date(c.fecha_hora);
    const ce = new Date(cs.getTime() + Number(c.duracion_eff) * 60000);
    if (start < ce && end > cs) return false;
  }
  return true;
}

async function fetchBloqueos(): Promise<DiaBloqueado[]> {
  const { data } = await supabase.from("dias_bloqueados").select("*");
  return (data ?? []).map(toBloqueo);
}

async function fetchCitasForDate(fecha: string, excludeId?: number): Promise<CitaSlot[]> {
  const fifteenMinAgoMs = Date.now() - 15 * 60 * 1000;
  let query = supabase
    .from("citas")
    .select("id, fecha_hora, duracion_total, estado, creado_en, stripe_payment_status, servicios:servicio_id(duracion_minutos)")
    .gte("fecha_hora", fecha + "T00:00:00")
    .lte("fecha_hora", fecha + "T23:59:59")
    .neq("estado", "cancelada");

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw new Error(`[fetchCitasForDate] ${error.message}`);

  const raw = data ?? [];
  console.log(`[fetchCitasForDate] fecha=${fecha} excludeId=${excludeId ?? "none"} rawCount=${raw.length}`, raw.map((c: any) => ({ id: c.id, fecha_hora: c.fecha_hora, estado: c.estado, stripe_payment_status: c.stripe_payment_status, creado_en: c.creado_en })));

  const result = raw
    .filter((c: any) => {
      if (c.estado !== "pendiente") return true;
      if (c.stripe_payment_status === "pendiente") return true;
      const keep = new Date(c.creado_en).getTime() >= fifteenMinAgoMs;
      if (!keep) console.log(`[fetchCitasForDate] descartando hold expirado id=${c.id} creado_en=${c.creado_en}`);
      return keep;
    })
    .map((c: any) => ({
      fecha_hora:   c.fecha_hora,
      duracion_eff: c.duracion_total > 0
        ? c.duracion_total
        : ((c.servicios as any)?.duracion_minutos ?? 0) > 0
          ? (c.servicios as any).duracion_minutos
          : INTERVALO_MINUTOS,
    }));

  console.log(`[fetchCitasForDate] filteredCount=${result.length}`, result);
  return result;
}

export async function isSlotAvailable(
  fecha: string,
  hora: string,
  duracionMinutos: number,
  excludeCitaId?: number
): Promise<boolean> {
  await ensureInit();
  const [bloqueos, citas] = await Promise.all([
    fetchBloqueos(),
    fetchCitasForDate(fecha, excludeCitaId),
  ]);
  return slotFreeInMemory(fecha, hora, duracionMinutos, bloqueos, citas);
}

export async function getAvailableSlots(
  fecha: string,
  duracionMinutos: number,
  excludeCitaId?: number
): Promise<string[]> {
  await ensureInit();
  const [bloqueos, citas] = await Promise.all([
    fetchBloqueos(),
    fetchCitasForDate(fecha, excludeCitaId),
  ]);
  const slots: string[] = [];
  for (let h = HORARIO_APERTURA; h < HORARIO_CIERRE; h++) {
    for (let m = 0; m < 60; m += INTERVALO_MINUTOS) {
      if (h * 60 + m + duracionMinutos > HORARIO_CIERRE * 60) continue;
      const hora = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (slotFreeInMemory(fecha, hora, duracionMinutos, bloqueos, citas)) slots.push(hora);
    }
  }
  return slots;
}

export async function getSlotsStatus(
  fecha: string,
  duracionMinutos: number,
  excludeCitaId?: number
): Promise<{ hora: string; disponible: boolean }[]> {
  await ensureInit();
  const [bloqueos, citas] = await Promise.all([
    fetchBloqueos(),
    fetchCitasForDate(fecha, excludeCitaId),
  ]);
  const result: { hora: string; disponible: boolean }[] = [];
  for (let h = HORARIO_APERTURA; h < HORARIO_CIERRE; h++) {
    for (let m = 0; m < 60; m += INTERVALO_MINUTOS) {
      if (h * 60 + m + duracionMinutos > HORARIO_CIERRE * 60) continue;
      const hora = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      result.push({ hora, disponible: slotFreeInMemory(fecha, hora, duracionMinutos, bloqueos, citas) });
    }
  }
  return result;
}

export async function getAvailableDays(
  year: number,
  month: number,
  duracionMinutos: number
): Promise<string[]> {
  const estado = await getEstadoTienda();
  if (!estado.abierta) return [];

  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay   = new Date(year, month + 1, 0).getDate();
  const endDate   = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const thirtyMinAgoMs = Date.now() - 30 * 60 * 1000;

  const [bloqueos, { data: rawCitas }] = await Promise.all([
    fetchBloqueos(),
    supabase
      .from("citas")
      .select("fecha_hora, duracion_total, estado, creado_en, servicios:servicio_id(duracion_minutos)")
      .gte("fecha_hora", startDate + "T00:00:00")
      .lte("fecha_hora", endDate   + "T23:59:59")
      .neq("estado", "cancelada"),
  ]);

  const citaSlots: CitaSlot[] = (rawCitas ?? [])
    .filter((c: any) => !(c.estado === "pendiente" && new Date(c.creado_en).getTime() < thirtyMinAgoMs))
    .map((c: any) => ({
      fecha_hora:   c.fecha_hora,
      duracion_eff: c.duracion_total > 0
        ? c.duracion_total
        : ((c.servicios as any)?.duracion_minutos ?? 0) > 0
          ? (c.servicios as any).duracion_minutos
          : INTERVALO_MINUTOS,
    }));

  const days: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month, day);
    if (date < today || date.getDay() === 0) continue;
    const fecha = format(date, "yyyy-MM-dd");

    const dayCitas = citaSlots.filter((c) => c.fecha_hora.substring(0, 10) === fecha);

    let found = false;
    outer:
    for (let h = HORARIO_APERTURA; h < HORARIO_CIERRE; h++) {
      for (let m = 0; m < 60; m += INTERVALO_MINUTOS) {
        if (h * 60 + m + duracionMinutos > HORARIO_CIERRE * 60) continue;
        const hora = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        if (slotFreeInMemory(fecha, hora, duracionMinutos, bloqueos, dayCitas)) {
          found = true;
          break outer;
        }
      }
    }
    if (found) days.push(fecha);
  }
  return days;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getAdminById(
  id: number
): Promise<{ id: number; nombre: string; email: string } | undefined> {
  await ensureInit();
  const { data } = await supabase
    .from("usuarios_admin")
    .select("id, nombre, email")
    .eq("id", id)
    .single();
  return data ?? undefined;
}

export async function getAdminByEmail(
  email: string
): Promise<{ id: number; nombre: string; email: string; contrasena_hash: string } | undefined> {
  await ensureInit();
  const { data } = await supabase
    .from("usuarios_admin")
    .select("*")
    .eq("email", email.toLowerCase())
    .single();
  return data ?? undefined;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  await ensureInit();
  const today = new Date().toISOString().split("T")[0];
  const start = getStartOfWeek(new Date()).toISOString().split("T")[0];
  const end   = getEndOfWeek(new Date()).toISOString().split("T")[0];

  const [
    { count: citas_hoy },
    { count: citas_semana },
    { data: semanaData },
    proximas,
    { data: allEstados },
  ] = await Promise.all([
    supabase.from("citas").select("*", { count: "exact", head: true })
      .gte("fecha_hora", today + "T00:00:00")
      .lte("fecha_hora", today + "T23:59:59")
      .neq("estado", "cancelada"),
    supabase.from("citas").select("*", { count: "exact", head: true })
      .gte("fecha_hora", start)
      .lte("fecha_hora", end + "T23:59:59")
      .neq("estado", "cancelada"),
    supabase.from("citas")
      .select("precio_total, servicios:servicio_id(precio)")
      .gte("fecha_hora", start)
      .lte("fecha_hora", end + "T23:59:59")
      .in("estado", ["confirmada", "completada"]),
    getCitas({ fecha_desde: today }),
    supabase.from("citas").select("estado"),
  ]);

  const ingresos_semana = (semanaData ?? []).reduce((sum: number, c: any) => {
    const val = c.precio_total > 0 ? c.precio_total : (c.servicios?.precio ?? 0);
    return sum + Number(val);
  }, 0);

  const estadosMap = new Map<string, number>();
  (allEstados ?? []).forEach((c: any) =>
    estadosMap.set(c.estado, (estadosMap.get(c.estado) ?? 0) + 1)
  );

  return {
    citas_hoy:        citas_hoy   ?? 0,
    citas_semana:     citas_semana ?? 0,
    ingresos_semana,
    proximas_citas: proximas
      .filter((c) => c.estado !== "cancelada" && new Date(c.fecha_hora) >= new Date())
      .slice(0, 5),
    estados_distribucion: Array.from(estadosMap.entries()).map(([estado, total]) => ({
      estado: estado as EstadoCita,
      total,
    })),
  };
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(date: Date): Date {
  const d = getStartOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}
