import Link from "next/link";
import { signOut } from "@/app/entrar/actions";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/painel" className="font-bold">
            Agenda Salão
          </Link>
          <form action={signOut}>
            <button className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
              Sair
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-3xl p-4">{children}</div>
    </div>
  );
}
