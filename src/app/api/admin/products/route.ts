import { getCurrentUser } from "@/lib/auth/guard";
import { listAllProducts } from "@/lib/products/service";
import { jsonError, jsonOk } from "@/lib/http/responses";

export async function GET(): Promise<Response> {
  if (!(await getCurrentUser())) {
    return jsonError("Потрібна авторизація", 401);
  }

  return jsonOk(await listAllProducts());
}
