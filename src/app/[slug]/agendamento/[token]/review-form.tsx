"use client";

import { useActionState, useState } from "react";
import { Button, Notice, inputClass } from "@/components/ui";
import { submitReviewAction, type ReviewState } from "./actions";

function StarPicker({ name, label, value, onChange }: { name: string; label: string; value: number; onChange: (n: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium">{label}</legend>
      <input type="hidden" name={name} value={value || ""} />
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            className={`text-3xl leading-none transition active:scale-90 ${n <= value ? "text-amber-500" : "text-stone-300 dark:text-stone-700"}`}
          >
            ★
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewForm({ slug, token, professionalName, salonName }: { slug: string; token: string; professionalName: string; salonName: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReviewAction, {});
  const [pro, setPro] = useState(0);
  const [salon, setSalon] = useState(0);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="token" value={token} />
      <StarPicker name="professional_rating" label={`Atendimento de ${professionalName}`} value={pro} onChange={setPro} />
      <StarPicker name="salon_rating" label={`${salonName} (local, limpeza, recepção)`} value={salon} onChange={setSalon} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Quer contar como foi? (opcional)</span>
        <textarea name="comment" maxLength={600} rows={3} className={inputClass} />
      </label>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Button disabled={pending || !pro || !salon} className="rounded-2xl py-3.5">
        {pending ? "Enviando..." : "Enviar avaliação"}
      </Button>
    </form>
  );
}
