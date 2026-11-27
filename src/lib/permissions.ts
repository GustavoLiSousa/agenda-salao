/** O que o dono pode liberar para cada funcionário. O dono sempre pode tudo. */
export const PERMISSIONS = [
  {
    key: "agenda_equipe",
    label: "Ver e mexer na agenda de toda a equipe",
    hint: "Sem isso, ele vê só a própria agenda.",
  },
  { key: "faturamento", label: "Ver valores em R$ do salão", hint: "Faturamento e quanto cada profissional fez." },
  { key: "precos", label: "Alterar serviços e tabela de preços", hint: "Criar, editar e mudar preços dos serviços." },
  { key: "pacotes", label: "Vender pacotes", hint: "Ver a página de pacotes e responder pedidos dos clientes." },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];

export function can(m: { role: string; permissions?: string[] | null } | null | undefined, p: Permission) {
  return !!m && (m.role === "owner" || (m.permissions ?? []).includes(p));
}

export function readPermissions(formData: FormData): Permission[] {
  const keys = PERMISSIONS.map((p) => p.key as string);
  return formData
    .getAll("perm")
    .map(String)
    .filter((k) => keys.includes(k)) as Permission[];
}
