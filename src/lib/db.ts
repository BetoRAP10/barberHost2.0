import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import {
  HORARIO_APERTURA,
  HORARIO_CIERRE,
  INTERVALO_MINUTOS,
} from "./types";
import type {
  CitaConDetalles,
  Cliente,
  ClienteConHistorial,
  DashboardStats,
  DiaBloqueado,
  EstadoCita,
  Servicio,
} from "./types";
import { format } from "date-fns";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "barber.db");

let db: DatabaseSync | null = null;

function row<T>(value: unknown): T {
  return value as T;
}

function getDb(): DatabaseSync {
  if (db) return db;

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");

  const schemaPath = path.join(process.cwd(), "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  seedDatabase(db);
  return db;
}

function seedDatabase(database: DatabaseSync) {
  const adminCount = database
    .prepare("SELECT COUNT(*) as count FROM usuarios_admin")
    .get() as { count: number };

  if (adminCount.count === 0) {
    const hash = bcrypt.hashSync("admin123", 10);
    database
      .prepare(
        "INSERT INTO usuarios_admin (nombre, email, contrasena_hash) VALUES (?, ?, ?)"
      )
      .run("Administrador", "admin@barberhost.com", hash);
  }

  const serviciosCount = database
    .prepare("SELECT COUNT(*) as count FROM servicios")
    .get() as { count: number };

  if (serviciosCount.count === 0) {
    const servicios = [
      ["Corte Clásico", "Corte tradicional con acabado profesional y peinado.", 30, 18, "Corte"],
      ["Corte + Barba", "Servicio completo de corte y arreglo de barba.", 45, 28, "Combo"],
      ["Arreglo de Barba", "Perfilado y cuidado de barba con productos premium.", 20, 12, "Barba"],
      ["Tratamiento Capilar", "Hidratación profunda y masaje capilar relajante.", 40, 25, "Tratamiento"],
      ["Afeitado Clásico", "Afeitado tradicional con toalla caliente y bálsamo.", 35, 22, "Barba"],
      ["Corte Infantil", "Corte especial para niños con ambiente amigable.", 25, 15, "Corte"],
    ];

    const stmt = database.prepare(
      "INSERT INTO servicios (nombre, descripcion, duracion_minutos, precio, categoria) VALUES (?, ?, ?, ?, ?)"
    );

    for (const s of servicios) {
      stmt.run(...s);
    }
  }
}

export function getServicios(activosOnly = false): Servicio[] {
  const database = getDb();
  const query = activosOnly
    ? "SELECT * FROM servicios WHERE activo = 1 ORDER BY categoria, nombre"
    : "SELECT * FROM servicios ORDER BY categoria, nombre";
  return row<Servicio[]>(database.prepare(query).all());
}

export function getServicioById(id: number): Servicio | undefined {
  const database = getDb();
  return row<Servicio | undefined>(database.prepare("SELECT * FROM servicios WHERE id = ?").get(id));
}

export function createServicio(data: Omit<Servicio, "id" | "creado_en" | "activo">) {
  const database = getDb();
  const result = database
    .prepare(
      "INSERT INTO servicios (nombre, descripcion, duracion_minutos, precio, categoria) VALUES (?, ?, ?, ?, ?)"
    )
    .run(data.nombre, data.descripcion, data.duracion_minutos, data.precio, data.categoria);
  return Number(result.lastInsertRowid);
}

export function updateServicio(
  id: number,
  data: Partial<Omit<Servicio, "id" | "creado_en">>
) {
  const database = getDb();
  const current = getServicioById(id);
  if (!current) return false;

  database
    .prepare(
      `UPDATE servicios SET nombre = ?, descripcion = ?, duracion_minutos = ?, precio = ?, categoria = ?, activo = ? WHERE id = ?`
    )
    .run(
      data.nombre ?? current.nombre,
      data.descripcion ?? current.descripcion,
      data.duracion_minutos ?? current.duracion_minutos,
      data.precio ?? current.precio,
      data.categoria ?? current.categoria,
      data.activo ?? current.activo,
      id
    );
  return true;
}

export function deleteServicio(id: number) {
  const database = getDb();
  database.prepare("DELETE FROM servicios WHERE id = ?").run(id);
}

export function getOrCreateCliente(nombre: string, email: string, telefono: string): number {
  const database = getDb();
  const existing = database
    .prepare("SELECT id FROM clientes WHERE email = ?")
    .get(email.toLowerCase()) as { id: number } | undefined;

  if (existing) {
    database
      .prepare("UPDATE clientes SET nombre = ?, telefono = ? WHERE id = ?")
      .run(nombre, telefono, existing.id);
    return existing.id;
  }

  const result = database
    .prepare("INSERT INTO clientes (nombre, email, telefono) VALUES (?, ?, ?)")
    .run(nombre, email.toLowerCase(), telefono);
  return Number(result.lastInsertRowid);
}

export function getCitas(filters?: {
  estado?: EstadoCita;
  servicio_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
}): CitaConDetalles[] {
  const database = getDb();
  let query = `
    SELECT c.*, s.nombre as servicio_nombre, s.precio as servicio_precio,
           s.duracion_minutos as servicio_duracion, s.categoria as servicio_categoria,
           cl.nombre as cliente_nombre, cl.email as cliente_email, cl.telefono as cliente_telefono
    FROM citas c
    JOIN servicios s ON c.servicio_id = s.id
    JOIN clientes cl ON c.cliente_id = cl.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (filters?.estado) {
    query += " AND c.estado = ?";
    params.push(filters.estado);
  }
  if (filters?.servicio_id) {
    query += " AND c.servicio_id = ?";
    params.push(filters.servicio_id);
  }
  if (filters?.fecha_desde) {
    query += " AND date(c.fecha_hora) >= date(?)";
    params.push(filters.fecha_desde);
  }
  if (filters?.fecha_hasta) {
    query += " AND date(c.fecha_hora) <= date(?)";
    params.push(filters.fecha_hasta);
  }

  query += " ORDER BY c.fecha_hora ASC";
  return row<CitaConDetalles[]>(database.prepare(query).all(...params));
}

export function getCitaById(id: number): CitaConDetalles | undefined {
  const citas = getCitas();
  return citas.find((c) => c.id === id);
}

export function getCitasByEmail(email: string): CitaConDetalles[] {
  const database = getDb();
  return row<CitaConDetalles[]>(
    database
      .prepare(
        `SELECT c.*, s.nombre as servicio_nombre, s.precio as servicio_precio,
                s.duracion_minutos as servicio_duracion, s.categoria as servicio_categoria,
                cl.nombre as cliente_nombre, cl.email as cliente_email, cl.telefono as cliente_telefono
         FROM citas c
         JOIN servicios s ON c.servicio_id = s.id
         JOIN clientes cl ON c.cliente_id = cl.id
         WHERE cl.email = ?
         ORDER BY c.fecha_hora DESC`
      )
      .all(email.toLowerCase())
  );
}

export function createCita(data: {
  servicio_id: number;
  cliente_id: number;
  fecha_hora: string;
  notas?: string;
}) {
  const database = getDb();
  const result = database
    .prepare(
      "INSERT INTO citas (servicio_id, cliente_id, fecha_hora, estado, notas) VALUES (?, ?, ?, 'confirmada', ?)"
    )
    .run(data.servicio_id, data.cliente_id, data.fecha_hora, data.notas ?? "");
  return Number(result.lastInsertRowid);
}

export function updateCitaEstado(id: number, estado: EstadoCita) {
  const database = getDb();
  database
    .prepare(
      "UPDATE citas SET estado = ?, actualizado_en = datetime('now') WHERE id = ?"
    )
    .run(estado, id);
}

export function reprogramarCita(id: number, fecha_hora: string) {
  const database = getDb();
  database
    .prepare(
      "UPDATE citas SET fecha_hora = ?, estado = 'confirmada', actualizado_en = datetime('now') WHERE id = ?"
    )
    .run(fecha_hora, id);
}

export function getDiasBloqueados(): DiaBloqueado[] {
  const database = getDb();
  return row<DiaBloqueado[]>(database.prepare("SELECT * FROM dias_bloqueados ORDER BY fecha ASC").all());
}

export function createDiaBloqueado(data: {
  fecha: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  motivo: string;
}) {
  const database = getDb();
  const result = database
    .prepare(
      "INSERT INTO dias_bloqueados (fecha, hora_inicio, hora_fin, motivo) VALUES (?, ?, ?, ?)"
    )
    .run(data.fecha, data.hora_inicio ?? null, data.hora_fin ?? null, data.motivo);
  return Number(result.lastInsertRowid);
}

export function deleteDiaBloqueado(id: number) {
  const database = getDb();
  database.prepare("DELETE FROM dias_bloqueados WHERE id = ?").run(id);
}

export function getClientes(search?: string): Cliente[] {
  const database = getDb();
  if (search) {
    const term = `%${search}%`;
    return row<Cliente[]>(
      database
        .prepare("SELECT * FROM clientes WHERE nombre LIKE ? OR email LIKE ? ORDER BY nombre")
        .all(term, term)
    );
  }
  return row<Cliente[]>(database.prepare("SELECT * FROM clientes ORDER BY nombre").all());
}

export function getClientesConHistorial(search?: string): ClienteConHistorial[] {
  const clientes = getClientes(search);
  return clientes.map((cliente) => {
    const citas = getCitas().filter((c) => c.cliente_id === cliente.id);
    return {
      ...cliente,
      total_citas: citas.length,
      citas,
    };
  });
}

export function getAdminById(id: number) {
  const database = getDb();
  return row<{ id: number; nombre: string; email: string } | undefined>(
    database.prepare("SELECT id, nombre, email FROM usuarios_admin WHERE id = ?").get(id)
  );
}

export function getAdminByEmail(email: string) {
  const database = getDb();
  return database
    .prepare("SELECT * FROM usuarios_admin WHERE email = ?")
    .get(email.toLowerCase()) as
    | { id: number; nombre: string; email: string; contrasena_hash: string }
    | undefined;
}

export function getDashboardStats(): DashboardStats {
  const database = getDb();
  const today = new Date().toISOString().split("T")[0];

  const citasHoy = database
    .prepare(
      `SELECT COUNT(*) as count FROM citas WHERE date(fecha_hora) = date(?) AND estado != 'cancelada'`
    )
    .get(today) as { count: number };

  const startOfWeek = getStartOfWeek(new Date()).toISOString().split("T")[0];
  const endOfWeek = getEndOfWeek(new Date()).toISOString().split("T")[0];

  const citasSemana = database
    .prepare(
      `SELECT COUNT(*) as count FROM citas WHERE date(fecha_hora) BETWEEN date(?) AND date(?) AND estado != 'cancelada'`
    )
    .get(startOfWeek, endOfWeek) as { count: number };

  const ingresos = database
    .prepare(
      `SELECT COALESCE(SUM(s.precio), 0) as total
       FROM citas c JOIN servicios s ON c.servicio_id = s.id
       WHERE date(c.fecha_hora) BETWEEN date(?) AND date(?)
       AND c.estado IN ('confirmada', 'completada')`
    )
    .get(startOfWeek, endOfWeek) as { total: number };

  const proximas = getCitas({ fecha_desde: today }).filter(
    (c) => c.estado !== "cancelada" && new Date(c.fecha_hora) >= new Date()
  ).slice(0, 5);

  const estados = database
    .prepare(
      `SELECT estado, COUNT(*) as total FROM citas GROUP BY estado`
    )
    .all() as { estado: EstadoCita; total: number }[];

  return {
    citas_hoy: citasHoy.count,
    citas_semana: citasSemana.count,
    ingresos_semana: ingresos.total,
    proximas_citas: proximas,
    estados_distribucion: estados,
  };
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function isSlotAvailable(
  fecha: string,
  hora: string,
  duracionMinutos: number,
  excludeCitaId?: number
): boolean {
  const database = getDb();
  const bloqueos = row<DiaBloqueado[]>(database.prepare("SELECT * FROM dias_bloqueados WHERE fecha = ?").all(fecha));

  for (const bloqueo of bloqueos) {
    if (!bloqueo.hora_inicio && !bloqueo.hora_fin) return false;
    if (bloqueo.hora_inicio && bloqueo.hora_fin) {
      if (hora >= bloqueo.hora_inicio && hora < bloqueo.hora_fin) return false;
    }
  }

  const slotStart = new Date(`${fecha}T${hora}:00`);
  const slotEnd = new Date(slotStart.getTime() + duracionMinutos * 60000);

  const citas = row<{ fecha_hora: string; duracion_minutos: number }[]>(
    database
      .prepare(
        `SELECT c.fecha_hora, s.duracion_minutos FROM citas c
       JOIN servicios s ON c.servicio_id = s.id
       WHERE date(c.fecha_hora) = date(?) AND c.estado != 'cancelada'
       ${excludeCitaId ? "AND c.id != ?" : ""}`
      )
      .all(...(excludeCitaId ? [fecha, excludeCitaId] : [fecha]))
  );

  for (const cita of citas) {
    const citaStart = new Date(cita.fecha_hora);
    const citaEnd = new Date(citaStart.getTime() + cita.duracion_minutos * 60000);
    if (slotStart < citaEnd && slotEnd > citaStart) return false;
  }

  return true;
}

export function getAvailableDays(
  year: number,
  month: number,
  duracionMinutos: number
): string[] {
  const days: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date < today) continue;
    if (date.getDay() === 0) continue;

    const fecha = format(date, "yyyy-MM-dd");
    const slots = getAvailableSlots(fecha, duracionMinutos);
    if (slots.length > 0) days.push(fecha);
  }

  return days;
}

export function getAvailableSlots(fecha: string, duracionMinutos: number, excludeCitaId?: number): string[] {
  const slots: string[] = [];

  for (let h = HORARIO_APERTURA; h < HORARIO_CIERRE; h++) {
    for (let m = 0; m < 60; m += INTERVALO_MINUTOS) {
      const hora = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const endMinutes = h * 60 + m + duracionMinutos;
      if (endMinutes > HORARIO_CIERRE * 60) continue;

      if (isSlotAvailable(fecha, hora, duracionMinutos, excludeCitaId)) {
        slots.push(hora);
      }
    }
  }

  return slots;
}
