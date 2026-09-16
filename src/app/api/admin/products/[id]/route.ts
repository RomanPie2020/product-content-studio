import { getCurrentUser } from "@/lib/auth/guard";
import { getProductById, updateProductContent } from "@/lib/products/service";
import { jsonError, jsonOk } from "@/lib/http/responses";
import { productContentSchema } from "@/lib/validation/product";
import { formatFieldErrors } from "@/lib/validation/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await getCurrentUser())) {
    return jsonError("Потрібна авторизація", 401);
  }

  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return jsonError("Товар не знайдено", 404);
  }

  return jsonOk(product);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Authorisation first, so an unauthenticated caller learns nothing about the data.
  if (!(await getCurrentUser())) {
    return jsonError("Потрібна авторизація", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некоректний запит", 400);
  }

  // Validation before any write: invalid data must never reach the database.
  const parsed = productContentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Перевірте введені дані", 400, formatFieldErrors(parsed.error));
  }

  const { id } = await params;
  const updated = await updateProductContent(id, parsed.data);

  if (!updated) {
    return jsonError("Товар не знайдено", 404);
  }

  return jsonOk(updated);
}
