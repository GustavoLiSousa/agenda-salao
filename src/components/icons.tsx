// Ícones de linha usados nos atalhos do salão (agendar, rota, WhatsApp, horários, avaliações).

const P = {
  calendar:
    "M7 3v3M17 3v3M3.5 9.5h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5Zm3 8h3v3H8z",
  route: "M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  whatsapp:
    "M3.5 20.5 5 16a8.5 8.5 0 1 1 3.3 3.2l-4.8 1.3ZM9 8.2c-.3 2.6 2.2 6 5.6 6.7l1.4-1.3-1.9-1-.9.8c-1-.4-2-1.5-2.4-2.5l.8-.9-.9-1.9L9 8.2Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3 2",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5a7.5 7.5 0 0 1 15 0",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4",
  heart: "M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.4 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z",
  box: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8",
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={P[name]} />
    </svg>
  );
}

/** Cor de fundo de cada atalho, para o ícone ficar em destaque. */
export const ICON_TONE: Record<string, string> = {
  calendar: "from-fuchsia-500 to-rose-500",
  route: "from-sky-500 to-indigo-500",
  whatsapp: "from-emerald-500 to-green-600",
  clock: "from-amber-400 to-orange-500",
  star: "from-yellow-400 to-amber-500",
};

/** Botão de atalho com ícone grande em círculo colorido e o nome embaixo. */
export function ShortcutTile({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: IconName;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="group flex flex-col items-center gap-1.5 rounded-2xl border border-stone-200/80 bg-white px-1 py-3 text-center text-xs font-medium shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-md transition group-hover:scale-105 ${ICON_TONE[icon] ?? "from-stone-600 to-stone-800"}`}
      >
        <Icon name={icon} size={22} />
      </span>
      <span className="leading-tight">{label}</span>
    </a>
  );
}
