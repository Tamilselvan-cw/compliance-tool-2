// src/utils/token.ts
export type Tokens = { access_token: string; refresh_token?: string };

const ACCESS = "access_token";
const REFRESH = "refresh_token";
const USER = "user";

export function saveTokens(t: Tokens) {
  if (t.access_token) localStorage.setItem(ACCESS, t.access_token);
  if (t.refresh_token) localStorage.setItem(REFRESH, t.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  localStorage.removeItem(USER);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH);
}

// very small jwt parser (no verify)
export function getJwtExp(token?: string | null): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1]));
    return typeof payload?.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isExpired(token?: string | null, skewSec = 30): boolean {
  const exp = getJwtExp(token);
  if (!exp) return false; // if unknown, don't block request; let server decide
  const now = Math.floor(Date.now() / 1000);
  return now >= exp - skewSec; // refresh slightly early
}
