import type { SupabaseClient } from "@supabase/supabase-js";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Envia uma imagem para o bucket "imagens" na pasta do salão e devolve a URL pública.
 * Retorna null se não veio arquivo. Lança erro com mensagem amigável.
 */
export async function uploadImage(
  supabase: SupabaseClient,
  salonId: string,
  file: FormDataEntryValue | null,
  folder: string,
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Use uma foto JPG, PNG ou WEBP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A foto é muito grande (máximo 5 MB).");
  const path = `${salonId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("imagens").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Não foi possível enviar a foto: ${error.message}`);
  return supabase.storage.from("imagens").getPublicUrl(path).data.publicUrl;
}
