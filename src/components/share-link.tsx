"use client";

import { useEffect, useState } from "react";
import { whatsappLink } from "@/lib/format";

export function ShareLink({ slug, salonName }: { slug: string; salonName: string }) {
  const [url, setUrl] = useState(`/${slug}`);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(`${window.location.origin}/${slug}`), [slug]);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-sm font-medium">Link de agendamento do salão</p>
      <code className="break-all rounded bg-neutral-100 px-2 py-1 text-sm dark:bg-neutral-800">
        {url}
      </code>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          {copied ? "Copiado!" : "Copiar link"}
        </button>
        <a
          href={whatsappLink(null, `Agende seu horário no ${salonName} pelo link: ${url}`)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white"
        >
          Enviar no WhatsApp
        </a>
        <a
          href={`/${slug}`}
          target="_blank"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          Ver como cliente
        </a>
      </div>
    </div>
  );
}
