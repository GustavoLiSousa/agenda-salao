import Link from "next/link";
import { signOut } from "@/app/entrar/actions";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/painel", label: "Início" },
  { href: "/painel/servicos", label: "Serviços" },
  { href: "/painel/profissionais", label: "Profissionais" },
];

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
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 pb-2 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-full px-3 py-1 whitespace-nowrap text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="mx-auto max-w-3xl p-4">{children}</div>
    </div>
  );
}
