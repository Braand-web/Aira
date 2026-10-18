# Audit Aïra — rapport final

Date : 18 octobre 2026  
Branche : `audit/2026-10-18`  
Périmètre : code et aperçu local uniquement. Aucun paiement, e-mail, SMS, appel OpenRouter/fal.ai/Meta ou accès à la production n’a été déclenché.

> Audit effectué exclusivement en local avec données temporaires et appels fournisseurs simulés. Aucun secret n’a été lu ou copié. L’aperçu utilisateur sur `127.0.0.1:4180` est resté actif.

## 1. Résumé exécutif

Aïra possède un socle testable de chat, d’outils, de fichiers, de pages privées, de créations fal.ai, d’analyses Meta en lecture et de facturation protégée par des barrières de lancement. Le dépôt décrit explicitement cette livraison comme une préversion : les paiements ne sont pas activés et les campagnes Meta ne peuvent pas être diffusées.

Le produit n’est pas prêt pour une ouverture commerciale complète en l’état. Le build et TypeScript passent ; 75 tests locaux passent avec fournisseurs simulés. Le lint échoue encore sur 156 erreurs de code source. Aucun paiement, appel réel au modèle, à fal.ai ou à Meta n’a été effectué. Les P1 liés aux remboursements, à fal.ai, à l’ordonnanceur et aux fonctions non livrées restent à traiter avant de vendre ces capacités.

| Domaine | Note provisoire /10 | Preuve |
|---|---:|---|
| Fonctionnel | 6 | VÉRIFIÉ sur les tests locaux/fournisseurs simulés ; diffusion et autonomie absentes |
| Sécurité | 7 | VÉRIFIÉ sur les tests d’isolation/auth et audit de dépendances de production ; revue de code statique pour le reste |
| Performance | 5 | DÉDUIT DU CODE ; aucune mesure de charge de cette session |
| UX | 7 | VÉRIFIÉ partiellement dans le navigateur local ; parcours commerciaux incomplets |
| Qualité du code | 6 | 75 contrôles réussis, build et types passent ; lint incomplet avec 156 erreurs |

### Cinq points clés

1. Les achats sont fermés côté serveur tant que les prérequis de lancement ne sont pas activés ; l’interface le dit aussi.
2. La création de campagne Meta, sa publication, l’autonomie persistante et l’hébergement public des pages ne sont pas implémentés.
3. La base de crédits, l’idempotence des commandes et la confirmation serveur SasPay sont déjà structurées, mais l’intégration réelle reste à certifier.
4. Les demandes de remboursement sont enregistrées et gèlent les crédits ; le remboursement fournisseur et le dégel après décision n’ont pas de parcours complet.
5. Les reprises d’opérations média après une réponse fournisseur incertaine et la planification durable demandent une vérification/correction avant d’engager des clients.
6. Aucun défaut P0 n’a été reproduit dans les parcours testés ; plusieurs risques P1 restent explicitement non résolus.

## 2. Cartographie fonctionnelle

| Zone | Statut | Preuve | Action restante |
|---|---|---|---|
| Chat et streaming du modèle | PARTIEL | VÉRIFIÉ : erreurs sans clé, flux natif et reprise simulés ; aucun appel réel au modèle | Tester le fournisseur en mode autorisé et vérifier reprise après coupure |
| Recherche, projets et historique | PARTIEL | VÉRIFIÉ sur création, lecture, renommage versionné et refus d’une ancienne version ; historique complet non couvert | Parcours de recherche, pagination et isolation multi-organisation complémentaires |
| Import et téléchargement de fichiers | PARTIEL | VÉRIFIÉ : aller-retour texte privé et refus d’un fichier à signature incorrecte sur HTTP local | Tester quotas d’espace/transfert et formats sur hébergement de test |
| Pages de destination | PARTIEL | DÉDUIT DU CODE ; brouillons structurés, aperçu isolé et export | Hébergement public, formulaires et conversions absents |
| Créations média fal.ai | PARTIEL | DÉDUIT DU CODE ; propositions approuvées, réservation et polling | Tester fournisseur fictif ; améliorer la reprise persistante des opérations incertaines |
| Meta Analytics | PARTIEL | DÉDUIT DU CODE ; OAuth et lectures de comptes/insights | Vérifier callback, droits réels et compte sandbox |
| Création/diffusion de campagnes Meta | NON IMPLÉMENTÉ | VÉRIFIÉ dans les capacités serveur (`publishing:false`) et textes de l’interface | Implémenter Marketing API et validation avant vente de cette fonction |
| Missions autonomes hors ligne | NON IMPLÉMENTÉ | VÉRIFIÉ dans les capacités serveur (`autonomy:false`) et textes de l’interface | Moteur durable, mandat, révocation, planification et tests de reprise |
| Marketplace publique de compétences | PARTIEL | DÉDUIT DU CODE ; compétences intégrées et candidates privées | Évaluation, promotion commune et retour arrière absents |
| Plans, recharges et crédits | PARTIEL | VÉRIFIÉ : tarifs, répartition annuelle, prorata, idempotence et réservations testés ; paiements réels désactivés | Certifier coûts réels, allocations hébergées, fiscalité et comptabilité |
| SasPay | NON TESTABLE | Aucun appel réel ou sandbox n’a été effectué ; configuration de lancement verrouillée | Valider XAF, pays CM, frais, signature, webhooks et moyens de paiement sur compte test |
| E-mail / notifications externes | NON IMPLÉMENTÉ | DÉDUIT DU CODE ; invitations présentées sous forme de lien, sans envoi e-mail | Ajouter un service et des modèles après décision explicite |
| Cron/planificateur hébergé | NON TESTABLE | Aucun déclencheur planifié visible dans la configuration du dépôt | Confirmer l’intégration planifiée et exécuter une reprise hors navigateur |

