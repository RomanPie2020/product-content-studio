import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) {
    redirect("/admin/products");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-sm px-4 py-12">
        <h1 className="mb-6 text-2xl font-semibold">Вхід в адмін-панель</h1>
        <LoginForm />
      </main>
    </>
  );
}
