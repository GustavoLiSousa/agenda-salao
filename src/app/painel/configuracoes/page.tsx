import Link from "next/link";
import { ImageInput } from "@/components/image-input";
import { Button, Card, Field, Notice, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/session";
import { saveSettings } from "./actions";

export const metadata = { title: "Ajustes | Agenda Salão" };

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card className="grid gap-4 sm:grid-cols-[220px_1fr] sm:gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {desc && <p className="mt-1 text-sm text-stone-500">{desc}</p>}
      </div>
      <div className="grid content-start gap-3 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const q = await searchParams;
  const { membership } = await requireOwner();
  const s = membership.salon;
  const wa = s.whatsapp?.replace(/^55/, "") ?? "";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <PageHeader title="Ajustes" subtitle={`Seu link: /${s.slug}`} />
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/painel/auditoria"
          className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium dark:border-stone-800 dark:bg-stone-900"
        >
          🔎 Auditoria
          <span className="block text-xs font-normal text-stone-500">Quem fez o quê e quando</span>
        </Link>
        <Link
          href="/painel/avaliacoes"
          className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium dark:border-stone-800 dark:bg-stone-900"
        >
          ⭐ Avaliações
          <span className="block text-xs font-normal text-stone-500">O que os clientes disseram</span>
        </Link>
      </div>
      {q.ok && <Notice kind="success">Ajustes salvos.</Notice>}
      {q.erro && <Notice kind="error">{q.erro}</Notice>}

      <form action={saveSettings} className="flex flex-col gap-4">
        <Section title="Aparência" desc="Capa e logo aparecem na página que o cliente abre.">
          <div className="sm:col-span-2">
            <ImageInput
              name="cover"
              label="Foto de capa"
              current={s.cover_url}
              aspect="aspect-[16/7]"
              removeName="remove_cover"
            />
          </div>
          <div className="w-36">
            <ImageInput name="logo" label="Logo" current={s.logo_url} aspect="aspect-square" removeName="remove_logo" />
          </div>
        </Section>

        <Section title="Dados do salão">
          <Field label="Nome do salão" name="name" defaultValue={s.name} required />
          <Field label="WhatsApp" name="whatsapp" type="tel" defaultValue={wa} placeholder="11 99999-9999" />
          <Field label="Endereço" name="address" defaultValue={s.address ?? ""} />
          <Field label="Instagram" name="instagram" defaultValue={s.instagram ?? ""} placeholder="@seusalao" />
        </Section>

        <Section title="Regras">
          <Field
            label="Cliente desmarca até (horas antes)"
            name="cancel_min_hours"
            type="number"
            min={0}
            max={72}
            defaultValue={s.cancel_min_hours}
          />
          <Field
            label="Cliente sumido após (dias)"
            name="inactive_after_days"
            type="number"
            min={1}
            max={365}
            defaultValue={s.inactive_after_days}
            hint="Quando o cliente e o serviço não têm retorno próprio."
          />
        </Section>

        <Section title="Cartão fidelidade" desc="Deixe vazio para desligar.">
          <Field
            label="A cada quantas visitas"
            name="loyalty_visits"
            type="number"
            min={2}
            max={50}
            defaultValue={s.loyalty_visits ?? ""}
            placeholder="Ex.: 10"
          />
          <Field
            label="Prêmio"
            name="loyalty_reward"
            defaultValue={s.loyalty_reward ?? ""}
            placeholder="Ex.: 1 corte grátis"
          />
        </Section>

        <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
          <Button className="shadow-lg">Salvar ajustes</Button>
        </div>
      </form>
    </main>
  );
}
