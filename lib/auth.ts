import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getAdminByEmail, getAdminById } from "./db";

const SESSION_COOKIE = "barber_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24;

export async function loginAdmin(email: string, password: string): Promise<boolean> {
  const admin = await getAdminByEmail(email);
  if (!admin) return false;

  const valid = bcrypt.compareSync(password, admin.contrasena_hash);
  if (!valid) return false;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, String(admin.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return true;
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getAdminSession(): Promise<{ id: number; nombre: string; email: string } | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return null;

  const admin = await getAdminById(Number(session.value));
  if (!admin) return null;

  return admin;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getAdminSession();
  return !!session;
}
