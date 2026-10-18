# État du dépôt et des dépendances de production

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

`.env.example` liste les variables sans valeurs. `.dev.vars` est ignoré par Git. La vérification locale n'a affiché que des booléens de présence : `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` et `OPENROUTER_RATE_JSON` sont renseignés ; `COMPOSIO_API_KEY`, fal.ai, SasPay, Resend, `SCHEDULER_SECRET`, les portes de vente, d'autonomie et de sauvegarde sont absents/inactifs. Aucun secret n'a été lu ou recopié.

L'onglet Composio est connecté. L'écran d'accueil affiche que sa clé API a été créée et copiée ; Aïra ne la reçoit pas automatiquement. La variable `COMPOSIO_API_KEY` reste absente de l'environnement local d'Aïra. La clé n'a pas été consultée, collée ou exposée.

Le navigateur était aussi connecté à Cloudflare, SasPay et Resend. Le Worker Cloudflare affiché était `livefoot` (autre produit) ; aucun changement n'a été fait. Aucun e-mail de test ni paiement n'a été lancé. Le propriétaire a indiqué ne pas encore avoir de domaine ni d'adresse e-mail de test.

## État Git et conditions de lancement

Branche locale : `audit/2026-10-18`. Aucun remote Git n'est configuré dans ce checkout. Aucune poussée ni mise en production n'a été effectuée.

La documentation publique de prix est datée du 18 octobre 2026 dans `COST_SOURCES.md`. Les prix publics ne remplacent pas les tarifs/factures du compte réel. Le seuil de marge de 75 % n'est pas démontré : coûts fournisseur, frais de paiement, taxes, change, support et consommation réelle restent à mesurer.

Le manifeste de build contient `DB`, `BUCKET` et le cron de cinq minutes ; cela prouve uniquement la configuration générée localement. Les ressources Cloudflare, secrets, domaine, déclencheur distant, e-mails, comptes Meta et SasPay demeurent à valider en staging avant toute bascule live.