### Routes, données et dépendances

- **Écrans :** accueil/chat, `/pricing`, bibliothèque (créations, fichiers, pages, campagnes, projets, compétences), missions, Analytics, paramètres, espace de facturation/équipe et `/admin/billing`.
- **API :** `/api/chat`, `/api/workspace`, `/api/files`, `/api/resources/:id`, `/api/pages/:id`, `/api/proposals/:id`, `/api/meta`, `/api/meta/connect`, `/api/meta/callback`, `/api/billing/*`, `/api/admin/billing`, `/api/webhooks/saspay` et `/api/internal/billing-tick`.
- **Données :** organisations, espaces, membres, ressources/messages, runs/événements, opérations, connexions OAuth, abonnements, devis/commandes, remboursements, lots/réservations/journal de crédits, usage fournisseur, limites et audits. Les migrations SQL versionnées sont dans `drizzle/`.
- **Rôles :** owner, admin, editor, approver et reader, appliqués côté serveur ; l’intégration HTTP a vérifié les refus d’accès et l’isolation des espaces sur ses cas testés.
- **Fournisseurs :** OpenRouter ou Anthropic, fal.ai, Meta Graph API, SasPay, Cloudflare D1/R2 et identité fournie par Sites. Noms de configuration relevés uniquement : `OPENROUTER_*`, `ANTHROPIC_*`, `FAL_*`, `META_*`, `TOKEN_ENCRYPTION_KEY`, `SASPAY_*`, `BILLING_*`, `FREE_DAILY_CREDITS`, `SCHEDULER_SECRET`. Aucune valeur de secret n’a été lue ou copiée dans ce rapport.
- **Tâches de fond :** route de tick pour rapprochement, allocations et notifications ; aucun cron/horaire de déploiement n’est présent dans la configuration versionnée.
- **Code incomplet repéré :** le dépôt ne contient pas de marqueurs `TODO`/`FIXME` explicites dans les zones principales, mais les états de préversion et les fonctions manquantes sont documentés.
- **Déploiement/ops :** bindings Sites D1/R2 déclarés ; aucune configuration versionnée de CI/CD, surveillance, alerte ou sauvegarde restaurable n’a été trouvée. Ces éléments sont à vérifier sur le compte d’hébergement sans toucher à la production.

## 3. État de départ exécuté

Commandes lancées avant toute correction d’audit :

| Vérification | Résultat | Niveau de preuve |
|---|---|---|
| `npm run build` | ÉCHEC : dépendance `vinext` absente de `node_modules` | VÉRIFIÉ |
| `npm run lint` | ÉCHEC : exécutable `eslint` absent | VÉRIFIÉ |
| TypeScript initial avec configuration de vérification locale | RÉUSSI | VÉRIFIÉ |
| `node --test tests/*.test.mjs` | 25/25 réussis | VÉRIFIÉ |
| Démarrage du site | Aperçu local déjà disponible sur `127.0.0.1:4180` | VÉRIFIÉ lors du travail précédent ; non redémarré pour préserver la session |
| Test de paiement/fournisseur réel | Non lancé | NON TESTABLE volontairement dans le périmètre local sans appels externes |

