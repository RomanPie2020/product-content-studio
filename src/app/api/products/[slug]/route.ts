import { getPublishedProductBySlug } from "@/lib/products/service";
import { jsonError, jsonOk } from "@/lib/http/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);

  // A draft and a non-existent slug are indistinguishable from outside.
  if (!product) {
    return jsonError("Товар не знайдено", 404);
  }

  return jsonOk(product);
}
