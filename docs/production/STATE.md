# État de production — 24 octobre 2026

Le propriétaire a demandé de quitter Sites. Le code est préparé pour son propre
compte Cloudflare ; aucun nouveau déploiement Sites n'est effectué. La mise en
production indépendante n'a pas été exécutée. L'ancien site et ses données n'ont
pas été supprimés.

## Présent et vérifié localement

- Entrée indépendante `build/worker.ts`, React 19, TypeScript, Vinext/Vite,
  Cloudflare Workers, D1/Drizzle, R2 et Durable Objects ; aucun manifeste Sites requis.
- Connexion Aïra par lien e-mail à usage unique, identité vérifiée par le Worker,
  session privée révocable et migration additive `0014_independent_auth.sql`.
  Tous les en-têtes d'identité fournis par le client sont effacés.
- Types, lint, build et `npm test` réussis : 152 tests unitaires, 15 suites de
  services, 4 suites d'artefacts et 2 lanceurs HTTP ; réseau externe bloqué.
- Authentification : 18 contrôles SQLite/Web Crypto et 7 contrôles Chromium/HTTPS
  avec formulaires, cookies, confirmation et déconnexion. Envoi Resend simulé.
- Interface navigateur : 14 contrôles ; disposition du chat : 9 contrôles,
  notamment mobile et clavier. Services simulés, aucune session cloud facturée.
- Catalogue Essentiel/Pro/Business et recharges conservé ; taxes déterminées
  côté serveur et configuration fiscale inconnue bloquante au paiement.
- Adaptateurs IA, fal.ai, Composio, SasPay.me et Resend ; missions, publications,
  crédits, sauvegardes et tâches présents. Leurs tests locaux ne prouvent pas
  leur fonctionnement avec les comptes réels.
- Générateur Cloudflare et workflow GitHub manuel pour un staging fermé, avec
  ressources distinctes et fonctions payantes désactivées. Workflow non exécuté.
- Vrai Worker compilé lancé en local : accueil 200, identité usurpée refusée
  (401), authentification non configurée fermée (503). Aucun déploiement distant.

## Bloqué ou non vérifié à distance

- `wrangler whoami` indique « Not logged in ». Les tableaux de bord étaient
  connectés, puis le contrôle du navigateur de cette session est devenu
  indisponible. Ces connexions ne donnent pas automatiquement des droits API
  au CLI ou au Worker. Aucun nouveau secret n'a été créé ou transféré.
- Ressources D1/R2 Aïra, secrets et URL de staging à configurer. Le propriétaire
  n'a pas encore fourni de domaine ni d'adresse e-mail de test. Resend attend
  un domaine, SPF/DKIM/DMARC, une clé Aïra et la preuve de réception réelle.
- SasPay.me : FlowPay confirmé par le propriétaire, avec une clé Aïra distincte.
  Sandbox, Mobile Money/carte en XAF, frais, webhooks et remboursements de test
  restent à vérifier. Composio attend le transfert de sa clé existante en secret
  serveur ; OAuth Meta, permissions et parcours publicitaire non vérifiés.
- Une clé OpenRouter est présente localement, sans appel réel pendant cette
  préparation. Clés et tarifs du routage à valider dans l'environnement final.
  fal.ai n'a pas exécuté de génération réelle.
- Instant, navigateur cloud, autonomie, facturation et sauvegardes restent
  fermés par la configuration initiale. Aucune restauration cloud ni alerte
  reçue ne sont prouvées. Fiscalité, textes légaux, support et marge réelle
  de 75 % restent à valider.
- Les anciennes identités Sites ne sont pas fusionnées automatiquement : preuve
  de propriété et rapprochement requis avant transfert des espaces et crédits.
- Audit npm actualisé : 1 alerte élevée Zod (migration majeure vers 4.6.6 ou
  supérieur à valider avant activation publique) et 4 modérées de développement
  via Drizzle/esbuild. MCP, Vite, Wrangler, body-parser et fast-uri ont reçu des
  versions correctives ; l'audit complet reste non propre.

## Suite exacte

Suivre [le guide Cloudflare indépendant](../CLOUDFLARE_SELF_HOSTED.md) : authentifier
Wrangler, créer D1 et deux buckets R2 Aïra, définir variables GitHub et secrets,
appliquer les migrations puis déployer le staging fermé. Le domaine et l'expéditeur
de test permettent ensuite la recette réelle. Le générateur initial remet les
flags à l'arrêt : conserver séparément la configuration finale validée avant les
redéploiements. Ne pas déclarer l'application prête à encaisser sur les tests locaux.

---

# Archive : état du dépôt au 18 octobre 2026

Les constats ci-dessous sont historiques ; l'état courant figure ci-dessus.

Relevé final du 18 octobre 2026. Les vérifications applicatives ont été faites en local avec des données temporaires. Aucun déploiement, paiement, remboursement, e-mail, génération média, appel réel au modèle ou changement DNS n'a été effectué.

## Stack et capacités

