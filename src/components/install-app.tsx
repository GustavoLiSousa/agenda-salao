"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "agenda_instalar_fechado";

/** Convite para colocar o salão na tela inicial do celular. */
export function InstallApp({ salonName }: { salonName: string }) {
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let closed = false;
    try {
      closed = Number(localStorage.getItem(KEY) ?? 0) > Date.now();
    } catch {}
    if (standalone || closed) return;

    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) setMode("ios");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode === "hidden") return null;

  const close = () => {
    try {
      localStorage.setItem(KEY, String(Date.now() + 14 * 86_400_000));
    } catch {}
    setMode("hidden");
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-900 dark:bg-brand-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Tenha o {salonName} no seu celular</p>
          <p className="text-stone-600 dark:text-stone-400">Agende e veja seus horários com um toque, como um app.</p>
        </div>
        <button onClick={close} aria-label="Fechar" className="-m-1 p-1 text-lg leading-none text-stone-400">
          ×
        </button>
      </div>
      {mode === "android" && event ? (
        <button
          onClick={async () => {
            await event.prompt();
            const choice = await event.userChoice;
            if (choice.outcome === "accepted") setMode("hidden");
          }}
          className="self-start rounded-xl bg-stone-900 px-4 py-2 font-semibold text-white dark:bg-stone-100 dark:text-stone-900"
        >
          Instalar app
        </button>
      ) : help ? (
        <ol className="list-decimal pl-5 text-stone-700 dark:text-stone-300">
          <li>
            Toque em <b>Compartilhar</b> (o quadrado com a seta para cima, embaixo da tela).
          </li>
          <li>
            Escolha <b>Adicionar à Tela de Início</b>.
          </li>
          <li>
            Toque em <b>Adicionar</b>.
          </li>
        </ol>
      ) : (
        <button
          onClick={() => setHelp(true)}
          className="self-start rounded-xl bg-stone-900 px-4 py-2 font-semibold text-white dark:bg-stone-100 dark:text-stone-900"
        >
          Como instalar
        </button>
      )}
    </div>
  );
}
