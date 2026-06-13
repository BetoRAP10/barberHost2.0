"use client";

// Module-level code runs when the browser first loads this bundle — before
// any component's useEffect fires. This ensures every fetch("/api/...") call
// gets the basePath prefix so nginx can route it correctly.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
if (
  typeof window !== "undefined" &&
  BASE &&
  !(globalThis as Record<string, unknown>).__apiFetchPatched
) {
  const orig = globalThis.fetch.bind(globalThis);
  globalThis.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    if (typeof input === "string" && input.startsWith("/api/")) {
      input = BASE + input;
    }
    return orig(input, init);
  };
  (globalThis as Record<string, unknown>).__apiFetchPatched = true;
}

export function ApiPatch() {
  return null;
}
