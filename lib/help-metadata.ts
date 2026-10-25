import type { Metadata } from "next";
import { SITE_ORIGIN } from "./legal-policy.mjs";

export function helpPageMetadata(path: string, title: string, description: string): Metadata {
  const url = SITE_ORIGIN + path;
  return {
    title: { absolute: title === "Centre d’aide Braand" ? title : `${title} | Centre d’aide Braand` },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: "Braand",
      url,
      title,
      description,
    },
    twitter: { card: "summary", title, description },
  };
}
