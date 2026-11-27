"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  agenda: "M7 3v3M17 3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5Z",
  clients: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19v-1a4 4 0 0 0-3-3.87M15.5 3.13a3.5 3.5 0 0 1 0 6.75",
  services: "M6 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm0 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM8 8l12 10M8 16 20 6",
  team: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  box: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z",
  settings: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4",
};

export const NAV = [
  { href: "/painel", label: "Início", icon: I.home },
  { href: "/painel/agenda", label: "Agenda", icon: I.agenda },
  { href: "/painel/clientes", label: "Clientes", icon: I.clients },
  { href: "/painel/servicos", label: "Serviços", icon: I.services, perm: "precos" },
  { href: "/painel/profissionais", label: "Equipe", icon: I.team, ownerOnly: true },
  { href: "/painel/pacotes", label: "Pacotes", icon: I.box, desktopOnly: true, perm: "pacotes" },
  { href: "/painel/avaliacoes", label: "Avaliações", icon: I.star, desktopOnly: true, ownerOnly: true },
  { href: "/painel/configuracoes", label: "Ajustes", icon: I.settings, ownerOnly: true },
];

export type NavAccess = { owner: boolean; perms: string[] };

/** O funcionário vê Início, Agenda, Clientes e o que o dono liberou. */
const visible = ({ owner, perms }: NavAccess) =>
  NAV.filter((n) => owner || ("perm" in n ? perms.includes(n.perm ?? "") : !("ownerOnly" in n)));

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/painel" ? path === "/painel" : path.startsWith(href));
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Abas no topo (computador) */
export function TopNav({ access }: { access: NavAccess }) {
  const active = useActive();
  return (
    <nav className="hidden gap-1 md:flex">
      {visible(access).map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            active(n.href)
              ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
              : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
          }`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

/** Barra de baixo (celular) */
export function BottomNav({ access }: { access: NavAccess }) {
  const active = useActive();
  const items = visible(access).filter((n) => !("desktopOnly" in n));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-stone-800 dark:bg-stone-950/95">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((n) => {
          const on = active(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                on ? "text-stone-900 dark:text-stone-50" : "text-stone-400"
              }`}
            >
              <span className={`rounded-full px-3 py-0.5 ${on ? "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200" : ""}`}>
                <Icon d={n.icon} />
              </span>
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
