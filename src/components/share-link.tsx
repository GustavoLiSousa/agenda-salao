"use client";

import { useEffect, useState } from "react";
import { whatsappLink } from "@/lib/format";

const ICON = {
  copy: "M9 9h10v11H9zM5 15V4h10",
  check: "M5 12.5 10 17 19 7",
  whats:
    "M4 20l1.3-4A8 8 0 1 1 8.4 19L4 20Zm5-11.5c0 3.5 3 6.5 6.5 6.5l1.5-1.5-2-1-1 1c-1.2-.5-2.5-1.8-3-3l1-1-1-2L9 8.5Z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
};

function Svg({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

/** Link de agendamento do salão com ações de copiar, enviar e ver como cliente. */
export function ShareLink({ slug, salonName }: { slug: string; salonName: string }) {
  const [url, setUrl] = useState(`/${slug}`);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(`${window.location.origin}/${slug}`), [slug]);
  const btn =
    "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-xs font-semibold transition active:scale-[0.97]";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-orange-50 p-4 dark:border-fuchsia-900/60 dark:from-fuchsia-950/40 dark:via-stone-900 dark:to-orange-950/30">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-orange-400 text-lg text-white">
          🔗
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Seu link de agendamento</p>
          <p className="truncate font-mono text-xs text-stone-500">{url.replace(/^https?:\/\//, "")}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className={`${btn} bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900`}
        >
          <Svg d={copied ? ICON.check : ICON.copy} />
          {copied ? "Copiado!" : "Copiar"}
        </button>
        <a
          href={whatsappLink(null, `Agende seu horário no ${salonName} pelo link: ${url}`)}
          target="_blank"
          rel="noreferrer"
          className={`${btn} bg-[#1f9d55] text-white hover:bg-[#188247]`}
        >
          <Svg d={ICON.whats} />
          WhatsApp
        </a>
        <a
          href={`/${slug}`}
          target="_blank"
          className={`${btn} border border-stone-300 bg-white text-stone-800 hover:border-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100`}
        >
          <Svg d={ICON.eye} />
          Ver página
        </a>
      </div>
    </div>
  );
}
