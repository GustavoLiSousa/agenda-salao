"use client";

import { useState } from "react";

/** Mostra a arte dos horários livres com botões para baixar e compartilhar. */
export function ShareArt({ src, fileName, caption }: { src: string; fileName: string; caption: string }) {
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
      }
    } catch {
      // compartilhamento cancelado
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-orange-50 p-4 dark:border-fuchsia-900/60 dark:from-fuchsia-950/30 dark:to-orange-950/20">
      <div>
        <p className="font-semibold">Arte para as redes</p>
        <p className="text-xs text-stone-500">Poste no seu status ou Instagram e chame a galera para marcar.</p>
      </div>
      <div className="relative mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-xl bg-stone-200 shadow-lg dark:bg-stone-800">
        {!loaded && (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-stone-500">
            Gerando arte...
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Arte com os horários livres"
          className="relative h-full w-full"
          onLoad={() => setLoaded(true)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={src}
          download={fileName}
          className="rounded-xl border border-stone-300 bg-white py-2.5 text-center text-sm font-semibold dark:border-stone-700 dark:bg-stone-900"
        >
          Baixar arte
        </a>
        <button
          type="button"
          onClick={share}
          disabled={busy}
          className="rounded-xl bg-[linear-gradient(110deg,#c026d3,#f43f5e_60%,#fb923c)] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Abrindo..." : "Compartilhar"}
        </button>
      </div>
    </div>
  );
}
