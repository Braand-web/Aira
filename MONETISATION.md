# Aïra — état de livraison de la monétisation

## Fonctionnement livré

Le catalogue serveur versionné contient Pro (9 900 XAF / 30 jours, 99 000 XAF / an), Business (29 900 / 30 jours, 299 000 / an), les sept recharges et le calcul progressif de 50 à 10 000 crédits. Les devis durent quinze minutes. L’interface présente le total annuel, le renouvellement volontaire, le portefeuille et les paiements. `/pricing` donne accès aux tarifs ; `/?view=billing` ouvre le module dans le studio.

Le portefeuille utilise des centièmes de crédits entiers, des lots, un journal immuable et des réservations transactionnelles. Les crédits inclus expirent ; les recharges restent distinctes. Les réservations protègent les lots pendant une opération. Le reliquat d’un lot expiré est expiré après règlement. Les paiements, allocations, factures et soumissions médias utilisent des identifiants stables.

Les annuels sont distribués en douze allocations aux anniversaires calendaires UTC, avec ancrage de fin de mois. Le renouvellement anticipé commence après la dernière période payée. L’upgrade Pro vers Business conserve la fin de période et calcule un complément proratisé. Un changement acheté pour l’échéance produit une période future.

Les organisations, appartenances, accès par espace, invitations liées à un email, révocations et budgets sur trente jours glissants sont contrôlés côté serveur. La création de projets, le stockage, les transferts et la concurrence des réponses disposent de contrôles transactionnels. Les espaces secondaires passent en lecture seule sans Business. L’espace individuel historique est actuellement l’espace principal conservé.

Les appels Anthropic sont mesurés pour le maître et les spécialistes : entrées, sorties, cache et appels après outils. Une enveloppe est réservée avant la demande. Les tarifs et le change doivent être récents et configurés. Une consommation inconnue reste inconnue. Les échecs techniques de la réponse libèrent les crédits ; les coûts fournisseurs restent enregistrés pour Aïra.

Les générations fal.ai utilisent le même portefeuille et une approbation de version. Leur coût maximal doit être validé dans le catalogue. La facture réelle fournisseur reste à rapprocher : un plafond estimé n’est pas enregistré comme un coût observé certain.

L’intégration SasPay crée un checkout hébergé côté serveur et vérifie ensuite la session et sa transaction : marchand, référence interne, montant, monnaie, statut et frais déduits. La redirection du navigateur n’attribue rien. Un timeout de création conduit à rechercher une session existante, jamais à la recréer automatiquement. Les webhooks sont signés, conservés puis dédupliqués. Les devis dont l’abonnement a changé sont refusés.

Les factures sont des documents HTML téléchargeables, imprimables en PDF depuis le navigateur, avec total, taxes configurées et référence. Leur contenu enregistré est immuable. Une demande de remboursement gèle les lots concernés et bloque les allocations futures concernées jusqu’à résolution. Elle ne prétend pas avoir remboursé des fonds.

`/admin/billing` présente les conditions de lancement, les commandes, coûts connus/inconnus, remboursements demandés et événements à traiter. Son API est réservée à une liste d’identités administratrices côté serveur. Le rapprochement manuel ne recrée pas de paiement.

## Ce qui empêche encore une ouverture commerciale

Le module est livré avec les encaissements fermés. Il ne suffit pas de passer `BILLING_ENABLED` à `true`.

### Configuration et vérifications externes

- SasPay : clés distinctes, identifiant marchand, secret webhook, Mobile Money et carte activés, politique de frais déduits, frais réels et remboursements disponibles à confirmer sur le compte.
- Anthropic : identifiant exact du modèle disponible, clé, tarifs, taux de change et tests réels. Aucun accès à « Opus 5.5 » n’a été démontré par ces tests locaux.
- fal.ai : catalogue évalué et borné, coûts maximaux vérifiés, récupération des coûts réels et essais de génération.
- Identité légale, fiscalité, conditions de vente, confidentialité et conservation à valider. Aucun taux fiscal réel n’est présumé.
- Déclenchement planifié authentifié, webhook joignable hors session, messagerie transactionnelle et domaine public.
- Benchmark des neuf parcours, dix exécutions par parcours, acceptation client, coûts prudents, frais et support. La marge de 75 % est un contrôle prévisionnel, pas un résultat commercial déjà démontré.
- Test de restauration, charge, appareils mobiles, clavier et validation visuelle. La vérification navigateur de cette livraison a été bloquée par la limite d’usage de l’outil.

### Développements encore nécessaires pour tout le plan directeur

- Exécution monétaire des remboursements et rapprochement de leur confirmation ; avoirs, remboursements partiels, contestations et trop-perçus.
- Journal financier complet du revenu reconnu, engagements annuels, réserve de trésorerie, coûts variables de support/infrastructure/change et marge réalisée par cohorte. La console actuelle montre les consommations mesurées, pas une comptabilité complète.
- File durable des missions au-delà de la concurrence disponible. Actuellement, une réponse supplémentaire est refusée explicitement ; elle n’est pas mise en file automatiquement.
- Circuit d’approbation Business à seuil et sélection de l’espace principal avant réduction d’offre.
- Emails transactionnels et rappels selon les préférences. Les rappels sont pour le moment conservés en base.
- Hébergement public des pages, suspension à échéance, export intégral et suppression des médias à 90 jours après avertissements. Aucune purge automatique n’est activée sans règles validées.
- Collecte automatique du change et des tarifs, rapprochement des factures fournisseurs, reprise des coûts inconnus et tests de panne complets.
- Tests réels des permissions Meta, diffusion publicitaire et autonomie durable : ces fonctions ne sont pas vendues comme disponibles dans le module.
- Protection anti-abus de la gratuité au-delà de l’identité et du budget global ; le budget initial reste zéro.

