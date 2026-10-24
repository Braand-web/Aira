# Braand

SaaS de conversation, créations, pages et missions assistées. React 19,
TypeScript, Vinext/Vite et Cloudflare Workers ; D1, R2 et Durable Objects.

Accueil public : https://braand.fun. État du raccordement : [Braand sur Cloudflare](docs/production/BRAAND_ROLLOUT_2026-10-24.md). La connexion utilisateur reste fermée jusqu’à la vérification du domaine e-mail.

## Développement

Node 24, puis :

```sh
npm ci --include=dev --include=optional
npm run dev -- --port 4182
```

Copier seulement les variables nécessaires de `.env.example` dans `.dev.vars`
(ignoré par Git). Ne jamais transmettre une clé dans le chat ni le front.
Sur loopback, `/auth/sign-in` fournit une identité fictive de développement.
Le Worker de production exclut cette simulation.

```sh
npm run typecheck
npm run lint
npm run build
npm test
```

La suite bloque le réseau externe. Les fournisseurs simulés ne prouvent pas une
connexion réelle. Tests d'interface : `node tests/browser-ui.browser.mjs` et
`node tests/auth-ui.browser.mjs`.

## Hébergement indépendant

Aucune API ni publication Sites n'est nécessaire. Le manifeste de publication
historique a été retiré. L'entrée `build/worker.ts` reconstruit l'identité à partir
d'une session privée, et rejette les en-têtes d'identité fournis par un client.
Ne pas déployer le manifeste local `dist/server/wrangler.json` directement.

Voir [le guide Cloudflare](docs/CLOUDFLARE_SELF_HOSTED.md) pour les ressources,
migrations, secrets, staging et limites de la bascule. Le workflow GitHub manuel
prépare un staging fermé dans votre compte Cloudflare après les vérifications.

## Connexion Braand

L'utilisateur reçoit un lien e-mail à usage unique via Resend. La session est
révocable côté serveur dans D1. Aucun compte ChatGPT n'est requis. Migration
additive `0014_independent_auth.sql`, sans effacement des anciennes données.
Les anciens comptes demandent une preuve de propriété et un rapprochement
administratif avant transfert ; aucune fusion automatique par e-mail.

## Fournisseurs

- Composio : comptes propres à chaque utilisateur, découverte à la demande et
  approbations serveur. Instant reste désactivé.
- IA : OpenRouter ou adaptateurs natifs avec routage et coûts vérifiés.
- Médias : fal.ai avec catalogue, tarifs et plafond approuvés.
- Paiement : SasPay.me, XAF, droits et webhooks côté serveur.
- E-mails : Resend, destinataire restreint en mode sandbox.

Le code ne prouve pas que les clés, domaines, tarifs ou parcours distants sont
validés. Les fonctions payantes restent fermées avant recette. Voir
[routage et offres](docs/TASK_ROUTING_AND_BILLING.md),
[exploitation](docs/production/OPERATIONS.md) et
[navigateur cloud](docs/BROWSER_RUN.md).
