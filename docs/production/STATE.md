# État de production — 24 octobre 2026

Le propriétaire a demandé de quitter Sites. Le code est préparé pour son propre
compte Cloudflare ; aucun nouveau déploiement Sites n'est effectué. La mise en
production publique n'a pas été exécutée. Un staging privé indépendant est
maintenant déployé. L'ancien site et ses données n'ont
pas été supprimés.

## Vérifié sur le compte Cloudflare

- Autorisation OAuth du CLI confirmée par `wrangler whoami` ; compte
  `2ead1748668417f67d184d93a3fd69ec`. Aucune application existante n'a été modifiée.
- D1 `aira-staging`, ID `7a2e1508-922b-4138-97ba-40e61c9be447`, créée ; les
  15 migrations sont appliquées. Requête distante : 64 tables, aucun utilisateur
  fictif. Les requêtes de constat sont en lecture seule.
- Worker `aira-staging` déployé, sans route publique ni URL workers.dev ou preview.
  D1 et les bindings navigateur/DO sont présents ; navigateur, autonomie,
  paiements, e-mails, Instant et sauvegardes restent désactivés.
- Secrets techniques créés directement côté Cloudflare, sans fichier en clair ;
  configuration OpenRouter existante transférée. `wrangler secret list` confirme
  les noms, jamais les valeurs. La clé OpenRouter a répondu HTTP 200 à
  `GET /api/v1/key` : authentification seulement, aucune génération facturée.
- Test du bundle en preview distante Cloudflare avec D1 réelle : `/api/health`
  200, `/api/workspace` 401, en-têtes d'identité usurpés toujours 401,
  `/auth/sign-in` 503 tant que la connexion n'est pas configurée. Ce test ne
  constitue pas une connexion utilisateur ni une ouverture publique.
- Cron distant observé : tâches `monitor` et `browser_cleanup` terminées avec
  une tentative. Une fausse alerte sur l'autonomie volontairement désactivée a
  été reproduite puis corrigée dans le Worker ; 4 tests protègent le routage du
  cron, le maintien des vraies alertes et l'exigence du secret du planificateur.
  Au passage de 05:00 UTC après déploiement du correctif, les deux tâches terminent
  et aucune nouvelle alerte missions n'apparaît ; les anciennes sont conservées.
- Détails et commandes : [recette du staging](STAGING_2026-10-24.md).

## Présent et vérifié localement

- Entrée indépendante `build/worker.ts`, React 19, TypeScript, Vinext/Vite,
  Cloudflare Workers, D1/Drizzle, R2 et Durable Objects ; aucun manifeste Sites requis.
- Connexion Aïra par lien e-mail à usage unique, identité vérifiée par le Worker,
  session privée révocable et migration additive `0014_independent_auth.sql`.
  Tous les en-têtes d'identité fournis par le client sont effacés.
- Types, lint, build et `npm test` réussis : 164 tests unitaires, 17 suites de
  services, 4 suites d'artefacts et 2 lanceurs HTTP ; réseau externe bloqué.
- Authentification : 18 contrôles SQLite/Web Crypto et 7 contrôles Chromium/HTTPS
  avec formulaires, cookies, confirmation et déconnexion. Envoi Resend simulé.
- Interface navigateur : 14 contrôles ; disposition du chat : 9 contrôles,
  notamment mobile et clavier. Services simulés, aucune session cloud facturée.
- Les derniers changements de `main` sont intégrés ; la suite complète et les
  37 contrôles de l'interface agent passent après cette intégration, y compris
  le nouveau comparatif des forfaits et le tableau de bord analytique.
- Catalogue Essentiel/Pro/Business et recharges conservé ; taxes déterminées
  côté serveur et configuration fiscale inconnue bloquante au paiement.
- Adaptateurs IA, fal.ai, Composio, SasPay.me et Resend ; missions, publications,
  crédits, sauvegardes et tâches présents. Leurs tests locaux ne prouvent pas
  leur fonctionnement avec les comptes réels.
- Générateur Cloudflare et workflow GitHub manuel pour un staging fermé, avec
  ressources distinctes et fonctions payantes désactivées. Workflow non exécuté.
- Vrai Worker compilé lancé en local : accueil 200, identité usurpée refusée
  (401), authentification non configurée fermée (503). Voir aussi les contrôles
  distants ci-dessus, distincts des tests avec services simulés.

## Bloqué ou non vérifié à distance

