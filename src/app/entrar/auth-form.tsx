"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { signIn, signUp, type AuthState } from "./actions";

type Mode = "entrar" | "criar";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("entrar");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 rounded-xl bg-stone-200/70 p-1 text-sm font-medium dark:bg-stone-800">
        {(["entrar", "criar"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 transition ${mode === m ? "bg-white shadow-sm dark:bg-stone-950" : "text-stone-500"}`}
          >
            {m === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      {/* key: cada aba tem seu próprio formulário e estado (mensagens não vazam). */}
      <ModeForm key={mode} mode={mode} />
    </div>
  );
}

function ModeForm({ mode }: { mode: Mode }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "entrar" ? signIn : signUp,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      {mode === "criar" && (
        <Field label="Seu nome" name="name" autoComplete="name" required />
      )}
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        minLength={6}
        autoComplete={mode === "entrar" ? "current-password" : "new-password"}
        required
      />
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.message && <Notice>{state.message}</Notice>}
      <Button disabled={pending}>
        {pending ? "Aguarde..." : mode === "entrar" ? "Entrar" : "Criar conta"}
      </Button>
    </form>
  );
}
