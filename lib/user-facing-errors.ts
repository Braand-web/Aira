// Presentation only. Provider URLs, accounting, error codes and tool arguments stay unchanged.
export function userFacingError(error: unknown, fallback = "Impossible de terminer cette opération. Réessayez."): string {
 const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
 if (/saspay/i.test(message)) return /commande.*enregistr/i.test(message)
  ? "Le service de paiement est indisponible. Votre commande reste enregistrée."
  : "Le service de paiement est indisponible. Réessayez ou contactez le support Braand.";
 if (/openrouter|anthropic|claude|(?:api[_-]key|secret).*modèle/i.test(message)) return "L’assistant est temporairement indisponible. Votre brouillon est conservé. Contactez le support Braand si le problème persiste.";
 if (/fal\.ai|fal[_-](?:key|api)/i.test(message)) return "Le service de création est temporairement indisponible. Contactez le support Braand si le problème persiste.";
 if (/composio/i.test(message)) return "Les connexions aux applications sont temporairement indisponibles. Réessayez ou contactez le support Braand.";
 return message || fallback;
}
