import type { Metadata } from "next";
import "./globals.css";
import "./design-tokens.css";
import "./file-upload.css";
import "@/components/file-preview/file-preview.css";
import { FilePreviewProvider } from "@/components/file-preview/file-preview-provider";
import {AppearanceProvider} from "@/components/appearance-provider";
import {ACCENT_INIT_SCRIPT} from "@/lib/appearance";
import "./appearance.css";

export const metadata: Metadata = {
  title: "Braand — Vos idées, vos prochains clients",
  description: "Votre assistant de création, de pages et de croissance. Un espace pour passer de l’idée à l’action.",
  robots: {index:false,follow:false},
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
    <html lang="fr" data-design-system="muse" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: ACCENT_INIT_SCRIPT}}/>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased"><AppearanceProvider><FilePreviewProvider>{children}</FilePreviewProvider></AppearanceProvider></body>
    </html>
  );
}
