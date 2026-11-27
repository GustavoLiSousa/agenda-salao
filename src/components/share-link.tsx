"use client";

import { useEffect, useState } from "react";
import { whatsappLink } from "@/lib/format";

export function ShareLink({ slug, salonName }: { slug: string; salonName: string }) {
  const [url, setUrl] = useState(`/${slug}`);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(`${window.location.origin}/${slug}`), [slug]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-stone-900 p-5 text-stone-100 dark:bg-stone-800">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-brand-300">Seu link de agendamento</p>
        <p className="mt-1 break-all font-mono text-sm text-stone-300">{url.replace(/^https?:\/\//, "")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-100 active:scale-[0.98]"
        >
          {copied ? "Copiado!" : "Copiar link"}
        </button>
        <a
          href={whatsappLink(null, `Agende seu horário no ${salonName} pelo link: ${url}`)}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-[#1f9d55] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#188247] active:scale-[0.98]"
        >
          Enviar no WhatsApp
        </a>
        <a
          href={`/${slug}`}
          target="_blank"
          className="rounded-xl border border-stone-600 px-3.5 py-2 text-sm font-medium text-stone-200 transition hover:bg-stone-800"
        >
          Ver como cliente
        </a>
      </div>
    </div>
  );
}
