# Audit et préparation production — Aïra

## Mise à jour — 24 octobre 2026 : sortie de Sites

Le code utilise désormais un Worker Cloudflare indépendant et une connexion Aïra
par lien e-mail à usage unique. La migration 0014 est additive ; les anciens
espaces ne sont ni supprimés ni fusionnés automatiquement. La nouvelle grille
Essentiel/Pro/Business et le routage interne sont conservés.

**VÉRIFIÉ localement :** types, lint, build et toutes les suites npm réussissent
(152 tests unitaires, 15 suites de services, 4 suites d'artefacts, 2 lanceurs HTTP).
L'authentification couvre 18 contrôles serveur, 7 contrôles Chromium/HTTPS et
un démarrage du vrai bundle Worker : accueil 200, en-têtes usurpés refusés (401),
connexion fermée sans configuration (503). Les sauvegardes testées conservent
également les identités indépendantes. Resend, R2 et les fournisseurs sont simulés.

**P1 non corrigé :** l'audit npm actualisé conserve une alerte élevée Zod,
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), nécessitant
une migration majeure à faire valider ; quatre alertes modérées restent dans la
chaîne de développement Drizzle/esbuild. Les versions correctives MCP, Vite,
Wrangler, body-parser et fast-uri sont installées et retestées. Ne pas affirmer
que l'audit est propre ou que l'application est prête à encaisser.

**BLOQUÉ à distance :** authentification Wrangler, ressources Cloudflare Aïra,
secrets serveur, domaine/expéditeur et destinataire de test, recettes réelles des
fournisseurs, fiscalité/marge, support et restauration cloud. FlowPay est confirmé
avec une clé Aïra distincte à créer. Aucun nouveau déploiement Sites ni bascule
live n'a été effectué. État courant : [production/STATE](docs/production/STATE.md)
et [guide Cloudflare indépendant](docs/CLOUDFLARE_SELF_HOSTED.md).

## Mise à jour vérifiée — 20 octobre 2026

Branche de correction : `audit/2026-10-20`, depuis `17f8ca5`. Les sections datées du 18 octobre ci-dessous constituent l'état initial ; leurs nombres de tests et leur constat de lint en échec sont historiques.

Le socle local est renforcé. Cela ne valide pas les fournisseurs ni l'exploitation en production. Aucun paiement, remboursement, e-mail, appel fournisseur facturable, déploiement live ou changement DNS n'a été effectué.

### Défauts corrigés et preuves

