// Endereços que o próprio site usa e não podem virar link de salão.
export const RESERVED_SLUGS = [
  "entrar",
  "sair",
  "painel",
  "auth",
  "api",
  "admin",
  "app",
  "manifest.webmanifest",
];

/** "Barbearia do Zé" -> "barbearia-do-ze" */
export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function isValidSlug(slug: string) {
  return (
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) &&
    slug.length >= 3 &&
    !RESERVED_SLUGS.includes(slug)
  );
}
