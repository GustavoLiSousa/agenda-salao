"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-3 py-2 text-sm font-semibold text-white shadow"
    >
      Salvar PDF
    </button>
  );
}
