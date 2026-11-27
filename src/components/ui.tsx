import type { ComponentProps } from "react";

export function Field({
  label,
  hint,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-violet-500 dark:border-neutral-700 dark:bg-neutral-900"
        {...props}
      />
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      className={`rounded-lg bg-violet-600 px-4 py-2.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

export function Notice({
  kind = "info",
  children,
}: {
  kind?: "info" | "error";
  children: React.ReactNode;
}) {
  const color =
    kind === "error"
      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      : "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200";
  return <p className={`rounded-lg border p-3 text-sm ${color}`}>{children}</p>;
}