Pas de script `npm test` n’est défini dans `package.json`. Après libération d’espace, les dépendances ont été installées et les contrôles complets ont pu être exécutés.

### Vérifications locales supplémentaires

- `npm run build` après les changements finaux : réussi — **VÉRIFIÉ**. Le rapport de build avertit que certaines routes API ne peuvent pas être classifiées statiquement par vinext ; cela n’a pas empêché le build.
- `npx tsc --noEmit` après les changements finaux : réussi — **VÉRIFIÉ**.
- `node --test tests/*.test.mjs` : 25/25 — **VÉRIFIÉ**.
- `tests/billing.integration.mjs` : 21 contrôles réussis avec SQLite en mémoire et SasPay simulé — **VÉRIFIÉ** ; aucun paiement ni appel fournisseur réel.
- `tests/openrouter.integration.mjs` : 16 contrôles réussis avec `fetch` simulé — **VÉRIFIÉ** ; aucun appel modèle réel.
- `tests/http.integration.mjs` : 13 contrôles réussis après les modifications, sur les vraies routes avec serveur local isolé et base SQLite temporaire — **VÉRIFIÉ**.
- `npm run lint` : échec sur 156 erreurs et 15 avertissements dans les sources : 151 `no-explicit-any` et 5 `react-hooks/set-state-in-effect`. Les bundles `.local-build` sont maintenant ignorés. Aucune règle de code source n’a été désactivée — **VÉRIFIÉ**.
- `npm audit --omit=dev --audit-level=high` : zéro vulnérabilité de dépendance de production — **VÉRIFIÉ**.
- `npm audit` complet : 20 avis résiduels dans la chaîne de développement (7 modérés, 13 élevés) — **VÉRIFIÉ**.
- Navigateur local : aperçu `4180` répond HTTP 200 ; l’arbre d’accessibilité montre l’accueil et l’ouverture du sélecteur accompagné/autonome. Aucun message n’a été envoyé — **VÉRIFIÉ**.
- `GET /api/billing/catalog` et `GET /api/billing/price?quantity=150` sur `127.0.0.1:4180` : 200, paiements fermés, devise XAF, 7 packs et prix de 7 250 XAF — **VÉRIFIÉ**.
- L’instance de test `127.0.0.1:4176` a été arrêtée ; l’aperçu utilisateur `127.0.0.1:4180` n’a pas été arrêté ni redémarré. Le client `.local-build/app.js` partagé a été rebâti depuis les sources pour les tests ; la page 4180 n’a pas été rechargée pendant l’audit.

Le total des contrôles réussis est de 75 (25 unitaires, 21 facturation, 16 OpenRouter simulés et 13 HTTP). Les données HTTP ont été stockées dans un répertoire temporaire distinct.

## 4. Défauts et risques relevés

### [P1] Une génération fal.ai incertaine peut rester bloquée

- **Symptôme :** une réservation peut rester immobilisée après une réponse incertaine du fournisseur.
- **Cause :** l’API marque l’opération `needs_reconciliation`, mais le polling ne reprend que `waiting_external` et `settling`. Aucun réconciliateur fal.ai n’est présent dans `tick()`.
- **Preuve :** DÉDUIT DU CODE dans `app/api/proposals/[id]/route.ts`, `lib/billing.ts` et `lib/providers.ts` ; test d’incident restant à ajouter/exécuter.
- **Correctif :** à décider après test isolé ; la récupération d’un identifiant fournisseur non enregistré exige une stratégie d’idempotence compatible fal.ai.

### [P1] Le remboursement client ne va pas jusqu’à la résolution

- **Symptôme :** l’utilisateur peut demander un remboursement, mais aucun bouton/endpoint d’administration ne peut approuver, rejeter, rembourser via SasPay ou libérer le portefeuille après rejet.
- **Cause :** l’interface et l’API ne gèrent que la création d’une demande et le gel des crédits.
- **Preuve :** DÉDUIT DU CODE dans `lib/billing.ts`, `app/api/admin/billing/route.ts` et `app/admin/billing/page.tsx`.
- **Correctif :** terminer un processus manuel audité ou une intégration de remboursement vérifiée avant de vendre les offres. Aucun mouvement de fonds ne sera ajouté sans contrat fournisseur confirmé.

### [P1] Les tâches périodiques ne sont pas reliées à un ordonnanceur visible

