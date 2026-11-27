"use client";

import { useState } from "react";

// Campos do login (fundo escuro), usados nas abas Cliente e Gestão.
const input =
  "peer w-full rounded-xl border border-white/10 bg-black/30 px-4 pb-2 pt-6 text-base text-white outline-none transition placeholder:text-transparent focus:border-brand-300/70 focus:bg-black/40 focus:ring-4 focus:ring-brand-300/10";
const floating =
  "pointer-events-none absolute left-4 top-4 origin-left text-sm text-stone-400 transition-all peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-brand-300 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px]";

export const goldButton =
  "mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-200 to-brand-400 px-5 py-3.5 font-semibold text-stone-950 shadow-[0_8px_30px_-8px_rgba(214,181,125,0.6)] transition hover:from-brand-100 hover:to-brand-300 active:scale-[0.98] disabled:opacity-60";

export function Input({ label, ...props }: React.ComponentProps<"input"> & { label: string }) {
  return (
    <label className="relative block">
      <input className={input} placeholder={label} {...props} />
      <span className={floating}>{label}</span>
    </label>
  );
}

export function PasswordInput({ label, ...props }: React.ComponentProps<"input"> & { label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <label className="relative block">
        <input className={`${input} pr-16`} placeholder={label} type={show ? "text" : "password"} {...props} />
        <span className={floating}>{label}</span>
      </label>
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-stone-400 hover:text-white"
      >
        {show ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}

export function Message({ kind, children }: { kind: "error" | "info" | "success"; children: React.ReactNode }) {
  const color =
    kind === "error"
      ? "border-red-400/30 bg-red-500/10 text-red-200"
      : kind === "success"
        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
        : "border-brand-300/30 bg-brand-300/10 text-brand-100";
  return <p className={`rounded-xl border px-3.5 py-2.5 text-sm ${color}`}>{children}</p>;
}
