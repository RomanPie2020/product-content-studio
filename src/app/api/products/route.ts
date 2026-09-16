import { listPublishedProducts } from "@/lib/products/service";
import { jsonOk } from "@/lib/http/responses";

export async function GET(): Promise<Response> {
  return jsonOk(await listPublishedProducts());
}
