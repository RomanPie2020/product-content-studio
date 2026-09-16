import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getPublishedProductBySlug } from "@/lib/products/service";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);

  if (!product) {
    return { title: "Товар не знайдено" };
  }

  return {
    title: product.seoTitle,
    description: product.seoDescription,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/" className="text-sm text-blue-700 hover:underline">
          ← До каталогу
        </Link>

        <h1 className="mt-4 mb-6 text-2xl font-semibold">{product.name}</h1>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Характеристики</h2>
          <dl className="divide-y divide-gray-200 border-y border-gray-200">
            {product.specs.map((spec) => (
              <div key={spec.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                <dt className="text-gray-600 sm:w-1/3">{spec.label}</dt>
                <dd className="sm:w-2/3">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium">Опис</h2>
          <p className="whitespace-pre-line leading-relaxed">{product.description}</p>
        </section>
      </main>
    </>
  );
}
