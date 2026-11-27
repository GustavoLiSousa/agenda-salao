export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">Agenda Salão</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Agendamento online para salões, barbearias, manicures e design de
        sobrancelhas. O cliente marca pelo link que o salão envia no
        WhatsApp, direto no navegador do celular, sem baixar nada.
      </p>
      <p className="text-sm text-neutral-500">
        Cada salão tem o seu link, por exemplo <code>/barbearia-do-ze</code>.
      </p>
    </main>
  );
}
