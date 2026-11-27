import type { Metadata } from "next";

// "Meus agendamentos" tem o próprio app instalável: o atalho no celular
// abre direto aqui, e não na página inicial (que é para donos de salão).
export const metadata: Metadata = {
  manifest: "/minha-conta/app.webmanifest",
  appleWebApp: { capable: true, title: "Meus horários", statusBarStyle: "black-translucent" },
  icons: { apple: "/minha-conta/pwa-icon?size=180" },
};

export default function MinhaContaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
