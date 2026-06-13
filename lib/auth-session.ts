import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "barber_admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 24; // 24 h

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET es obligatorio en producción. Genera uno con: openssl rand -hex 32"
    );
  }

  console.warn("[auth] SESSION_SECRET no configurado — usando fallback solo para desarrollo");
  return "dev-only-fallback-no-usar-en-produccion";
}

export function createSessionToken(adminId: number): string {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${adminId}|${expires}`;
  const sig = createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

export function verifySessionToken(token: string): number | null {
  try {
    const parts = token.split("|");
    if (parts.length !== 3) return null;

    const [adminIdStr, expiresStr, sig] = parts;
    const payload = `${adminIdStr}|${expiresStr}`;

    const expected = createHmac("sha256", getSessionSecret()).update(payload).digest("hex");

    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    if (Date.now() > Number(expiresStr)) return null;

    const id = Number(adminIdStr);
    return Number.isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

export function isSecureCookieEnv(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  const url = process.env.NEXT_PUBLIC_URL ?? "";
  return url.startsWith("https://");
}
