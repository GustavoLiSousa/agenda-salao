"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { slugify } from "@/lib/slug";
import { createSalon, type NewSalonState } from "./actions";

export function NewSalonForm() {
  const [state, action, pending] = useActionState<NewSalonState, FormData>(createSalon, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="Código de convite"
        name="code"
        placeholder="EX.: K7M2Q9XA"
        autoCapitalize="characters"
        autoComplete="off"
        hint="Recebeu o código da equipe do Agenda Salão? Digite aqui para liberar o cadastro do seu salão."
        required
      />
      <Field
        label="Nome do salão"
        name="name"
        placeholder="Barbearia do Zé"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugEdited) setSlug(slugify(e.target.value));
        }}
        required
      />
      <Field
        label="Link para os clientes"
        name="slug"
        value={slug}
        onChange={(e) => {
          setSlugEdited(true);
          setSlug(slugify(e.target.value));
        }}
        hint={`Seus clientes vão agendar em: ${host}/${slug || "seu-salao"}`}
        required
      />
      <Field
        label="WhatsApp do salão"
        name="whatsapp"
        type="tel"
        inputMode="tel"
        placeholder="11 99999-9999"
        hint="Usado nos botões de WhatsApp para os clientes falarem com você."
      />
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Button disabled={pending}>{pending ? "Criando..." : "Criar meu salão"}</Button>
    </form>
  );
}
