# Aïra sur votre compte Cloudflare

État au 24 octobre 2026. Ce guide remplace la publication Sites. Le site historique,
les DNS et les données distantes n'ont pas été supprimés.

## Préparation effectuée

- Worker indépendant, sans manifeste ni API de publication Sites.
- Connexion Aïra par e-mail, sessions privées D1, vérification côté serveur.
- Migration additive 0014 ; aucune propriété d'ancien espace n'est modifiée.
- Configuration générée refusant les identifiants factices, le partage de stockage
  staging/production et l'utilisation du bucket fichiers pour les sauvegardes.
- GitHub Actions manuel : types, lint, build et tests avant staging fermé.

## Vérifications des accès

Les tableaux de bord Cloudflare, SasPay.me, Resend et Composio étaient connectés
au début de l'intervention. Cette connexion ne fournit pas un accès API au Worker.
`wrangler whoami` a échoué avec « Not logged in ». Aucun nouveau secret fournisseur
n'a été créé ou transféré. Le contrôle du panneau est ensuite devenu indisponible
pendant le changement des outils de la session ; le module navigateur requis
n'était plus présent. Ne pas confondre cette limite avec une déconnexion du compte.

Les ressources Cloudflare visibles concernent d'autres projets. Le propriétaire
a confirmé FlowPay pour Aïra, avec une nouvelle clé dédiée ; les clés visibles
concernent d'autres produits : aucune réutilisation implicite de LiveFoot, Sellow
ou Coden. Il ne dispose pas encore d'un domaine ni d'une adresse de test à fournir.
L'ancien hébergement n'est plus utilisé pour
les nouvelles publications ; sa suppression exige un inventaire et une sauvegarde.

## 1. Ressources neuves

Sur une machine autorisée, avec le Wrangler installé du dépôt :

```sh
npx --no-install wrangler login
npx --no-install wrangler whoami
npx --no-install wrangler d1 create aira-staging
npx --no-install wrangler r2 bucket create aira-staging-files
npx --no-install wrangler r2 bucket create aira-staging-backups
```

Ces ressources peuvent être facturées selon le contrat Cloudflare. Dans
l'environnement GitHub `staging`, ajouter les variables non secrètes
`CLOUDFLARE_ACCOUNT_ID`, `AIRA_STAGING_D1_ID`, `AIRA_STAGING_FILES_BUCKET`,
`AIRA_STAGING_BACKUPS_BUCKET`. Ajouter un secret `CLOUDFLARE_API_TOKEN` limité au
compte et aux ressources Aïra (Workers, D1, R2 et lecture du compte si nécessaire).
Ne pas le transmettre en message ni dans une variable publique.

```sh
npm run build
npm run cloudflare:config -- staging
npx --no-install wrangler d1 migrations list DB --remote --config .wrangler/deploy/staging.json
npx --no-install wrangler d1 migrations apply DB --remote --config .wrangler/deploy/staging.json
npm run cloudflare:deploy:staging
```

Le générateur ferme le Worker : pas de route ni d'URL workers.dev, toutes les
fonctions payantes désactivées. Le workflow ne s'exécute que manuellement et
l'application des migrations est décochée par défaut. Les journaux d'invocation
sont désactivés pour éviter de conserver des liens d'authentification.

## 2. Secrets et connexion

Workers → Aïra staging → Settings → Variables and Secrets, type **Secret**, ou
`wrangler secret put NOM --config .wrangler/deploy/staging.json`, puis saisie privée.
Ne jamais placer une valeur secrète en argument de commande.

- AUTH_HASH_SECRET : secret aléatoire dédié d'au moins 32 caractères.
- RESEND_API_KEY : clé Aïra avec droit d'envoi limité au domaine choisi.
- TOKEN_ENCRYPTION_KEY, BACKUP_ENCRYPTION_KEY, BROWSER_PROFILE_KEY : clés distinctes
  de 32 octets aléatoires en base64. Conserver les anciennes clés lors d'une rotation
  jusqu'au rechiffrement et à la vérification des sauvegardes.
- SCHEDULER_SECRET, FILE_URL_SIGNING_SECRET, PAGE_FORM_SECRET : secrets aléatoires
  distincts, d'au moins 32 caractères, selon les fonctionnalités activées.

Définir APP_ORIGIN à l'origine HTTPS exacte ; APP_ENV=staging, RESEND_MODE=sandbox,
RESEND_FROM à l'adresse d'un domaine vérifié et RESEND_TEST_RECIPIENT à une adresse
appartenant au responsable. AUTH_ENABLED=true seulement après cette configuration.
Le sandbox refuse l'envoi des liens à d'autres adresses. SPF, DKIM et DMARC attendent
le choix du domaine. Un e-mail de test peut consommer un quota réel ; l'acceptation
API n'est pas une preuve de réception dans la boîte du destinataire.

Les liens expirent en dix minutes et exigent le navigateur de départ ainsi qu'une
confirmation POST. Les scanners de messagerie ne créent pas de session. Une session
dure au maximum sept jours ; la déconnexion la révoque côté serveur. Le cron retire
les sessions, liens et compteurs périmés. Changer AUTH_HASH_SECRET invalide les sessions.
Les limites anti-abus sont des choix internes, pas des quotas promis par Resend.

## 3. Fournisseurs

- Composio : transférer la clé existante du projet sélectionné dans COMPOSIO_API_KEY ;
  ne pas la remplacer automatiquement. Meta utilise les configurations d'autorisation
  approuvées. Un appel de lecture réel doit retourner une référence de journal Composio.
  Instant reste désactivé.