- L'API R2 répond encore « Please enable R2 », code 10042, malgré la confirmation
  d'activation du propriétaire. Aucun bucket Aïra n'a été créé. Le staging partiel
  omet explicitement les bindings R2 et ferme les aperçus fichiers ; ni fichiers
  ni sauvegardes cloud ne sont déclarés opérationnels.
- Les clés Composio, Resend, fal.ai et SasPay de test restent absentes des secrets
  du Worker. Le contrôle du panneau droit n'est pas disponible dans cette session.
  Une connexion aux tableaux de bord ne fournit pas automatiquement ces clés.
- Pas de domaine. L'adresse du compte Resend a été fournie ; destinataire et
  expéditeur de test sont configurés en secrets, envoi toujours désactivé faute
  de clé. `onboarding@resend.dev` permet seulement de tester vers l'adresse du
  compte Resend. SPF/DKIM/DMARC et les envois clients attendent un domaine vérifié.
- SasPay.me : FlowPay confirmé par le propriétaire, avec une clé Aïra distincte.
  Sandbox, Mobile Money/carte en XAF, frais, webhooks et remboursements de test
  restent à vérifier. Composio attend le transfert de sa clé existante en secret
  serveur ; OAuth Meta, permissions et parcours publicitaire non vérifiés.
- La clé OpenRouter est acceptée sur une lecture réelle, sans génération.
  Modèle, tarifs et coûts de facture du routage à valider dans l'environnement final.
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

Suivre [le guide Cloudflare indépendant](../CLOUDFLARE_SELF_HOSTED.md) : ne pas
recréer la base déjà migrée. Terminer l'activation R2 du bon compte, créer les
deux buckets privés, ajouter les clés fournisseurs dédiées puis déployer le
staging complet. La clé Resend permettra le premier test vers son propriétaire,
puis un domaine vérifié permettra les envois clients. Le générateur initial remet les
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

## Harness agentique — migration et runtime déployés en staging privé

À la demande du propriétaire, `0015_agent_harness.sql` a été appliquée sur D1 distante `aira-staging` (`7a2e1508-922b-4138-97ba-40e61c9be447`) le 24 octobre 2026 à 09:16:34 UTC. Le registre passe de 15 à 16 migrations. Les quatre tables `agent_checkpoints`, `agent_plans`, `agent_verifications`, `agent_tool_receipts` et les deux index explicites sont présents. `PRAGMA foreign_key_check` ne renvoie aucune anomalie ; `d1 migrations list` ne trouve plus de migration en attente.

Après la migration, le runtime contenant `58286ec` a été déployé sur `aira-staging` le 24 octobre 2026 à 12:52:22 UTC. Version active à 100 % : `6f4aa0ee-abe9-4405-978b-a262af34978e` ; déploiement `972cba24-5ec0-4e5d-8fb2-18e1d607576a`. Le manifeste conserve `workers_dev=false`, `preview_urls=false` et aucune route publique. La relecture de version confirme la D1 attendue, les flags fermés et 13 bindings secrets conservés, sans lecture de leurs valeurs.

Huit contrôles du même bundle en preview distante Cloudflare passent : accueil/santé D1 200 ; workspace sans session, identité usurpée, lecture et POST chat, lecture Meta 401 ; connexion désactivée 503. Le proxy de recette est arrêté. Ces contrôles ne constituent pas un parcours authentifié, une génération IA ni une validation des intégrations payantes. L'onglet local sur le port 4202 reste une démonstration séparée. Le rapport `../AGENT_HARNESS_AUDIT.md` conserve les preuves des tests locaux ; les validations réelles des fournisseurs restent à effectuer.

## Préparation de la production — accès fournisseurs encore incomplets

À la demande du propriétaire, D1 `aira-production` a été créée séparément du staging : `b7f76985-2bb9-45ef-9fa0-b575ad2a3cce`, WEUR. Les 16 migrations sont appliquées ; quatre tables du harness, zéro utilisateur d'authentification, aucun défaut de clé étrangère constaté. Aucun Worker public de production n'a été publié. R2 reste refusé avec le code 10042. La clé Composio apparaît désormais dans les secrets du staging ; les clés Resend et SasPay attendues restent absentes. Le contrôle des onglets du panneau droit n'est pas disponible dans cette session. Voir [préparation et accès nécessaires](PRODUCTION_PREPARATION_2026-10-24.md).