## Paramètres serveur

Ne jamais mettre les secrets dans les fichiers suivis par Git, le navigateur ou un message de chat.

- `SASPAY_SECRET_KEY`, `SASPAY_MERCHANT_ID`, `SASPAY_WEBHOOK_SECRET`, `SASPAY_ENV` (`sandbox` ou `live`).
- `BILLING_LEGAL_JSON` : `name`, `address`, `taxId`, `email`, selon l’identité légale validée.
- `BILLING_ECONOMICS_JSON` : objets `pro` et `business`, chacun avec `taxBps`, `feeBps`, `feeFixed`, `unitCost` (minimum 4), `monthlyServiceCost`, `riskBps`. Un point de base vaut 0,01 %. Paramètres requis ; aucun exemple n’est un tarif marchand réel.
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_RATE_JSON` : `model`, `input`, `output`, `cacheWrite`, `cacheRead` en USD par million de tokens ; `cacheWriteHour` si utilisé ; `usdXaf`, `overheadXaf`, `verifiedAt` ISO récent. Les devis d’exécution réutilisent leur taux fixé.
- `FAL_KEY`, `FAL_CATALOG_JSON` : modèles avec schémas bornés, `credits`, `costCeilingXaf`, `verifiedAt`. Les coûts réels restent rapprochés séparément.
- `FREE_DAILY_CREDITS` : budget global journalier de gratuité, défaut 0.
- `BILLING_ADMIN_IDS` : identités du personnel financier séparées par des virgules. Être propriétaire d’une organisation cliente ne donne pas ce droit.
- `SCHEDULER_SECRET` : secret indépendant, requis pour `POST /api/internal/billing-tick` avec `Authorization: Bearer …`.

Les validations `BILLING_TAX_VALIDATED`, `BILLING_BENCHMARKS_VALIDATED`, `BILLING_SCHEDULER_VERIFIED`, `BILLING_PROVIDER_TESTS_PASSED`, `BILLING_SUPPORT_READY`, `BILLING_TERMS_APPROVED`, `BILLING_RESTORE_TESTED`, `BILLING_WEBHOOK_VERIFIED`, `BILLING_PRODUCT_ACCEPTANCE`, puis `BILLING_ENABLED` valent `true` uniquement après vérification documentée. Elles sont toutes fermées par défaut.

## Exploitation du planificateur

L’endpoint de traitement est prêt mais aucun déclencheur externe n’est déclaré comme installé. Le déclenchement doit être déterministe et indépendant d’un modèle IA. Il attribue les allocations dues, rapproche les commandes, traite les événements avec verrou temporaire, produit les rappels et détecte les réponses interrompues.

Un traitement doit être lancé et relu sans navigateur avant validation. Mesurer le temps et la charge ; les lots actuels sont limités à 25 commandes/événements et devront être partitionnés selon les quotas de l’hébergeur. Une absence de webhook ne suffit pas à conclure à un échec. Les sessions incertaines non retrouvées après une recherche bornée demandent une intervention.

## Validation effectuée

- Compilation TypeScript sur le projet avec l’environnement de vérification local.
- 24 tests unitaires : règles existantes, tarifs sur toutes les quantités autorisées, calendrier annuel, marge, prorata, HMAC et contraintes du journal.
- 18 tests d’intégration : services et routes réels, SQLite isolé, réponses SasPay simulées. Confirmation répétée/concurrente, mauvais montant monétaire/devise, timeout après création, allocations, renouvellement, upgrade, séparation des organisations, rôles, refus administrateur, expiration des réservations, quotas.
- Aucun paiement réel, appel Anthropic réel ni génération fal.ai réelle dans ces tests.
- Le test HTTP externe au processus n’a pas abouti dans l’environnement local. Ce résultat n’est pas présenté comme un succès.

Commandes : `node --test tests/core.test.mjs tests/billing.test.mjs`, `node tests/billing.integration.mjs` (esbuild nécessaire, `AIRA_TOOLCHAIN` peut indiquer un dossier de dépendances existant).

## Données et migrations

Les migrations SQL contiennent les garanties financières, contraintes et triggers. Les déclarations Drizzle fournissent les types ; elles ne remplacent pas ces garanties. Toute génération future doit être relue pour préserver les contraintes, triggers et index partiels. Ne jamais supprimer un journal pour annuler une opération financière.

La migration initiale reprend les espaces et soldes existants et conserve les réservations médias. Sauvegarder et vérifier les totaux avant application sur une base contenant des clients payants. Ne pas réécrire une migration déjà appliquée en production ; ajouter une migration corrective. Ne pas restaurer une ancienne base pour effacer un paiement réel.

## Sources fournisseur consultées

- [Checkout SasPay](https://docs.saspay.me/api-reference/payments/checkout-create)
- [Sessions existantes](https://docs.saspay.me/api-reference/payments/checkout-list)
- [Transaction](https://docs.saspay.me/api-reference/transactions/get)
- [Webhooks](https://docs.saspay.me/api-reference/webhooks)

La documentation guide l’intégration. Le contrat marchand et les essais de bout en bout restent à confirmer.