- **Symptôme :** les webhooks sont stockés durablement, mais leur traitement, les rappels d’échéance et le rapprochement automatique dépendent d’un appel à `billing-tick`.
- **Cause :** aucune configuration de cron n’est visible dans le dépôt ; la route existe et attend un secret.
- **Preuve :** VÉRIFIÉ par recherche de configuration et DÉDUIT DU CODE ; environnement d’hébergement non accessible dans cet audit.
- **Correctif :** confirmer un ordonnanceur fiable, surveillé et sécurisé puis tester les tâches après arrêt du navigateur.

### [P1] L’intégration de paiement XAF n’est pas certifiée

- **Symptôme :** la plateforme annonce FCFA/XAF et `country: CM`, mais aucune requête n’a confirmé que le compte SasPay du marchand accepte cette combinaison, les frais et les moyens Mobile Money/carte souhaités.
- **Cause :** cette validation dépend du compte marchand et du sandbox fournisseur.
- **Preuve :** NON TESTABLE ici. La documentation publique SasPay fournit un exemple de checkout en XOF et explique que `fee_charge_mode` dépend d’un réglage marchand ; cela ne prouve ni ne réfute l’acceptation de XAF pour ce compte. [Checkout SasPay](https://docs.saspay.me/api-reference/payments/checkout-create)
- **Correctif :** tester un paiement en mode test et confirmer les frais, le pays, les méthodes et la signature webhook avant d’ouvrir le verrou.

### [P1] Plusieurs fonctions prévues ne sont pas livrées

- **Symptôme :** lancement des publicités Meta, hébergement public de pages et missions autonomes ne sont pas disponibles.
- **Cause :** ces modules ne figurent pas encore dans l’implémentation actuelle.
- **Preuve :** VÉRIFIÉ par les flags `publishing:false`, `autonomy:false` et l’interface.
- **Correctif :** ne pas les inclure parmi les capacités commerciales tant que les modules et leurs contrôles ne sont pas terminés.

### [P2] Le rapprochement OpenRouter peut ralentir le début d’une conversation

- **Symptôme :** un nouvel envoi attend le rapprochement séquentiel d’anciennes consommations fournisseur avant d’ouvrir le flux.
- **Cause :** `startRunBudget()` attend jusqu’à cinq appels `generationCost()` ; chacun peut attendre jusqu’à huit secondes.
- **Preuve :** DÉDUIT DU CODE dans `lib/metering.ts` et `lib/llm.ts` ; mesure chronométrée à faire avec `fetch` simulé.
- **Correctif :** déplacer le rapprochement vers une tâche de fond fiable ou réduire sa latence sans autoriser une nouvelle dépense hors plafond.

### [P2] Certains coûts OpenRouter sans identifiant fournisseur peuvent rester à rapprocher

- **Symptôme :** une réponse livrée sans `X-Generation-Id` peut garder la réservation de crédits en attente indéfiniment.
- **Cause :** les lignes `estimated/unknown` sans `request_id` ne sont pas sélectionnées par `reconcileOpenRouterUsage()`.
- **Preuve :** VÉRIFIÉ par le cas `missing_id` de `tests/openrouter.integration.mjs` : la réservation reste en rapprochement sans identifiant ; le test libère ensuite le solde uniquement pour nettoyer sa base isolée.
- **Correctif :** définir une règle bornée de rapprochement manuel ou de libération, avec audit et information utilisateur.

### [P2] Le contrôle quotidien de conversations annoncé dans le document n’existe pas dans les routes

- **Symptôme :** `IMPLEMENTATION.md` annonce une limite de 20 tours par utilisateur et par jour, mais aucun compteur de tours correspondant n’est appliqué par `/api/chat`.
- **Cause :** la réservation de crédits borne le coût par solde, mais ne matérialise pas cette limite quotidienne.
- **Preuve :** VÉRIFIÉ par recherche des routes et DÉDUIT DU CODE ; le document du dépôt mentionne lui-même que le contrôle doit devenir atomique avant usage public.
- **Correctif :** soit implémenter un quota atomique cohérent avec l’offre, soit corriger le texte produit avant ouverture commerciale.

### [P2] La suppression d’un fichier peut désynchroniser R2 et D1

- **Symptôme :** si la suppression de l’objet R2 réussit puis l’écriture D1 échoue, la ressource peut rester visible alors que son fichier a disparu.
- **Cause :** `/api/files` supprime d’abord le blob et marque ensuite la ressource comme supprimée ; aucun processus de réconciliation des suppressions n’est présent.
- **Preuve :** DÉDUIT DU CODE dans `app/api/files/route.ts` ; panne D1 non simulée.
- **Correctif :** rendre la suppression récupérable par état/outbox et réconciliation, puis ajouter un test de panne entre les deux opérations.

### [P2] Une connexion Meta expirée reste affichée comme active

- **Symptôme :** `workspace` traite la présence d’une ligne de connexion comme `metaConnected`, même si `expires_at` est dépassé ; `metaToken()` refuse ensuite les lectures avec 412. L’écran peut continuer à présenter la connexion comme active.
- **Cause :** l’expiration est contrôlée lors de l’appel fournisseur, mais pas dans l’état de capacité envoyé au client ; aucun renouvellement automatique de jeton n’est présent.
- **Preuve :** DÉDUIT DU CODE dans `app/api/workspace/route.ts` et `lib/providers.ts` ; aucune session Meta réelle utilisée.
- **Correctif :** exposer l’état expiré et proposer une reconnexion explicite, puis valider sur un compte test.

### [P2] Les rappels d’abonnement ne sont pas visibles pour le client

- **Symptôme :** `tick()` écrit des lignes de notification, mais aucune route ou surface UI n’affiche ou ne marque ces notifications comme lues ; aucun e-mail n’est envoyé.
- **Cause :** modèle de données de rappel présent sans canal de livraison et sans ordonnanceur confirmé.
- **Preuve :** DÉDUIT DU CODE (`billing.ts`, `BillingPanel` et routes API) ; parcours de notification absent.
- **Correctif :** ajouter une boîte de notifications et/ou un canal transactionnel une fois l’ordonnanceur et les préférences utilisateur définis.

### [P2] La chaîne de développement conserve des avis de sécurité

- **Symptôme :** l’audit NPM complet trouve 20 avis (7 modérés, 13 élevés), principalement dans Vite, Cloudflare Vite Plugin, Wrangler, vinext, RSC et leurs dépendances.
- **Cause :** les versions actuelles de la chaîne sont fixées ensemble ; plusieurs corrections NPM demandent des mises à jour en dehors des versions déclarées ou une évolution plus large de l’outillage.
- **Preuve :** VÉRIFIÉ par `npm audit` après mise à jour de Next.js et des dépendances compatibles, y compris sharp 0.35.5. `npm audit --omit=dev` ne trouve aucun avis.
- **Correctif :** planifier une mise à jour isolée de l’outillage de développement, avec build et tests Cloudflare/Vite ; aucun `--force` n’a été utilisé.

## 5. Défauts corrigés pendant l’audit

- **P2 — état faux de disponibilité de l’IA :** `modelReadiness()` distingue désormais clé absente, tarif à vérifier, tarif invalide et configuration opérationnelle. `/api/workspace` transmet cet état et l’interface ne marque Opus opérationnel que si la clé et les tarifs sont valides. Le test OpenRouter couvre les trois états et le test HTTP confirme l’état sans clé. Le fournisseur n’a pas été appelé.
- **P2 — lint de compétence :** renommage du callback `useSkill` en `applySkill`. Ce callback n’utilise aucun Hook React ; le nom trompeur déclenchait une erreur `rules-of-hooks`. Le build passe et cette erreur a disparu du lint.
- **P2 — lint de bundles :** `.local-build/**` est exclu du lint parce qu’il s’agit d’un bundle généré ; les sources restent soumises aux mêmes règles.
- **P1 sécurité dépendances production :** mise à jour non majeure de Next.js de `16.3.4` à `16.4.2`, mises à jour transitives compatibles et correctif sharp `0.35.5`. L’avis critique a disparu ; l’audit NPM de production est à zéro. Le build et les tests passent après mise à jour.
- Les fichiers `app/studio.tsx`, `app/api/workspace/route.ts`, `lib/metering.ts` et `tests/openrouter.integration.mjs` avaient déjà des changements non commités avant l’audit. Ils ont été conservés ; les corrections d’audit qui les touchent restent dans le worktree pour éviter d’inclure ces modifications antérieures dans un commit. `tests/http.integration.mjs` était propre et ne contient que l’assertion de non-régression ajoutée ici.

## 6. Ce qui reste nécessaire

- Configuration et compte de test SasPay pour vérifier XAF, pays CM, Mobile Money/carte, frais et webhooks. Aucun paiement réel ne sera lancé.
- Accès de test Meta pour valider OAuth et lectures ; la diffusion publicitaire reste hors périmètre tant qu’elle n’est pas implémentée.
- Confirmation de l’ordonnanceur disponible dans l’hébergement, sans activation de production.
- Validation légale/fiscale, textes de facturation et politique de remboursement avant toute ouverture des paiements.
- Une décision pour la mise à niveau de la chaîne Vite/Cloudflare/Wrangler, si l’ouverture commerciale inclut la chaîne de développement administrée par votre équipe.

## 7. Manques et améliorations

| Amélioration | Impact | Effort | Priorité |
|---|---|---:|---:|
| Réconciliateur fal.ai durable avec récupération des opérations incertaines | Fort | M | P1 |
| Décision de remboursement avec gel/dégel, écriture d’audit et rapprochement SasPay | Fort | M/L | P1 |
| Cron contrôlé pour webhooks, commandes, allocations et notifications | Fort | M | P1 |
| Validation XAF/CM, frais et moyens de paiement sur sandbox SasPay | Fort | S/M | P1 |
| Diffusion publicitaire Meta, approbation versionnée, budgets et suivi d’événements | Fort | L | P1 |
| Missions durables hors ligne, mandat, arrêt/révocation et reprise après crash | Fort | L | P1 |
| Rapprochement d’OpenRouter sans identifiant et sans coût final affiché comme confirmé | Fort | M | P1 |
| Export/suppression du compte, politique de rétention et suppression planifiée des médias | Fort | M | P1 |
| Pages publiques isolées, formulaires et suivi de conversions validées | Fort | L | P1 |
| En-têtes de sécurité, limitation de débit serveur et vérification des protections de déploiement | Moyen/Fort | M | P2 |
| Réconciliation des suppressions R2/D1 et test de panne intermédiaire | Fort | M | P2 |
| Aligner le quota journalier annoncé avec le vrai comportement de `/api/chat` | Moyen | S/M | P2 |
| Détecter les jetons Meta expirés et permettre la reconnexion claire | Moyen | S | P2 |
| Afficher et distribuer les rappels d’échéance | Moyen | M | P2 |
| Mettre à jour la chaîne Vite/Cloudflare/Wrangler avec tests de compatibilité | Moyen/Fort | M/L | P2 |
| Tableau de marge avec revenus bruts/nets, taxes, frais réels et crédits à servir | Fort | M | P2 |
| Tests de charge, restauration D1/R2, alertes et file d’échecs opérable | Fort | M/L | P2 |
| Pagination/recherche serveur et rétention des messages/événements | Moyen | M | P2 |
| Onboarding et invitations d’équipe avec e-mail transactionnel | Moyen | M | P2 |
| Audit WCAG complet et test utilisateur débutant sur mobile | Moyen | M | P2 |

## 8. Feuille de route

| Quand | Action |
|---|---|
| Maintenant | Concevoir la reprise durable fal.ai, un parcours complet de remboursement et l’ordonnanceur ; garder ces fonctions non commercialisées tant qu’elles ne sont pas vérifiées |
| Ensuite | Valider SasPay/XAF sur sandbox ; traiter les coûts OpenRouter sans identifiant ; corriger quota quotidien, expiration Meta et notifications |
| Avant production commerciale | Vérifier fiscalité, contrats, restauration D1/R2, surveillance, budget de marge et permissions Meta ; exécuter les parcours avec comptes de test |
| Plus tard | Mettre à niveau l’outillage Cloudflare/Vite/RSC avec campagne de compatibilité ; livrer campagnes Meta, autonomie durable, pages publiques et conversions |

## 9. Commandes de reprise

```powershell
cd "C:\Users\Braand\Documents\Codex\2026-10-15\https-lovable-dev-blog-introducing-growth\outputs\aira"
npm run install:ci
npm run build
npm run lint
npx tsc --noEmit
node --test tests/*.test.mjs
node tests/billing.integration.mjs
node tests/openrouter.integration.mjs
```

`tests/http.integration.mjs` exige un serveur local de test sur `127.0.0.1:4176`, une valeur `AIRA_DATA_DIR` dans un dossier `%TEMP%` neuf et `AIRA_TEST_URL=http://127.0.0.1:4176`. Exécuter le script depuis un dossier temporaire pour que `verification-api.json` n’écrase pas un fichier du projet. Les clés OpenRouter doivent rester vides pour ce test ; les réponses fournisseurs sont simulées.
