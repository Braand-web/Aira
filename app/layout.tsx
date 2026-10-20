import type { Metadata } from "next";
import "./globals.css";
import "./file-upload.css";
import "@/components/file-preview/file-preview.css";
import { FilePreviewProvider } from "@/components/file-preview/file-preview-provider";

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
    <html lang="fr" data-design-system="muse">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased"><FilePreviewProvider>{children}</FilePreviewProvider></body>
    </html>
  );
}