- **P1 — Résultat d'une mission confondu avec sa réussite.** Une sortie du modèle ne termine plus une mission. Chaque étape attend la validation explicite des événements et ressources enregistrés, après rapprochement de son coût. Les versions, événements, droits, statut et réservation sont revérifiés dans l'écriture SQL. Les étapes incertaines ne sont jamais relancées automatiquement ; leur annulation conserve les coûts inconnus. Fichiers : `lib/durable-missions.ts`, `lib/mission-policy.mjs`, route missions et `components/runtime-controls.tsx`. **VÉRIFIÉ : 26 contrôles runtime et 3 tests de politique**, dont cinq mutations concurrentes, approbateur sans droit d'écriture et lecture inter-organisation refusée.
- **P1 — Sauvegarde limitée par le chargement des médias en mémoire.** Archives v2 chiffrées AES-GCM, segments de 1 Mio, métadonnées paginées, vérification des empreintes et des ETag, écritures conditionnelles et restauration en flux. Compatibilité v1 conservée. **VÉRIFIÉ : 21 contrôles opérations**, dont restauration SQLite réelle et fichier de 50 Mio avec 208 objets. R2 et Resend sont simulés. Le SQL reste volontairement borné à 8 Mio/10 000 lignes pour sa restauration transactionnelle ; ce n'est pas une sauvegarde illimitée. Voir `docs/production/OPERATIONS.md`.
- **P2 — Acteur du journal incorrect et documents financiers trop exposés.** Le journal conserve l'utilisateur réel ou l'acteur explicite de rapprochement ; une identité vide est refusée. Les avoirs sont masqués aux administrateurs d'espace non propriétaires. **VÉRIFIÉ : 23 contrôles facturation et 11 remboursements/production**, avec base réelle et fournisseur simulé.
- **P2 — Pièces jointes silencieusement ignorées et protocole du modèle insuffisamment typé.** Une image absente ou supérieure à 5 Mio est rejetée avant appel et réservation ; un document non extrait est signalé comme indisponible. Les champs natifs du modèle, signatures et citations sont préservés par des schémas validés. **VÉRIFIÉ : 6 tests de pièces jointes, 4 de protocole et 16 d'intégration OpenRouter**, sans appel réel au modèle.
- **P2 — Contrôles CI incomplets et lint global en échec.** La nouvelle CI couvre chaque push/PR : types, lint sans avertissement, build et découverte des suites unitaires, services, artefacts et HTTP. Le runner retire les secrets hérités et bloque les connexions externes. Les erreurs de typage et de lint ont été corrigées sans désactiver les règles ni retirer de tests. **VÉRIFIÉ localement** ; exécution GitHub à confirmer après le push.
- **Interface incluse avec accord de l'utilisateur.** Statuts du chat pilotés par les vrais événements du flux, arrêt distinct de l'échec, conservation du texte interrompu, aperçu média et suivi d'une opération déjà approuvée sans second envoi. La résolution de `next/image` du serveur local et du test navigateur suit désormais le shim Vinext du build. **VÉRIFIÉ : 4 tests de statut et 7 scénarios React/Chromium**, desktop 1280×800 et mobile 390×844, réduction des animations, aucun débordement horizontal ni exception navigateur. Captures locales : `.tmp/agent-ui-browser/` (non versionnées).

### Vérifications et limites restantes

**VÉRIFIÉ :** typecheck, lint strict et build réussis ; 86 tests unitaires, 134 contrôles de services, 5 contrôles d'artefacts et 99 contrôles HTTP, plus 7 scénarios navigateur. Ces preuves utilisent des fixtures locales ; elles ne démontrent pas un parcours réel Meta/SasPay/Composio/fal.ai/Resend ni une restauration Cloudflare.

**Dépendances, 20 octobre 2026 :** `npm audit --omit=dev --json` signale 5 dépendances modérées, 0 élevée et 0 critique. Une seule alerte racine, le déni de service de `sprintf-js`, remonte via `argparse → js-yaml → gray-matter → @mastra/core` (peer de `@mastra/mcp`, amené par `@composio/anthropic`). Source : [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). Le registre npm indique `sprintf-js` 1.1.3 comme dernière version, encore concernée par l'avis. Aucun correctif publié vérifié : pas de faux override ni de migration majeure appliquée. Aïra n'importe pas Mastra et aucune occurrence de ces modules n'a été trouvée dans les fichiers JS du Worker construit ; cela réduit l'exposition observée sans prouver l'absence de tout risque. **P2 non corrigé :** suivre le correctif amont ou faire valider une évolution ciblée du provider, puis réauditer.

