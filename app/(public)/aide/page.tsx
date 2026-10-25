import type { Metadata } from "next";
import { HelpCenterSearch } from "@/components/help-center-search";
import { HelpHubPage } from "@/components/help-center-page";
import { helpPageMetadata } from "@/lib/help-metadata";

export const metadata: Metadata = helpPageMetadata(
  "/aide",
  "Centre d’aide Braand",
  "Réponses pratiques pour utiliser Braand, gérer votre espace et avancer dans vos projets.",
);

export default function Page() {
  return <HelpHubPage><HelpCenterSearch /></HelpHubPage>;
}
