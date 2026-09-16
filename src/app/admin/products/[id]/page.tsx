import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth/guard";
import { getProductById } from "@/lib/products/service";
import { LogoutButton } from "../../logout-button";
import { EditorForm } from "./editor-form";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <>
      <SiteHeader>
        <span className="text-gray-600">{user.email}</span>
        <LogoutButton />
      </SiteHeader>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/admin/products" className="text-sm text-blue-700 hover:underline">
          ← До списку товарів
        </Link>

        <h1 className="mt-4 mb-2 text-2xl font-semibold">{product.name}</h1>
        <p className="mb-6 text-sm text-gray-600">Назву та характеристики змінювати не можна.</p>

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

        <EditorForm product={product} />
      </main>
    </>
  );
}
