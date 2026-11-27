import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { NewSalonForm } from "./form";

export const metadata = { title: "Cadastrar salão | Agenda Salão" };

export default async function NovoSalaoPage() {
  const { membership } = await requireUser();
  if (membership) redirect("/painel");

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">Cadastre seu salão</h1>
        <p className="text-sm text-neutral-500">
          Leva 1 minuto. Depois você adiciona serviços, profissionais e horários.
        </p>
      </div>
      <NewSalonForm />
    </main>
  );
}