| Zone | Présent | À vérifier / compléter | Preuve |
|---|---|---|---|
| Application | React 19, Next/Vinext, TypeScript, Worker Cloudflare | Déploiement sur le Worker et l'environnement Aïra corrects | `package.json`, build local réussi |
| Données | D1, Drizzle, migrations SQL ; stockage R2 | Identifiants et bindings réels, sauvegarde distante distincte | Manifeste local et tests SQLite/R2 simulé |
| Identité et organisations | Authentification Sites, rôles, isolation par organisation | Parcours public hébergé et revue complète IDOR | tests d'API et tests métier locaux |
| Modèle | OpenRouter/Anthropic, streaming, réservation et rapprochement | Aucun appel réel ; configuration de coûts à rapprocher à une facture | `lib/llm.ts`, `lib/metering.ts`, 16 tests simulés |
| Composio | SDK, découverte paginée, session par utilisateur, connexions et approbations d'écriture | Clé serveur absente d'Aïra ; OAuth Meta et outil réel non testés | 29 tests de politique, 8 tests SDK, 6 tests HTTP simulés |
| fal.ai | Adaptateurs, catalogue et estimation de coût | Clé/catalogue vide ; aucun rendu réel évalué | `lib/providers.ts`, aucun appel externe |
| Meta Ads | Lectures et outils Composio dynamiques ; écritures protégées par approbation | App/auth config/scopes, compte test, création et mesure de campagne | parcours simulés seulement |
| Paiements | Catalogue XAF, commandes, webhooks, allocations, remboursements administrés et avoirs | SasPay test, coûts réels, règles fiscales et remboursements fournisseur | 21 + 11 contrôles avec fournisseur simulé |
| Pages | Brouillon, version, approbation, publication isolée et formulaire | `PAGES_ORIGIN`, abonnement et hébergement réel | 19 contrôles de runtime locaux |
| Missions autonomes | Mandats bornés, exécution persistante, suspension, checkpoints | Planificateur et modèle réels ; seulement analyses, lectures et brouillons sont autorisés | 19 contrôles de runtime locaux |
| Exploitation | Tâches, alertes/outbox, sauvegarde chiffrée et restauration test | Resend, R2, alertes extérieures et exercice cloud | 12 contrôles SQLite/Web Crypto ; services externes simulés |
| Cron Worker | `scheduled()` appelle les trois tâches ; le manifeste local contient `triggers.crons` | Déployer le Worker Aïra et vérifier un tick réel | build + `tests/worker-config.test.mjs` |

## Routes et données principales

Écrans : chat, missions, tableau de bord, créations, fichiers, pages, campagnes, intégrations, compétences, paramètres, facturation et administration.

Routes construites : `/api/admin/billing`, `/api/admin/operations`, `/api/billing/*`, `/api/chat`, `/api/connectors/*`, `/api/files*`, `/api/health`, `/api/internal/{billing,mission,operations}-tick`, `/api/meta*`, `/api/missions/:id`, `/api/pages/:id`, `/api/proposals/:id`, `/api/published/:id`, `/api/resources/:id`, `/api/webhooks/saspay` et `/api/workspace`.

Les modèles couvrent organisations, membres/rôles, projets, conversations, événements de streaming, fichiers, propositions, connexions, abonnements, paiements, lots/mouvements/réservations de crédits, remboursements, coûts fournisseurs, missions, tâches, notifications, audits et manifestes de sauvegarde. Les migrations sont additives ; ne pas effacer les écritures financières pour revenir en arrière.

## Environnement et secrets — présence uniquement

`.env.example` liste les variables sans valeurs. `.dev.vars` est ignoré par Git. Recontrôle local effectué le 18 octobre 2026, avec affichage des seules présences : `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` et `OPENROUTER_RATE_JSON` sont renseignés ; `COMPOSIO_API_KEY`, `FAL_KEY`, les trois secrets SasPay, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TEST_RECIPIENT`, `SCHEDULER_SECRET`, Meta et le chiffrement des tokens sont absents. Aucun secret n'a été lu ou recopié.

L'onglet Composio est connecté. L'écran d'accueil affiche que sa clé API a été créée et copiée ; Aïra ne la reçoit pas automatiquement. La variable `COMPOSIO_API_KEY` reste absente de l'environnement local d'Aïra. La clé n'a pas été consultée, collée ou exposée.

Le navigateur est connecté aux tableaux de bord Cloudflare, SasPay et Resend. La recherche Cloudflare « Aira » retourne « No projects found » dans le compte consulté ; le compte comporte des projets d'autres produits. Le tableau SasPay actuellement ouvert identifie le produit marchand `FlowPay` ; cela ne prouve ni un compte marchand Aïra ni le mode sandbox, ni l'activation XAF des méthodes. La page Resend des clés API est ouverte, mais aucune clé n'a été créée, lue ou copiée. Aucun paiement ni e-mail de test n'a été lancé. Le propriétaire a indiqué ne pas encore avoir de domaine ni d'adresse de test.

## État Git et conditions de lancement

Branche locale : `audit/2026-10-18`, remote `origin` vers `https://github.com/Braand-web/Aira.git`. Le code et l'audit précédents sont poussés sur cette branche ; la présente mise à jour des constats est commitée localement mais son push a échoué, car cette session ne dispose pas d'une authentification GitHub utilisable. Aucun déploiement Aïra vers Cloudflare ni changement live n'a été effectué.

La documentation publique de prix est datée du 18 octobre 2026 dans `COST_SOURCES.md`. Les prix publics ne remplacent pas les tarifs/factures du compte réel. Le seuil de marge de 75 % n'est pas démontré : coûts fournisseur, frais de paiement, taxes, change, support et consommation réelle restent à mesurer.

Le manifeste de build contient `DB`, `BUCKET` et le cron de cinq minutes ; cela prouve uniquement la configuration générée localement. Les ressources Cloudflare, secrets, domaine, déclencheur distant, e-mails, comptes Meta et SasPay demeurent à valider en staging avant toute bascule live.
