import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/guard";
import { jsonError, jsonOk } from "@/lib/http/responses";
import { formatFieldErrors } from "@/lib/validation/errors";
import { loginSchema } from "@/lib/validation/auth";

const INVALID_CREDENTIALS = "Невірна пошта або пароль";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некоректний запит", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Перевірте введені дані", 400, formatFieldErrors(parsed.error));
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return jsonError(INVALID_CREDENTIALS, 401);
  }

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  return jsonOk({ email: user.email });
}
