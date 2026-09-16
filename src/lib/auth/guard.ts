import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_MS, validateSession } from "@/lib/auth/session";

export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return validateSession(token);
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
