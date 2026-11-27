"use client";

import { useActionState, useState } from "react";
import { requestPackage, type RequestState } from "./actions";

/** "Quero este pacote": envia o pedido; o salão confirma a venda no painel. */
export function PackageRequestButton({ packageId, name, phone }: { packageId: string; name: string; phone: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<RequestState, FormData>(requestPackage, {});

  if (state.done)
    return (
      <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        Pedido enviado! O salão vai confirmar com você e o pacote aparece em “Meus pacotes”.
      </p>
    );

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
      >
        Quero este pacote
      </button>
    );

  const input =
    "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-stone-900 dark:border-stone-700 dark:bg-stone-900";
  return (
    <form action={action} className="flex w-full flex-col gap-2">
      <input type="hidden" name="package_id" value={packageId} />
      <input name="name" defaultValue={name} placeholder="Seu nome" required className={input} autoComplete="name" />
      <input
        name="phone"
        defaultValue={phone}
        placeholder="Seu WhatsApp (DDD + número)"
        required
        type="tel"
        inputMode="tel"
        className={input}
        autoComplete="tel"
      />
      {state.error && <p className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      <p className="text-xs text-stone-500">
        O pagamento é combinado com o salão. Depois que ele confirmar, o saldo aparece aqui.
      </p>
      <button
        disabled={pending}
        className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-stone-100 dark:text-stone-900"
      >
        {pending ? "Enviando..." : "Enviar pedido"}
      </button>
    </form>
  );
}
