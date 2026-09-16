import { cookies } from "next/headers";
import { SESSION_COOKIE, revokeSession } from "@/lib/auth/session";
import { clearSessionCookie } from "@/lib/auth/guard";
import { jsonOk } from "@/lib/http/responses";

export async function POST(): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await revokeSession(token);
  }

  await clearSessionCookie();
  return jsonOk({ ok: true });
}
