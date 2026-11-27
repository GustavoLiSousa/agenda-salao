import Link from "next/link";
import { signOut } from "@/app/entrar/actions";
import { BrandMark } from "@/components/brand-mark";
import { BottomNav, TopNav } from "@/components/painel-nav";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { membership } = await requireUser();
  const access = { owner: membership?.role !== "professional", perms: membership?.permissions ?? [] };
  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[var(--background)]/90 backdrop-blur dark:border-stone-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/painel" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-950 ring-1 ring-brand-300/30">
              <BrandMark className="h-8 w-8" />
            </span>
            <span className="font-display text-lg font-semibold">Agenda Salão</span>
          </Link>
          <TopNav access={access} />
          <form action={signOut}>
            <button className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">Sair</button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-5">{children}</div>
      <BottomNav access={access} />
    </div>
  );
}
