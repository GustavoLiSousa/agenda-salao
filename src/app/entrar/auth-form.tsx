"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { Input, Message, PasswordInput, goldButton } from "./fields";

type Mode = "entrar" | "criar";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("entrar");

  return (
    <div className="flex flex-col gap-5">
      <div className="relative grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1 text-sm font-medium">
        <span
          aria-hidden
          className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-xl bg-gradient-to-b from-stone-700 to-stone-800 shadow ring-1 ring-white/10 transition-transform duration-300 ${
            mode === "criar" ? "translate-x-full" : ""
          }`}
        />
        {(["entrar", "criar"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`relative z-10 rounded-xl py-2.5 transition-colors ${mode === m ? "text-white" : "text-stone-400 hover:text-stone-200"}`}
          >
            {m === "entrar" ? "Entrar" : "Cadastrar salão"}
          </button>
        ))}
      </div>

      {/* key: cada aba tem seu próprio formulário e estado (mensagens não vazam). */}
      <ModeForm key={mode} mode={mode} />
    </div>
  );
}

function ModeForm({ mode }: { mode: Mode }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "entrar" ? signIn : signUp, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      {mode === "criar" && <Input label="Seu nome" name="name" autoComplete="name" required />}
      <Input label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
      <PasswordInput
        label="Senha"
        name="password"
        minLength={6}
        autoComplete={mode === "entrar" ? "current-password" : "new-password"}
        required
      />
      {state.error && <Message kind="error">{state.error}</Message>}
      {state.message && <Message kind="info">{state.message}</Message>}
      <button disabled={pending} className={goldButton}>
        {pending ? "Aguarde..." : mode === "entrar" ? "Entrar" : "Cadastrar meu salão"}
        {!pending && <span aria-hidden>→</span>}
      </button>
    </form>
  );
}
