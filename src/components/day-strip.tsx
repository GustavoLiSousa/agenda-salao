import Link from "next/link";
import { addDays, weekdayOf } from "@/lib/time";

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Faixa de dias para escolher (hoje, amanhã, ...) com a quantidade de horários de cada um. */
export function DayStrip({
  start,
  days = 14,
  selected,
  today,
  counts,
  href,
}: {
  start: string;
  days?: number;
  selected: string;
  today: string;
  counts: Record<string, number>;
  href: (day: string) => string;
}) {
  return (
    <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {Array.from({ length: days }, (_, i) => addDays(start, i)).map((d) => {
        const on = d === selected;
        const n = counts[d] ?? 0;
        const label = d === today ? "Hoje" : d === addDays(today, 1) ? "Amanhã" : WD[weekdayOf(d)];
        return (
          <Link
            key={d}
            href={href(d)}
            replace
            scroll={false}
            aria-current={on ? "date" : undefined}
            className={`flex w-[4.25rem] shrink-0 snap-start flex-col items-center rounded-2xl border px-1 py-2 transition ${
              on
                ? "border-stone-900 bg-stone-900 text-white shadow-lg shadow-stone-900/20 dark:border-brand-300 dark:bg-brand-300 dark:text-stone-950"
                : "border-stone-200 bg-white hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-600"
            }`}
          >
            <span className={`text-[11px] font-medium ${on ? "opacity-80" : "text-stone-500"}`}>{label}</span>
            <span className="font-display text-xl font-semibold leading-tight">{Number(d.slice(8))}</span>
            <span
              className={`mt-0.5 h-4 min-w-4 rounded-full px-1 text-[10px] font-semibold leading-4 ${
                n === 0
                  ? "opacity-0"
                  : on
                    ? "bg-white/20 dark:bg-stone-950/15"
                    : "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
              }`}
            >
              {n}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
