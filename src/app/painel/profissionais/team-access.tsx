import { Button, Card, GhostButton } from "@/components/ui";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/time";
import { handleJoinRequest, removeAccess, savePermissions } from "./actions";

export type JoinRequest = { id: string; name: string; phone: string | null; email: string | null; created_at: string };

function PermissionBoxes({ checked = [] }: { checked?: string[] }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">O que ele pode fazer além da própria agenda</legend>
      {PERMISSIONS.map((p) => (
        <label key={p.key} className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="perm"
            value={p.key}
            defaultChecked={checked.includes(p.key)}
            className="mt-0.5 h-4 w-4 accent-stone-900 dark:accent-brand-300"
          />
          <span>
            {p.label}
            <span className="block text-xs text-stone-500">{p.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Pedido de alguém que quer entrar na equipe (aparece na Equipe e no Início). */
export function JoinRequestCard({ r, pros, tz }: { r: JoinRequest; pros: { id: string; name: string }[]; tz: string }) {
  return (
    <Card className="flex flex-col gap-4 border-brand-300 dark:border-brand-800">
      <div>
        <p className="font-semibold">{r.name} quer entrar na equipe</p>
        <p className="text-xs text-stone-500">
          {[r.email, r.phone].filter(Boolean).join(" · ")} · pedido em {formatDateTime(r.created_at, tz)}
        </p>
      </div>
      <form action={handleJoinRequest} className="flex flex-col gap-4">
        <input type="hidden" name="request_id" value={r.id} />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Quem é na sua equipe?</span>
          <select
            name="professional_id"
            defaultValue={pros.find((p) => p.name.toLowerCase() === r.name.toLowerCase())?.id ?? ""}
            className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 dark:border-stone-700 dark:bg-stone-900"
          >
            <option value="">Novo profissional: {r.name}</option>
            {pros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (já cadastrado)
              </option>
            ))}
          </select>
        </label>
        <PermissionBoxes />
        <div className="flex flex-wrap gap-2">
          <Button name="accept" value="1">
            Aprovar entrada
          </Button>
          <GhostButton name="accept" value="0" className="text-red-600">
            Recusar
          </GhostButton>
        </div>
      </form>
    </Card>
  );
}

/** Na página do profissional: quem tem acesso e o que pode fazer. */
export function AccessCard({
  proId,
  access,
  tz,
}: {
  proId: string;
  access: { user_id: string; email: string; since: string; permissions: string[] } | null;
  tz: string;
}) {
  return (
    <Card id="acesso" className="flex scroll-mt-20 flex-col gap-3">
      <h2 className="font-display text-lg font-semibold">Acesso ao app</h2>
      {!access ? (
        <p className="text-sm text-stone-500">
          Ainda sem acesso. Peça para ele entrar em <b>Gestão do salão → Criar conta</b> e escolher{" "}
          <b>Trabalho em um salão</b>. O pedido aparece aqui na Equipe para você aprovar.
        </p>
      ) : (
        <>
          <p className="text-sm">
            Entra com <b>{access.email}</b>
            <span className="text-stone-500"> · desde {formatDateTime(access.since, tz)}</span>
          </p>
          <form action={savePermissions} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={proId} />
            <input type="hidden" name="user_id" value={access.user_id} />
            <PermissionBoxes checked={access.permissions} />
            <Button className="self-start">Salvar permissões</Button>
          </form>
          <form action={removeAccess} className="border-t border-stone-100 pt-3 dark:border-stone-800">
            <input type="hidden" name="id" value={proId} />
            <input type="hidden" name="user_id" value={access.user_id} />
            <GhostButton className="text-red-600">Tirar acesso ao app</GhostButton>
          </form>
        </>
      )}
    </Card>
  );
}
