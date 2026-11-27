"use client";

import { useActionState, useState } from "react";
import { sendCode, verifyCode, type ClientAuthState } from "@/app/minha-conta/entrar/actions";
import { signIn, signUp, type AuthState } from "./actions";
import { Input, Message, PasswordInput, goldButton } from "./fields";

type Mode = "entrar" | "criar";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("entrar");
  const [recovering, setRecovering] = useState(false);

  if (recovering) return <RecoverPassword onBack={() => setRecovering(false)} />;

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
      {mode === "entrar" && (
        <button
          type="button"
          onClick={() => setRecovering(true)}
          className="-mt-1 text-sm text-stone-400 underline-offset-4 transition hover:text-white hover:underline"
        >
          Esqueci minha senha
        </button>
      )}
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

// Depois do código, a pessoa escolhe uma nova senha e volta para o painel.
const RECOVER_NEXT = "/minha-conta/criar-senha?next=/painel";

function RecoverPassword({ onBack }: { onBack: () => void }) {
  const [sent, send, sending] = useActionState<ClientAuthState, FormData>(sendCode, {});
  const [checked, check, checking] = useActionState<ClientAuthState, FormData>(verifyCode, {});
  const email = checked.sentTo ?? sent.sentTo;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-display text-xl font-semibold text-white">Recuperar senha</p>
        <p className="mt-1 text-sm text-stone-400">
          {email
            ? "Digite o código que enviamos."
            : "Enviamos um código para o seu e-mail. Depois você cria uma senha nova."}
        </p>
      </div>
      {!email ? (
        <form action={send} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={RECOVER_NEXT} />
          <input type="hidden" name="recover" value="1" />
          <Input label="E-mail da conta" name="email" type="email" autoComplete="email" inputMode="email" required />
          {sent.error && <Message kind="error">{sent.error}</Message>}
          <button disabled={sending} className={goldButton}>
            {sending ? "Enviando..." : "Receber código por e-mail"}
          </button>
        </form>
      ) : (
        <form action={check} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={RECOVER_NEXT} />
          <input type="hidden" name="email" value={email} />
          <Message kind="info">
            Enviamos um código para <b>{email}</b>. Digite aqui (ou toque no link do e-mail). Veja também o spam.
          </Message>
          <Input
            label="Código"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            required
            autoFocus
          />
          {checked.error && <Message kind="error">{checked.error}</Message>}
          <button disabled={checking} className={goldButton}>
            {checking ? "Confirmando..." : "Continuar"}
          </button>
        </form>
      )}
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-stone-400 underline-offset-4 transition hover:text-white hover:underline"
      >
        ‹ Voltar para entrar com senha
      </button>
    </div>
  );
}
