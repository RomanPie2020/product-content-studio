import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { listPublishedProducts } from "@/lib/products/service";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const products = await listPublishedProducts();

  return (
    <>
      <SiteHeader>
        <Link href="/admin/products" className="text-blue-700 hover:underline">
          Адмін-панель
        </Link>
      </SiteHeader>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Каталог товарів</h1>

        {products.length === 0 ? (
          <p className="text-gray-600">Наразі немає опублікованих товарів.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <li key={product.id} className="rounded-lg border border-gray-200 p-4">
                <h2 className="mb-2 font-medium">{product.name}</h2>
                <Link
                  href={`/products/${product.slug}`}
                  className="text-sm text-blue-700 hover:underline"
                >
                  Переглянути картку
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