- SasPay.me : le marchand FlowPay est confirmé pour Aïra ; obtenir une clé test propre et
  un secret webhook, avec portée d'encaissement minimale. Vérifier le sandbox,
  Mobile Money/carte en XAF et les frais du contrat ; ne pas reprendre les anciennes
  clés d'autres produits. Les données fiscales et légales restent à valider.
- IA : clé OpenRouter ou clés natives et tarifs serveur vérifiés, avec frais de change
  réels. La clé locale présente n'a pas été publiée automatiquement ni utilisée pour
  une génération facturée pendant cette préparation.
- fal.ai : FAL_KEY et FAL_CATALOG_JSON avec modèles et tarifs effectivement vérifiés.

## 4. Bascule finale

Ne pas exposer le Worker avant migration D1, connexion et déconnexion réelles,
isolation et restauration de sauvegarde. Vérifier ensuite Composio, paiements XAF,
webhooks, remboursements, notifications, cron et navigateur sur un site contrôlé.

Créer des ressources de production séparées : aira-production,
aira-production-files, aira-production-backups ; définir les AIRA_PRODUCTION_*
correspondantes puis `npm run cloudflare:config -- production`. Le résultat reste
fermé. Après acceptation du staging, conserver une configuration finale revue,
renseigner APP_ORIGIN et les secrets, ajouter le domaine Aïra ou activer volontairement
workers.dev dans cette configuration, puis la déployer. Vérifier /api/health et
le parcours authentifié sur l'adresse finale avant d'ouvrir les fonctions payantes.

Le générateur ne recopie pas les secrets et flags distants : sa réexécution remet
l'authentification et les fonctions payantes à l'arrêt. Conserver séparément la
configuration finale validée avant tout redéploiement. Ne jamais déclarer réussis
les flags de recette, TVA, marge, support ou restauration sans preuve.

Les anciens comptes Sites demandent un rapprochement administratif avec preuve de
propriété avant attribution à une nouvelle identité Aïra. Aucune fusion automatique
par adresse et aucune suppression des données historiques.

## Preuves locales du 24 octobre 2026

`npm run typecheck`, `npm run lint`, `npm run build` et `npm test` réussissent.
La suite comprend 156 tests unitaires, 15 suites de services, 4 suites d'artefacts
et 2 lanceurs HTTP. Aucun accès réseau externe n'est autorisé dans `npm test`.

Les 18 contrôles d'authentification comprennent le vrai point d'entrée Worker
(ses services non concernés sont remplacés), SQLite et Web Crypto. Les 7 contrôles
dans Chromium utilisent un serveur HTTPS local, les cookies Secure/HttpOnly et
les redirections natives : formulaire, lien, confirmation, session et révocation.
Resend est simulé. Le parcours a permis de corriger un conflit entre la politique
de référent et la preuve d'origine des formulaires, sans retirer le contrôle CSRF.
Les 14 contrôles de l'interface navigateur et les 9 contrôles de disposition du
chat passent également avec des services simulés. Les captures de connexion
ordinateur/mobile ont été examinées ; aucune preuve locale ne vaut recette cloud.
Après intégration des derniers changements de `main`, types, lint, build et toute
la suite ont été relancés avec succès, ainsi que les 13 contrôles de l'interface
agent. Le lanceur de démonstration utilise aussi la nouvelle route de connexion.

Pour relancer le parcours de connexion, installer Playwright dans l'environnement
de test (ou définir AIRA_PLAYWRIGHT_MODULE vers son module existant), disposer
d'OpenSSL dans le PATH sur Linux/macOS ou fourni par Git for Windows, puis lancer
`node tests/auth-ui.browser.mjs`. Les clés TLS éphémères et captures restent dans
`.tmp/auth-ui`, ignoré par Git. Aucun vrai e-mail ou paiement n'a été envoyé.

Le Worker compilé a également été démarré avec Wrangler en mode local : page
d'accueil HTTP 200, identité usurpée refusée par `/api/workspace` (401), connexion
non configurée fermée par `/auth/sign-in` (503). Ce test utilise réellement le
bundle de production ; il ne constitue pas un déploiement cloud.

## Dépendances : correctifs et risque restant

Versions correctives installées sans changement majeur : clients/serveurs MCP
2.3.1, Vite 8.1.6, plugin Cloudflare 1.42.0, Wrangler 4.102.0, body-parser 2.4.0
et fast-uri 3.1.9. Installation et tests relancés avec ces versions verrouillées.
Deux binaires Windows optionnels omis par npm ont été restaurés depuis les
archives exactes du lockfile, avec vérification SHA-512, sans supprimer le lockfile.

L'audit complet du 24 octobre signale encore **1 alerte élevée et 4 modérées**.
Zod 3 reste concerné par [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
(épuisement mémoire lors de validations de collections). Le correctif publié
demande Zod 4.6.6 ou supérieur : migration majeure non appliquée automatiquement,
à valider avec les schémas et SDK Composio avant activation publique. Aucune
absence d'exposition n'est affirmée. Les quatre alertes modérées concernent
esbuild et les anciennes dépendances de développement de Drizzle Kit ; ne pas
exposer leurs serveurs de développement ni appliquer la rétrogradation majeure
suggérée par `npm audit fix --force`. Ce relevé ne constitue pas un audit propre.

## Références officielles

Documentation à utiliser pour la recette et les réglages, relevée le 23 octobre 2026 :

- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://resend.com/docs/dashboard/api-keys/introduction
- https://resend.com/docs/dashboard/domains/introduction
- https://docs.composio.dev/docs/quickstart
