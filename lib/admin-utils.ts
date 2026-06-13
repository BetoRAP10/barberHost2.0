export function getAdminBase(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? "";
}

export function redirectToAdminLogin(): void {
  window.location.href = `${getAdminBase()}/admin/login/`;
}

/** Redirige al login si la respuesta es 401. Devuelve false si hubo redirección. */
export function handleAdminUnauthorized(res: Response): boolean {
  if (res.status === 401) {
    redirectToAdminLogin();
    return false;
  }
  return true;
}
