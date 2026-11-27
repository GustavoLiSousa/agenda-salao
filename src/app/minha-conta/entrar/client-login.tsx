"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { googleSignIn, passwordSignIn, sendCode, verifyCode, type ClientAuthState } from "./actions";

// O botão do Google só aparece depois que o provedor Google for ativado no Supabase
// (variável NEXT_PUBLIC_GOOGLE_LOGIN=on na Vercel).
const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "on";

export function ClientLogin({ next }: { next: string }) {
  const [mode, setMode] = useState<"senha" | "codigo">("senha");
  const [signed, signIn, signingIn] = useActionState<ClientAuthState, FormData>(passwordSignIn, {});
  const [sent, send, sending] = useActionState<ClientAuthState, FormData>(sendCode, {});
  const [checked, check, checking] = useActionState<ClientAuthState, FormData>(verifyCode, {});
  const email = checked.sentTo ?? sent.sentTo;

  return (
    <div className="flex flex-col gap-5">
      {googleEnabled && (
        <>
          <form action={googleSignIn}>
            <input type="hidden" name="next" value={next} />
            <button className="flex w-full items-center justify-center gap-3 rounded-2xl border border-stone-300 bg-white py-3.5 font-semibold text-stone-800 shadow-sm transition hover:border-stone-500 active:scale-[0.99] dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100">
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
                <path
                  fill="#FFC107"
                  d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
                />
                <path
                  fill="#FF3D00"
                  d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"
                />
              </svg>
              Entrar com Google
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-stone-400">
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
            ou
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          </div>
        </>
      )}

      {mode === "senha" ? (
        <>
          <form action={signIn} className="flex flex-col gap-3">
            <input type="hidden" name="next" value={next} />
            <Field label="Seu e-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
            <Field label="Senha" name="password" type="password" autoComplete="current-password" required />
            {signed.error && <Notice kind="error">{signed.error}</Notice>}
            <Button disabled={signingIn} className="rounded-2xl py-3.5">
              {signingIn ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => setMode("codigo")}
            className="rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-600 transition hover:border-stone-400 hover:text-stone-900 dark:border-stone-800 dark:text-stone-300 dark:hover:text-white"
          >
            <b>Primeiro acesso</b> ou <b>esqueceu a senha</b>?
            <br />
            Entre com um código no seu e-mail
          </button>
        </>
      ) : !email ? (
        <>
          <form action={send} className="flex flex-col gap-3">
            <input type="hidden" name="next" value={next} />
            <Notice>Vamos mandar um código para o seu e-mail. Depois de entrar, você cria sua senha.</Notice>
            <Field label="Seu e-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
            {sent.error && <Notice kind="error">{sent.error}</Notice>}
            <Button disabled={sending} className="rounded-2xl py-3.5">
              {sending ? "Enviando..." : "Receber código por e-mail"}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => setMode("senha")}
            className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline dark:hover:text-white"
          >
            Já tenho senha
          </button>
        </>
      ) : (
        <form action={check} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="email" value={email} />
          <Notice>
            Enviamos um código para <b>{email}</b>. Digite aqui (ou toque no link do e-mail). Veja também o spam.
          </Notice>
          <Field
            label="Código"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            required
            autoFocus
          />
          {checked.error && <Notice kind="error">{checked.error}</Notice>}
          <Button disabled={checking} className="rounded-2xl py-3.5">
            {checking ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      )}
    </div>
  );
}
