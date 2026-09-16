import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { getCurrentUser } from "@/lib/auth/guard";
import { listAllProducts } from "@/lib/products/service";
import { LogoutButton } from "../logout-button";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin/login");
  }

  const products = await listAllProducts();

  return (
    <>
      <SiteHeader>
        <span className="text-gray-600">{user.email}</span>
        <LogoutButton />
      </SiteHeader>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Товари</h1>

        <ul className="space-y-3">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <span className="font-medium">{product.name}</span>
                <StatusBadge status={product.status} />
              </div>

              <Link
                href={`/admin/products/${product.id}`}
                className="text-sm text-blue-700 hover:underline"
              >
                Редагувати
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
