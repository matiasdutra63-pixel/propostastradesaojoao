import "./globals.css";
import type { Metadata } from "next";
import ClientShell from "./ClientShell";

export const metadata: Metadata = {
  title: "Plataforma de Propostas",
  description: "Trade Marketing - Farmácias São João",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
