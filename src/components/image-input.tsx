"use client";

import { useRef, useState } from "react";

/** Reduz a foto no próprio celular (máx. 1600px, JPEG) antes de enviar. */
async function shrink(file: File, max = 1600): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function ImageInput({
  name,
  label,
  current,
  aspect = "aspect-[4/3]",
  removeName,
}: {
  name: string;
  label: string;
  current?: string | null;
  aspect?: string;
  /** nome do checkbox para remover a foto atual */
  removeName?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`relative ${aspect} w-full overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-50 text-sm text-stone-500 transition hover:border-stone-500 dark:border-stone-700 dark:bg-stone-900`}
      >
        {preview && !removed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="m21 16-5-5-9 8" />
            </svg>
            {busy ? "Preparando..." : "Toque para escolher uma foto"}
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          const small = await shrink(f);
          try {
            const dt = new DataTransfer();
            dt.items.add(small);
            e.target.files = dt.files;
          } catch {}
          setPreview(URL.createObjectURL(small));
          setRemoved(false);
          setBusy(false);
        }}
      />
      {removeName && preview && (
        <label className="flex items-center gap-2 text-xs text-stone-500">
          <input type="checkbox" name={removeName} checked={removed} onChange={(e) => setRemoved(e.target.checked)} /> Remover foto
        </label>
      )}
    </div>
  );
}
