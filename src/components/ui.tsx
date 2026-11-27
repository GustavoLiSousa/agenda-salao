import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300";

export function Field({
  label,
  hint,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>
      <input className={inputClass} {...props} />
      {hint && <span className="text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}: ComponentProps<"select"> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>
      <select className={inputClass} {...props}>
        {children}
      </select>
    </label>
  );
}

const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-stone-800 active:scale-[0.98] disabled:opacity-60 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-800 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98] dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800";

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return <button className={`${primary} ${className}`} {...props} />;
}

export function GhostButton({ className = "", ...props }: ComponentProps<"button">) {
  return <button className={`${secondary} ${className}`} {...props} />;
}

/** Link com cara de botão. variant: primary | secondary | whatsapp */
export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" | "whatsapp" }) {
  const v =
    variant === "primary"
      ? primary
      : variant === "whatsapp"
        ? "inline-flex items-center justify-center gap-2 rounded-xl bg-[#1f9d55] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#188247] active:scale-[0.98]"
        : secondary;
  return <Link className={`${v} ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return (
    <section
      className={`rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] dark:border-stone-800 dark:bg-stone-900 ${
        /(^|\s)p-0(\s|$)/.test(className) ? "" : "p-4 sm:p-5"
      } ${className}`}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {back && (
        <Link href={back.href} className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
          ‹ {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {title ? <h1 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-50">{title}</h1> : null}
          {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-stone-900 dark:text-stone-50">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export function Badge({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

/** Círculo com as iniciais (cliente/profissional sem foto) */
export function Avatar({ name, src, size = 40 }: { name: string | null; src?: string | null; size?: number }) {
  const initials =
    (name ?? "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name ?? ""} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

export function Notice({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const color =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      : kind === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        : "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-200";
  return <p className={`rounded-xl border px-4 py-3 text-sm ${color}`}>{children}</p>;
}
