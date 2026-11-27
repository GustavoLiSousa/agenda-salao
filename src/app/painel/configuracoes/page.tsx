import { Button, Card, Field, Notice } from "@/components/ui";
import { requireSalon } from "@/lib/session";
import { saveSettings } from "./actions";

export const metadata = { title: "Ajustes | Agenda Salão" };

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const q = await searchParams;
  const { membership } = await requireSalon();
  const s = membership.salon;
  const wa = s.whatsapp?.replace(/^55/, "") ?? "";

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Ajustes do salão</h1>
      {q.ok && <Notice>Ajustes salvos.</Notice>}
      {q.erro && <Notice kind="error">{q.erro}</Notice>}

      <form action={saveSettings} className="flex flex-col gap-4">
        <Card className="grid gap-3 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Dados</h2>
          <Field label="Nome do salão" name="name" defaultValue={s.name} required />
          <Field label="WhatsApp" name="whatsapp" type="tel" defaultValue={wa} placeholder="11 99999-9999" />
          <Field label="Endereço" name="address" defaultValue={s.address ?? ""} />
          <Field label="Instagram" name="instagram" defaultValue={s.instagram ?? ""} placeholder="@seusalao" />
          <p className="text-xs text-neutral-500 sm:col-span-2">Link para clientes: /{s.slug}</p>
        </Card>

        <Card className="grid gap-3 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Regras</h2>
          <Field
            label="Cliente pode desmarcar até (horas antes)"
            name="cancel_min_hours"
            type="number"
            min={0}
            max={72}
            defaultValue={s.cancel_min_hours}
          />
          <Field
            label="Considerar cliente sumido após (dias)"
            name="inactive_after_days"
            type="number"
            min={1}
            max={365}
            defaultValue={s.inactive_after_days}
            hint="Usado quando o cliente não tem frequência própria."
          />
        </Card>

        <Card className="grid gap-3 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Cartão fidelidade</h2>
          <Field
            label="A cada quantas visitas"
            name="loyalty_visits"
            type="number"
            min={2}
            max={50}
            defaultValue={s.loyalty_visits ?? ""}
            placeholder="Ex.: 10 (vazio = desligado)"
          />
          <Field
            label="Prêmio"
            name="loyalty_reward"
            defaultValue={s.loyalty_reward ?? ""}
            placeholder="Ex.: 1 corte grátis"
          />
        </Card>

        <Button className="self-start">Salvar ajustes</Button>
      </form>
    </main>
  );
}
