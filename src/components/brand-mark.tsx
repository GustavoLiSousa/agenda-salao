import { useId } from "react";

/**
 * Marca do Agenda Salão: uma tesoura aberta desenhada como a letra "A",
 * dentro de um mostrador de relógio (a agenda) com traço fino dourado.
 */
export function BrandMark({ className = "h-10 w-10", title }: { className?: string; title?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gold = `gold-${id}`;
  const soft = `soft-${id}`;
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gold} x1="12" y1="6" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f6e9c9" />
          <stop offset="0.45" stopColor="#d6b57d" />
          <stop offset="1" stopColor="#97703d" />
        </linearGradient>
        <radialGradient id={soft} cx="32" cy="30" r="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d6b57d" stopOpacity="0.18" />
          <stop offset="1" stopColor="#d6b57d" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* mostrador: anel fino com as marcas das horas */}
      <circle cx="32" cy="32" r="29" fill={`url(#${soft})`} />
      <circle cx="32" cy="32" r="29" fill="none" stroke={`url(#${gold})`} strokeWidth="0.9" opacity="0.75" />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          x1="32"
          y1="5.2"
          x2="32"
          y2={i % 3 === 0 ? 8.6 : 7}
          stroke={`url(#${gold})`}
          strokeWidth={i % 3 === 0 ? 1.3 : 0.8}
          strokeLinecap="round"
          transform={`rotate(${i * 30} 32 32)`}
          opacity={i === 0 ? 0 : 0.85}
        />
      ))}

      {/* lâminas da tesoura formando o "A" */}
      <g fill={`url(#${gold})`}>
        <path d="M32 9.5 L20.4 39.2 L23.4 40.2 Z" />
        <path d="M32 9.5 L43.6 39.2 L40.6 40.2 Z" />
      </g>
      {/* travessa do "A" com o pino da tesoura */}
      <path d="M25.6 28.2 H38.4" stroke={`url(#${gold})`} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="32" cy="28.2" r="2" fill="#0c0a09" stroke={`url(#${gold})`} strokeWidth="1.2" />

      {/* argolas da tesoura */}
      <g fill="none" stroke={`url(#${gold})`} strokeWidth="1.8">
        <ellipse cx="20.2" cy="46" rx="5" ry="4.4" transform="rotate(-18 20.2 46)" />
        <ellipse cx="43.8" cy="46" rx="5" ry="4.4" transform="rotate(18 43.8 46)" />
      </g>
      {/* brilho no topo */}
      <circle cx="32" cy="9.6" r="1.1" fill="#fff7e2" />
    </svg>
  );
}
