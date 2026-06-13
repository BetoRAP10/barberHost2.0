import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getAdminByEmail, getAdminById } from "./db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isSecureCookieEnv,
  verifySessionToken,
} from "./auth-session";

export { SESSION_COOKIE, verifySessionToken } from "./auth-session";

export async function loginAdmin(email: string, password: string): Promise<boolean> {
  const admin = await getAdminByEmail(email);
  if (!admin) {
    await bcrypt.compare(password, "$2b$10$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXX");
    return false;
  }

  const valid = await bcrypt.compare(password, admin.contrasena_hash);
  if (!valid) return false;

  const token = createSessionToken(admin.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureCookieEnv(),
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return true;
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isSecureCookieEnv(),
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}

export async function getAdminSession(): Promise<{ id: number; nombre: string; email: string } | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return null;

  const adminId = verifySessionToken(session.value);
  if (adminId === null) return null;

  const admin = await getAdminById(adminId);
  return admin ?? null;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getAdminSession();
  return !!session;
}
