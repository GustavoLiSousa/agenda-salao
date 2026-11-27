import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 p-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-900 font-display text-xl font-semibold text-brand-300 dark:bg-stone-100 dark:text-brand-700">
        A
      </span>
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
          A agenda do seu salão, no link do WhatsApp.
        </h1>
        <p className="text-lg text-stone-600 dark:text-stone-400">
          Seus clientes escolhem o serviço, o profissional e o horário livre direto do celular, sem baixar nada.
          Você acompanha a agenda, chama de volta quem sumiu e vê o movimento do mês.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/entrar" className="rounded-xl bg-stone-900 px-5 py-3 font-semibold text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900">
          Entrar no painel
        </Link>
        <Link href="/barbearia-do-ze" className="rounded-xl border border-stone-300 px-5 py-3 font-medium transition hover:border-stone-500 dark:border-stone-700">
          Ver um exemplo
        </Link>
      </div>
    </main>
  );
}
