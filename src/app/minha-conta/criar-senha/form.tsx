"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { createPassword, type ClientAuthState } from "../entrar/actions";

export function CreatePasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ClientAuthState, FormData>(createPassword, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <Field
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={6}
        required
        autoFocus
        hint="Pelo menos 6 letras ou números."
      />
      <Field label="Repita a senha" name="confirm" type="password" autoComplete="new-password" minLength={6} required />
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Button disabled={pending} className="rounded-2xl py-3.5">
        {pending ? "Salvando..." : "Salvar senha e continuar"}
      </Button>
    </form>
  );
}