L'audit complet, outillage de développement inclus, retourne **19 dépendances signalées : 8 élevées, 9 modérées, 2 faibles, 0 critique**. Les 8 élevées remontent à [braces, épuisement de pile](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) via le lint et les plugins Vinext ; les autres avis de développement concernent notamment les versions imbriquées d'esbuild ([serveur de développement](https://github.com/advisories/GHSA-67mh-4wv8-2f99), [lecture de fichiers Windows](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)). L'esbuild directement utilisé par les tests est 0.28.2 ; cela ne corrige pas les copies imbriquées de l'outillage. npm propose notamment des retours majeurs vers `eslint-config-next` 14 et Vinext 0.0.15 : **non appliqués**, car ils changeraient la stack sans preuve de compatibilité. Les serveurs de test restent sur loopback. Ces avis ne sont ni corrigés ni acceptés pour une ouverture production : prévoir une mise à jour ciblée validée et un nouvel audit, sans `npm audit fix --force`.

**Toujours BLOQUÉ/NON VÉRIFIÉ avant ouverture payante :** secrets serveur et tarifs fournisseurs vérifiés, comptes sandbox, parcours Meta et permissions App Review, paiements/remboursements SasPay XAF réels en test, domaine et e-mail reçu, scheduler et alerte Cloudflare, restauration sur ressources dédiées, documents légaux et marge de 75 % mesurée. Instant reste bloqué sans catalogue de prix vérifié. Un push GitHub ne constitue pas une mise en production.

Commandes actuelles : `npm ci --include=dev --include=optional`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`. Instructions et test navigateur optionnel : `docs/testing.md`.

---

Date : 18 octobre 2026
Branche : `audit/2026-10-18`
Dépôt : `outputs/aira`
Périmètre : code, build et tests locaux ; aucune bascule live, aucun paiement/remboursement, e-mail, dépense média, publication publique ou modification DNS.

Les appels fournisseur des suites sont interceptés ou simulés. Les secrets n'ont pas été affichés. L'onglet Composio indique qu'une clé a été créée et copiée ; seule sa présence côté Aïra a été vérifiée, et `COMPOSIO_API_KEY` n'y est pas configurée. Je n'ai pas lu le presse-papiers.

## 1. Résumé exécutif

**Aïra n'est pas prête à recevoir des clients payants ni à gérer des campagnes en production.** Le socle local est substantiel et vérifié : build et types réussis, tests des routes, facturation, fichiers, Composio et missions. Les preuves externes manquent encore : comptes de test des fournisseurs, secrets serveur Aïra, domaine, validation Meta, coûts marchands réels et déploiement Cloudflare.

| Domaine | Note /10 | Motif |
|---|---:|---|
| Fonctionnel | 7 | Beaucoup de parcours locaux testés ; fournisseurs et campagnes réels non vérifiés |
| Sécurité | 6 | Isolation, approbations, fichiers et webhooks testés ; 5 avis modérés dans les dépendances de production, revue externe absente |
| Performance | 5 | Pas de test de charge ni mesure d'une vraie conversation avec le fournisseur |
| UX | 6 | Aperçu local consulté en lecture seule ; pas de test mobile/utilisateur complet |
| Qualité du code | 5 | Build/types/tests passent ; lint global échoue sur 141 erreurs |

Les cinq constats prioritaires :

1. J'ai corrigé un défaut de configuration : le build ne contenait aucun cron, car le Vite config utilisait le mauvais champ. Le manifeste généré inclut désormais le déclencheur et un test le protège ; le Worker distant reste à déployer.
2. La connexion au dashboard Composio ne configure pas Aïra : la clé est absente du serveur local et le compte publicitaire de l'utilisateur n'est pas connecté depuis Aïra.
3. Les intégrations OpenRouter, fal.ai, SasPay, Resend, Meta et Cloudflare n'ont pas passé de test externe de bout en bout. Aucune dépense réelle n'a été faite.
4. La cible de marge de 75 % n'est pas démontrée avec les coûts et frais réels. Les prix publics ne suffisent pas.
5. `npm run lint` échoue encore et l'audit NPM trouve des avis de sécurité, dont cinq modérés dans les dépendances de production.

## 2. Cartographie et état des fonctionnalités

| Fonctionnalité | Statut | Preuve | Action restante |
|---|---|---|---|
| Interface locale et navigation | FONCTIONNE | Aperçu `127.0.0.1:4180` inspecté en lecture seule ; build réussi | Tests responsive, accessibilité et parcours utilisateur |
| Chat et streaming OpenRouter | PARTIEL | 16 tests avec réponses simulées ; configuration locale présente sans en afficher les valeurs | Appel de test réel avec plafond de coût et rapprochement vérifiés |
| Connexion Composio et découverte | PARTIEL | 29 tests de politique, 8 tests du SDK, 6 tests HTTP ; l'API locale échoue proprement si la clé manque | Ajouter la clé comme secret serveur Aïra, connecter un compte test depuis Aïra et exécuter une lecture réelle |
| Skills Composio | PARTIEL | Test vérifie la conservation intégrale des résultats de recherche, dont les skills | Vérifier une réponse réelle sur compte autorisé |
| Meta Ads — lecture/Analytics | PARTIEL | Connecteur générique et garde-fous testés ; aucune requête Meta réelle | Configuration OAuth, droits/App Review et compte publicitaire de test |
| Meta Ads — créer/modifier/lancer | PARTIEL | Les écritures Composio demandent une approbation exacte côté serveur ; aucune action réelle testée | Parcours créatif → annonce → campagne → résultats avec actifs de test et budget nul/test |
| Créations fal.ai | PARTIEL | Politique de catalogue/coûts et réservation présentes ; clé absente et catalogue non validé | Mesurer les coûts/qualité et tester le rendu sur le compte fournisseur |
| Fichiers et aperçus | FONCTIONNE | 71 contrôles HTTP de téléversement/sécurité/rétention et 2 tests de bundles | Tester les quotas sur hébergement distant et la volumétrie réelle |
| Pages de destination | PARTIEL | 19 contrôles de publication, versions, consentement et isolation | `PAGES_ORIGIN`, compte actif et formulaire de bout en bout sur staging |
| Missions hors ligne | PARTIEL | 19 contrôles de checkpoint, révocation, concurrence et états incertains | Déployer le cron, configurer le modèle et tester une mission réelle bornée |
| Abonnements, recharges, crédits | PARTIEL | 21 tests de facturation et 11 de règlement/remboursement interne | SasPay sandbox, configuration fiscale et documents commerciaux |
| SasPay XAF, Mobile Money et carte | NON TESTABLE | Aucune clé/transaction de test ; devis et webhooks simulés | Activer le compte test et confirmer séparément pays, monnaie, moyens et frais |
| Remboursement et avoir | PARTIEL | Calcul, gel, écritures compensatoires et avoir testés ; pas de remboursement fournisseur | Confirmer la procédure manuelle ou une API disponible sur le compte SasPay |
| E-mails Resend | PARTIEL | 12 contrôles ops ; le transport est simulé et verrouillé par défaut | Domaine, expéditeur, destinataire, SPF/DKIM/DMARC et réception de test |
| Cron / tâches Cloudflare | PARTIEL | Build généré avec `triggers.crons`, D1/R2 ; test de manifeste réussi | Déployer sur le Worker Aïra et observer un déclenchement réel |
| Sauvegarde/restauration | PARTIEL | Archivage AES-GCM et restauration SQLite réels en test ; bucket R2 simulé | Deux buckets Cloudflare distincts et restauration sur staging |
| Marge de 75 % | NON TESTABLE | Moteur refuse les coûts absents ; sensibilité documentée, non assimilée à une preuve | Factures/taux réels, coûts par usage, taxes, frais, change et support |
| Export/suppression et conformité | NON TESTABLE | L'audit n'a pas validé les obligations de conservation, export/suppression et textes légaux | Décider/valider les règles applicables avant ouverture |

Écrans : chat, missions, tableau de bord, créations, fichiers, pages, campagnes, intégrations, compétences, paramètres et facturation. Routes incluses au build : workspace/chat, fichiers et uploads, ressources, pages/publications, propositions, Meta, connecteurs, facturation, remboursements/admin, webhooks SasPay, missions, santé et ticks internes. Modèles principaux : organisations/membres/rôles, ressources/conversations/messages, fichiers, connexions, tâches/missions, propositions, abonnements/commandes, journal et réservations de crédits, usage fournisseur, notifications et audits.

## 3. Vérifications exécutées

| Contrôle | Résultat | Niveau de preuve |
|---|---|---|
| `npm run build` | Réussi ; routes API et Worker produits | VÉRIFIÉ |
| `npx tsc --noEmit` | Réussi | VÉRIFIÉ |
| `node --test tests/*.test.mjs` | 68/68 réussis | VÉRIFIÉ |
| `npm run test:http-integration` | 22 contrôles API + 6 contrôles Composio HTTP réussis | VÉRIFIÉ, serveur/base temporaires, zéro appel fournisseur |
| `npm run test:file-upload-integration` | 71 contrôles réussis | VÉRIFIÉ, localhost et stockage temporaire |
| `npm run test:file-preview-bundle` | 2/2 réussis | VÉRIFIÉ après build |
| Facturation | 21 + 11 contrôles réussis | VÉRIFIÉ avec SasPay simulé, aucun débit/remboursement réel |
| Runtime et exploitation | 19 + 12 contrôles réussis | VÉRIFIÉ localement ; Resend/R2 simulés |
| Composio | 29 politiques + 8 contrats SDK + test navigateur sans clé | VÉRIFIÉ avec SDK réel intercepté ; aucun compte fournisseur utilisé |
| OpenRouter | 16 contrôles réussis | VÉRIFIÉ avec API simulée ; aucun appel payant |
| Économie / Instant | 4 tests économiques réussis ; Instant reste désactivé | VÉRIFIÉ par simulation ; marge réelle non vérifiée |
| Manifeste Worker | `triggers.crons=["*/5 * * * *"]`, binding `DB` et `BUCKET` | VÉRIFIÉ par build et `npm run test:worker-config` |
| `npm run lint` | ÉCHEC : 141 erreurs et 18 avertissements après exclusion des artefacts temporaires générés ; 136 erreurs `no-explicit-any` | VÉRIFIÉ |
| `npm audit --json` | ÉCHEC : 19 avis au total (8 élevés, 9 modérés, 2 faibles, aucun critique) | VÉRIFIÉ |
| `npm audit --omit=dev --json` | ÉCHEC : 5 avis modérés de production (aucun élevé/critique) | VÉRIFIÉ |
| `npm audit fix --dry-run` | 0 changement proposé par la simulation ; aucun correctif forcé appliqué | VÉRIFIÉ |

Les réponses de fournisseurs sont simulées dans toutes les suites. Les tests de sauvegarde utilisent SQLite/Web Crypto et un stockage simulé : ils ne prouvent pas une sauvegarde Cloudflare ou une réception Resend réelle. Le build vinext avertit que certaines routes ne sont pas classifiées statiquement ; le build finit néanmoins avec succès.

### Défauts corrigés

| Gravité | Symptôme et cause | Correctif | Test |
|---|---|---|---|
| P1 | Le manifeste Workers sortait `crons: []` : `vite.config.ts` utilisait une propriété `schedules` ignorée au niveau Worker | Configuration remplacée par `triggers.crons` | Nouveau `tests/worker-config.test.mjs` : cron et bindings vérifiés après build |
| P2 | Les ticks d'autonomie ont correctement été refusés avec 503, mais le nouveau test HTTP attendait 200 alors que l'autonomie est désactivée par défaut | Attendu corrigé vers `autonomy_not_ready` ; aucun garde-fou abaissé | `npm run test:http-integration` : 22 contrôles passent |
| P2 | Le test HTTP n'avait pas de lanceur isolé et pouvait écrire son résultat dans le projet | Lanceur dédié avec serveur, SQLite, configuration et fichiers temporaires ; clés fournisseur retirées de l'environnement de test | 22 API + 6 connecteurs HTTP passent sans fournisseur |
| P3 | ESLint inspectait des artefacts générés sous `.tmp` et `.wrangler` | Répertoires générés ignorés ; règles de lint sur le code source inchangées | Le lint donne un résultat source mesurable, mais reste en échec |

### Défauts non corrigés et dépendances bloquantes

- **P1 — Fournisseurs réels absents/non vérifiés.** Le relevé de présence local du 18 octobre confirme `OPENROUTER_API_KEY`, modèle et barème, mais aucun appel réel n'a été envoyé. `COMPOSIO_API_KEY`, fal.ai, SasPay, Resend et Meta restent absents d'Aïra. La clé affichée chez Composio ne passe pas automatiquement à l'application.
- **P1 — Campagnes.** L'agent peut découvrir des outils et préparer des écritures avec approbation exacte, mais aucun utilisateur, compte Meta, actif publicitaire, créatif ou campagne de test réel n'a été connecté/exécuté. App Review et permissions Meta restent inconnues.
- **P1 — Paiement et fiscalité.** Aucun checkout SasPay sandbox. Le compte marchand, frais, méthodes disponibles en XAF, taxe et remboursement externe doivent être confirmés. Aucun remboursement n'a été exécuté.
- **P1 — Production Cloudflare.** Le build produit le cron et les bindings, mais aucun Worker Aïra, secret, D1/R2 de staging, déclencheur distant, sauvegarde R2 ou restauration distante n'a été configuré/testé. La recherche « Aira » dans le compte Cloudflare connecté retourne « No projects found ».
- **P1 — Domaine, e-mail et support.** Le propriétaire a indiqué ne pas encore avoir de domaine ou d'adresse de test. SPF/DKIM/DMARC, réception d'un e-mail, alertes extérieures et canal support ne peuvent pas être validés.
- **P1 — Rentabilité.** La marge de 75 % n'est pas prouvée. `COST_SOURCES.md` et `margin-sensitivity.json` sont des sources/sensibilités, non des factures ni un coût constaté. Les coûts variables réels, taux de change, taxes, support et comportements d'usage manquent.
- **P1 — Fonctions produit bornées.** L'autonomie actuelle ne couvre que l'analyse, les lectures connectées et les brouillons privés ; une campagne ou mutation externe exige une confirmation séparée. Les pages exigent une origine dédiée et un abonnement actif.
- **P2 — Dépendances.** Cinq avis modérés de production suivent la chaîne `@composio/anthropic` → Mastra → `gray-matter` → `js-yaml` → `argparse` → `sprintf-js`. Un dry-run npm n'a modifié aucun paquet. Les 14 avis restants sont de développement. Voir `docs/production/DEPENDENCY_SECURITY.md`.
- **P2 — Lint.** 141 erreurs subsistent dans 20 fichiers, principalement `any` explicites ; 18 avertissements. Aucun skip ni assouplissement de règle n'a été ajouté. Ces erreurs n'ont pas toutes été corrigées car elles traversent de nombreux modules et exigent une campagne de typage dédiée.
- **P2 — Preuves absentes.** Aucun test de charge, audit WCAG complet, exercice de restauration cloud, alerte externe reçue, export/suppression complète ni revue externe OWASP n'a été réalisé.

## 4. Ce qu'il faut fournir ou décider

1. Définir l'environnement de staging Cloudflare Aïra (Worker, D1, R2 distincts) et y saisir les secrets depuis le gestionnaire serveur. Ne pas coller de clé dans le chat. Le dashboard Composio indique qu'une clé existe ; elle doit être ajoutée comme `COMPOSIO_API_KEY` au secret de staging, puis un compte publicitaire de test doit être connecté depuis Aïra. Pour un test local volontaire, la variable se lit depuis `.dev.vars`, mais le secret ne doit pas être commit.
2. Pour Meta : identifiants de l'application, URI de rappel et configuration d'authentification personnalisée Composio, puis approbations/scopes Meta requis et un compte/Page/compte publicitaire de test.
3. Pour fal.ai et OpenRouter : compte fournisseur, plafond de dépense de test et validation du barème du modèle par les factures/retours réels. Aucun appel payant n'a été fait.
4. Pour SasPay : accès sandbox, identifiants marchands, secret webhook, liste des méthodes activées, confirmation XAF/CM, tarifs et procédure de remboursement.
5. Pour e-mail : domaine contrôlé par le propriétaire, adresse d'expéditeur et destinataire de test ; ajouter DNS SPF/DKIM/DMARC seulement après choix du domaine.
6. Pour commercialiser : identité légale, validation de taxes/CGU/confidentialité/remboursement, canal de support et budget de gratuité.
7. Le code antérieur est poussé sur `origin/audit/2026-10-18` (`https://github.com/Braand-web/Aira.git`). Ce commit de mise à jour du rapport est local : le push a échoué car aucun identifiant GitHub exploitable n'est disponible dans cette session. Cela ne déploie pas l'application. Créer l'environnement Cloudflare Aïra et valider le staging avant tout déploiement live.

## 5. Manques et améliorations

| Manque | Impact | Effort | Priorité |
|---|---|---:|---:|
| Clés staging et tests réels Composio/OpenRouter/fal.ai | Fort | S | P1 |
| Meta OAuth/App Review et parcours campagne de bout en bout | Fort | L | P1 |
| SasPay sandbox, XAF, paiements et remboursements rapprochés | Fort | M | P1 |
| Déployer Worker Aïra, scheduler, D1/R2 et exercice de restauration | Fort | M | P1 |
| Domaine, e-mail test, alertes extérieures et support | Fort | M | P1 |
| Mesurer marge par offre avec coûts réels et usages extrêmes | Fort | M | P1 |
| Traiter cinq vulnérabilités modérées de production | Fort | M | P1 |
| Résorber erreurs lint et compléter les types | Moyen | L | P2 |
| Test de charge chat, fichiers, missions et facturation | Moyen | M | P2 |
| Audit WCAG et parcours mobile par des débutants | Moyen | M | P2 |
| Export/suppression et politique de conservation vérifiée | Fort | M | P1 |
| Rapprochement opérateur pour appels IA/media et remboursements incertains | Fort | M | P1 |

## 6. Feuille de route

| Quand | Action |
|---|---|
| Maintenant | Créer un environnement staging Aïra et y configurer les secrets ; connecter un compte Meta test ; valider les appels fournisseurs et leurs coûts sans publier de campagne |
| Ensuite | Tester SasPay sandbox, e-mail de test, tick Cloudflare, pages publiques et restauration sur ressources dédiées ; résoudre les avis production et calculer la marge réelle |
| Avant l'ouverture payante | Valider textes légaux/fiscaux, support, permissions Meta, toutes les routes financières, alertes, coûts par offre et seuil de 75 % |
| Plus tard | Corriger les erreurs lint, réaliser charge/WCAG/OWASP complets et développer la diffusion autonome uniquement dans les limites expressément approuvées |

## 7. Commandes de reprise

À exécuter dans le dépôt :

```powershell
npm ci
npm run build
npx tsc --noEmit
npm run lint
node --test tests/*.test.mjs
npm run test:http-integration
npm run test:file-upload-integration
npm run test:file-preview-bundle
npm run test:worker-config
node tests/billing.integration.mjs
node tests/production-billing.integration.mjs
node tests/production-runtime.integration.mjs
node tests/production-operations.integration.mjs
node tests/composio.integration.mjs
node tests/composio-sdk.integration.mjs
node tests/openrouter.integration.mjs
npm audit --json
npm audit --omit=dev --json
```

`npm run test:http-integration` et `npm run test:file-upload-integration` démarrent un serveur sur loopback avec base et fichiers temporaires. Les tests fournisseurs interceptent les appels. `npm run lint` est actuellement en échec (141 erreurs/18 avertissements) ; `npm audit` reste en échec jusqu'au traitement ou à l'acceptation documentée des avis. Le déploiement live n'est pas inclus dans ces commandes.
