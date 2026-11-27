import Link from "next/link";
import { signOut } from "@/app/entrar/actions";
import { BottomNav, TopNav } from "@/components/painel-nav";

export const dynamic = "force-dynamic";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[var(--background)]/90 backdrop-blur dark:border-stone-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/painel" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 font-display text-sm font-semibold text-brand-300 dark:bg-stone-100 dark:text-brand-700">
              A
            </span>
            <span className="font-display text-lg font-semibold">Agenda</span>
          </Link>
          <TopNav />
          <form action={signOut}>
            <button className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">Sair</button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-5">{children}</div>
      <BottomNav />
    </div>
  );
}
