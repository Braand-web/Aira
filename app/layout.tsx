import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aïra — Vos idées, vos prochains clients",
  description: "Votre assistant de création, de pages et de croissance. Un espace pour passer de l’idée à l’action.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
