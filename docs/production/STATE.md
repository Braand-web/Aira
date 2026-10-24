# État courant : Braand — 24 octobre 2026

Le produit porte désormais le nom **Braand**. Le domaine prévu est https://braand.fun. Le propriétaire a autorisé les connexions et le déploiement ; les environnements de staging et de production sont déployés **en privé**. La disponibilité publique et le parcours utilisateur authentifié ne sont pas encore prouvés.

Le [relevé Braand](BRAAND_ROLLOUT_2026-10-24.md) contient les versions actives, ressources, contrôles, limites fournisseurs et la procédure DNS. Il remplace les constats plus anciens des notes de préparation.

## Terminé et vérifié

- Interface, connexion, documents, agents et compétences originales renommés ; contrats, cookies et identifiants techniques conservés.
- Deux D1 distinctes, migrations 0000–0015 appliquées ; deux Workers privés ; quatre buckets R2 séparés. Écriture, relecture et suppression de contrôle réussies sur chacun ; accès publics désactivés.
- OpenRouter, Composio et SasPay authentifiés par lectures réelles puis liés en secrets aux Workers. Modèle et prix de tokens existants conservés. Secrets techniques de production distincts.
- Clé Resend existante reconnue ; aucun envoi. Le propriétaire choisit un autre compte dédié à Braand : sa clé reste attendue en production.
- Types, lint, compilation et suite complète réussis : 176 tests unitaires, 18 suites d’intégration, 4 suites d’artefacts, 2 lanceurs HTTP. Tests locaux sans fournisseur externe.
- Chromium : 41 contrôles interface et 7 connexion, services simulés ; captures ordinateur/mobile examinées.
- Huit contrôles réels du bundle en preview Cloudflare avec ressources de production : santé D1 et accueil 200, accès anonymes/usurpés 401, connexion volontairement fermée 503. Ni accès public ni parcours connecté complet.

## À terminer avant ouverture publique

- Ajouter braand.fun dans Cloudflare et configurer sa délégation chez le vendeur du domaine. La création via OAuth CLI est refusée, permission de création de zone manquante. DNS actuel : aster.dns-parking.com et helios.dns-parking.com.
- Créer le compte Resend dédié, ajouter et vérifier le domaine, stocker sa clé côté serveur. L’ancien compte refuse un quatrième domaine ; aucun domaine existant supprimé ni achat réalisé.
- Raccorder l’origine HTTPS, tester les liens e-mail et l’isolation des vraies sessions avant d’activer l’authentification publique.
- Valider séparément OAuth métier, générations et coûts réels, webhook SasPay, fiscalité, textes légaux, économie et restauration avant les fonctions payantes. Aucun paiement, e-mail ou appel de génération réel effectué.
- Les fonctions sensibles restent désactivées. Les anciennes identités Sites demandent une preuve de propriété avant rapprochement ; pas de fusion automatique.
- Les alertes de dépendances déjà documentées restent à traiter avant exposition ; le déploiement privé ne prouve pas une sécurité complète.

Les limites du panneau droit sont techniques : pas d’outil de contrôle de ses sessions dans ce contexte. Aucun cookie ou stockage d’authentification n’a été extrait. Les secrets ne sont jamais inclus au dépôt ; la rotation des clés partagées dans la conversation reste recommandée après raccordement.

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

## Harness agentique — migration et runtime déployés en staging privé

À la demande du propriétaire, `0015_agent_harness.sql` a été appliquée sur D1 distante `aira-staging` (`7a2e1508-922b-4138-97ba-40e61c9be447`) le 24 octobre 2026 à 09:16:34 UTC. Le registre passe de 15 à 16 migrations. Les quatre tables `agent_checkpoints`, `agent_plans`, `agent_verifications`, `agent_tool_receipts` et les deux index explicites sont présents. `PRAGMA foreign_key_check` ne renvoie aucune anomalie ; `d1 migrations list` ne trouve plus de migration en attente.

Après la migration, le runtime contenant `58286ec` a été déployé sur `aira-staging` le 24 octobre 2026 à 12:52:22 UTC. Version active à 100 % : `6f4aa0ee-abe9-4405-978b-a262af34978e` ; déploiement `972cba24-5ec0-4e5d-8fb2-18e1d607576a`. Le manifeste conserve `workers_dev=false`, `preview_urls=false` et aucune route publique. La relecture de version confirme la D1 attendue, les flags fermés et 13 bindings secrets conservés, sans lecture de leurs valeurs.

Huit contrôles du même bundle en preview distante Cloudflare passent : accueil/santé D1 200 ; workspace sans session, identité usurpée, lecture et POST chat, lecture Meta 401 ; connexion désactivée 503. Le proxy de recette est arrêté. Ces contrôles ne constituent pas un parcours authentifié, une génération IA ni une validation des intégrations payantes. L'onglet local sur le port 4202 reste une démonstration séparée. Le rapport `../AGENT_HARNESS_AUDIT.md` conserve les preuves des tests locaux ; les validations réelles des fournisseurs restent à effectuer.

## Préparation de la production — accès fournisseurs encore incomplets

À la demande du propriétaire, D1 `aira-production` a été créée séparément du staging : `b7f76985-2bb9-45ef-9fa0-b575ad2a3cce`, WEUR. Les 16 migrations sont appliquées ; quatre tables du harness, zéro utilisateur d'authentification, aucun défaut de clé étrangère constaté. Aucun Worker public de production n'a été publié. R2 reste refusé avec le code 10042. La clé Composio apparaît désormais dans les secrets du staging ; les clés Resend et SasPay attendues restent absentes. Le contrôle des onglets du panneau droit n'est pas disponible dans cette session. Voir [préparation et accès nécessaires](PRODUCTION_PREPARATION_2026-10-24.md).
