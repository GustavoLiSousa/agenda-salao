import { redirect } from "next/navigation";
import { safeNext } from "@/lib/client-area";

export const dynamic = "force-dynamic";

// A entrada do cliente fica na tela única de login (aba "Sou cliente").
export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const q = await searchParams;
  const params = new URLSearchParams({ aba: "cliente", next: safeNext(q.next) });
  if (q.erro) params.set("erro", q.erro);
  redirect(`/entrar?${params}`);
}
