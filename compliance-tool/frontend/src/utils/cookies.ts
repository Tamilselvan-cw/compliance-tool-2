// src/utils/cookies.ts
export function setCookie(name: string, value: string, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  // SameSite=Lax prevents most CSRF; add Secure on HTTPS
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
  const n = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split("; ");
  for (const p of parts) {
    if (p.indexOf(n) === 0) return decodeURIComponent(p.substring(n.length));
  }
  return null;
}

export function deleteCookie(name: string) {
  document.cookie = `${encodeURIComponent(name)}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`;
}
