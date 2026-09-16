export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function jsonError(
  message: string,
  status: number,
  fieldErrors?: Record<string, string[]>,
): Response {
  return Response.json({ error: { message, fieldErrors: fieldErrors ?? null } }, { status });
}
