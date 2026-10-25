# Audit et renforcement du harness agentique — 24 octobre 2026

> Mise à jour après l'audit : à la demande du propriétaire, la migration `0015_agent_harness.sql` a été appliquée et vérifiée sur D1 distante `braand-staging` le 24 octobre 2026 à 09:16:34 UTC : 16 migrations, quatre tables et deux index présents, aucune anomalie de clé étrangère ni migration en attente. Les mentions de migration distante non effectuée ci-dessous décrivent l'état initial de l'audit. Le runtime a ensuite été déployé en staging privé, version `6f4aa0ee-abe9-4405-978b-a262af34978e` active à 100 % ; huit contrôles du bundle en preview distante passent, sans génération IA. Voir `production/STATE.md` et `production/STAGING_2026-10-24.md`.

## Portée et référence

Référence auditée : `ad41c5f` sur `feat/global-workflow`, dépôt Braand-web/Braand. Le code réel est la référence, et non les captures de démonstration. L'audit préalable et les priorités ont été présentés dans la conversation avant les modifications. Le SaaS, la stack Workers/D1/R2, les offres, les routes métier et les droits sont conservés. Aucun déploiement, migration distante, paiement ni appel fournisseur facturé n'a été effectué pour cette évolution.

Les validations ci-dessous portent sur le runtime local avec SQLite réelle, des transports de modèles et de fournisseurs simulés, et Chromium. Elles ne prouvent ni l'intelligence d'un modèle en production ni une qualité métier universelle.

## Architecture constatée avant modification

`lib/agent.ts` laissait déjà le modèle choisir ses outils et cinq rôles : creative, campaigns, extraction, analysis et review. Il existait une limite de trois délégations par réponse et de huit tours d'outils, suivis d'un bilan sans outils. Le routage serveur sélectionnait les modèles et leurs tarifs configurés ; le modèle ne choisissait pas librement un identifiant ou une URL.

`lib/durable-missions.ts` possédait déjà des mandats approuvés, verrous, étapes persistantes, réservations, rapprochement, expiration, annulation et validation humaine des preuves. `lib/composio.ts` et le navigateur avaient leurs propres contrôles d'identité, d'approbation, d'actions incertaines et de permissions. Ce socle a été réutilisé.

Points confirmés dans le code et par tests ciblés :

- Le worker durable appelait `runAgent` sans politique spécifique ; la valeur par défaut était `accompanied`. Ce constat n'établit pas un contournement des gardes existantes, mais exposait une surface d'outils trop générale.
- L'historique était chargé par une limite fixe de 40 messages. La mémoire d'entreprise existait déjà ; elle ne constituait pas une synthèse persistante des décisions d'une longue conversation.
- Les spécialistes retournaient surtout du texte, avec droits bornés mais sans contrat systématique de critères et de statut.
- Les huit tours étaient une protection utile, pas un bug à supprimer. Les résultats partiels existaient, mais le plan et la compaction ne disposaient pas de checkpoints propres.
- La découverte des skills était lexicale. Le catalogue révisé et sa lecture progressive existaient déjà.
- Les ressources pouvaient être relues et les étapes humaines acceptées, mais les livrables ne recevaient pas systématiquement un reçu structurel indépendant et versionné.
- Le routage multi-modèle et la facturation disposaient de tests locaux. Leur configuration réelle, leurs coûts et leurs générations ne sont pas validés par cet audit.

Priorités retenues : séparer l'exécution d'un mandat approuvé, persister plans/contexte/reçus, structurer les collaborations, vérifier les artefacts, puis fiabiliser le streaming sans modifier l'identité visuelle. Risques anticipés : inflation du contexte et des coûts, nouvelles tables requises, blocage prudent d'une reprise ambiguë, interprétation abusive du mot « vérifié » et régression du rendu mobile.

## Améliorations livrées et preuves

### Le modèle décide, le serveur garde le contrôle

Fichiers : `lib/agent.ts`, `lib/agent-work-policy.ts`, `lib/agent-mode.mjs`, `lib/durable-missions.ts`, `lib/metering.ts`.

Le contrat de travail explicite comprendre, planifier si nécessaire, agir, observer, adapter, vérifier et livrer. Il n'impose pas de plan à une question simple et n'ajoute aucun routage d'intention par mots-clés. Le modèle choisit un plan, une méthode et un spécialiste. Le serveur valide schémas, outils, droits, modèles autorisés, tarifs, budget et état courant.

Le worker passe explicitement `approved_mission`. Cette politique permet les opérations internes autorisées, mais n'expose pas les connecteurs externes bruts ni les actions du navigateur. Une proposition média reste soumise à son approbation distincte. Le client ne peut pas demander ce mode dans POST `/api/chat`. Le mandat est revérifié avant chaque outil et chaque appel modèle, y compris les appels spécialistes partageant le budget.

Preuves : scénarios conversation simple, client autonome limité aux lectures/brouillon, worker avec politique explicite, annulation, expiration, droits révoqués, dépassement de budget et état fournisseur incertain. Les validations humaines existantes des étapes sont conservées. Une réponse reste limitée à huit tours ; la continuation exige un mandat et un budget autorisés. Ce n'est pas une boucle automatique illimitée.

### Plans, dépendances et reçus persistants

Fichiers : `lib/agent-state.ts`, `lib/agent-receipts.ts`, `drizzle/0015_agent_harness.sql`, `lib/agent.ts`.

`update_work_plan` persiste un plan versionné de 20 étapes maximum. Cycles, dépendances absentes, versions périmées et déclarations d'étapes vérifiées sans artefact contrôlé sont refusés. Le plan peut être adapté par le modèle ; ses critères ne sont pas des autorisations d'exécution.

Les mutations locales éligibles prennent un reçu avant le travail. Un résultat confirmé peut être réutilisé ; un reçu pending/uncertain bloque sa répétition. Les actions externes conservent leurs protocoles existants et ne sont jamais rejouées par ce mécanisme. Les résultats d'outils historiques manquants ne sont reconstruits qu'à partir de reçus locaux confirmés. Une action sans preuve, même ancienne et sans run_id, bloque la continuation au lieu de disparaître du contexte.

Preuves : persistance SQLite, versions, cycles, doublon local, interruption avant confirmation, notification échouée après écriture et restauration du reçu sans nouvelle exécution. Les métadonnées de plan ne constituent pas une transaction d'approbation externe ; les gardes métier atomiques existantes restent la frontière d'exécution. Une ambiguïté réelle peut nécessiter une réconciliation humaine.

### Spécialistes configurables dans le même runtime

Fichiers : `lib/agent-specialists.ts`, `lib/agent.ts`.

Six profils réutilisent les cinq rôles : Growth Strategist, Ads Strategist, Community Manager, Creative Director, Research Analyst et Quality Reviewer. Aucun moteur indépendant supplémentaire ni droit supplémentaire n'est créé.

Chaque délégation conserve objectif/contexte, références, outils effectifs, plafond, livrable attendu et critères. Le contrat explicite borne les outils par intersection avec ceux du rôle et le sous-budget par le plafond parent. Les anciens appels restent compatibles et produisent une enveloppe partielle avec critères non vérifiés. Les nouveaux rapports valident un JSON et exactement un contrôle par critère ; une seule correction de format est possible. Les statuts distinguent prêt pour revue, partiel, attente d'approbation et échec. Aucun rapport n'affirme une exécution vérifiée.

Preuves : cinq rôles existants, profil incompatible rejeté, capacité interdite refusée, trois spécialistes maximum, escalade bornée, sous-budget partagé et contrat structuré. Les appels modèles partageant une réservation restent sérialisés pour préserver la comptabilité. Seules les lectures indépendantes sans appel modèle sont parallélisées, par groupes de trois, avec résultats remis dans l'ordre et dédupliqués en cas d'échec de notification.

### Mémoire à trois niveaux et langues

Fichiers : `lib/agent-context.ts`, `lib/agent-state.ts`, `lib/skills/discovery.mjs`, `lib/skills/registry.ts`, `lib/skills/policy.mjs`, `lib/browser-agent.ts`.

1. Contexte immédiat : jusqu'à 160 lignes récentes, regroupées en tours complets, avec un poids textuel limité à 48 000 caractères. Les grands résultats historiques deviennent des extraits explicitement signalés. Les blocs de pensée/signatures restent intacts. Les images privées sont conservées ; leur poids est compté séparément de leur base64. Le compteur de coût du modèle reste l'autorité finale.
2. Contexte persistant : le modèle peut enregistrer synthèse, décisions, tâches ouvertes, langue et références dans un checkpoint versionné, avec provenance de conversation, frontière d'historique et horodatage. La mémoire de faits d'entreprise existante, avec correction/retrait explicites, reste disponible.
3. Récupération ciblée : recherche d'extraits de la conversation et de connaissances du workspace, IDs sémantiques choisis par le modèle et secours lexical Unicode. Une lecture ne permet pas de franchir le périmètre du tenant. Les reçus privés des connecteurs sont exclus des lectures génériques du modèle et des références spécialistes ; les routes client conservent l'accès du demandeur seulement.

Le modèle choisit les méthodes par leur sens dans les descriptions du catalogue, puis fournit `semanticIds`. Il ne s'agit pas d'un index d'embeddings ni d'un moteur vectoriel. Aucun fournisseur sémantique supplémentaire n'est requis et les guides complets ne sont pas chargés systématiquement. La compaction est demandée au modèle via un outil ; elle n'est pas une synthèse automatique payante. Si un tour seul dépasse la limite ou si une reprise est ambiguë, le système échoue explicitement.

La réponse suit la langue demandée, préserve noms et devises et ne dépend pas de mots-clés français/anglais. Tests avec français, anglais, arabe et chinois ; ils valident le contrat et les caractères, pas la compréhension de toutes les langues par chaque modèle. Aucun système de voix/traduction universelle n'est annoncé.

### Vérification indépendante et statut réel

Fichiers : `lib/agent-state.ts`, `lib/agent.ts`, `lib/agent-status.mjs`.

`verify_deliverable` relit la ressource et sa version réelle, valide type, statut, contenu/schema, présence des sources demandées et dépendances. Une création/révision de page ou de rapport déclenche automatiquement ce contrôle déterministe sans appel modèle supplémentaire. Un média « ready » sans URL exploitable échoue. Une révision invalide l'usage d'une preuve d'une version antérieure.

Le reçu indique `structurally_verified` ou `partial`, `semanticReview: required` et `executionConfirmed: false`. Le Quality Reviewer apporte une critique distincte lorsque le modèle le choisit. Son avis n'est ni une preuve de publication ni une validation de chaque chiffre/source. L'atteinte sémantique des critères, l'exactitude des sources et les actions externes exigent leurs contrôles dédiés. Le mot « verified » d'une étape du plan décrit donc la vérification structurelle disponible, pas une certification métier globale.

### Streaming et fluidité sans refonte

Fichiers : `lib/agent-events.ts`, `lib/chat-recovery.ts`, `lib/core.mjs`, `app/api/chat/route.ts`, `app/studio.tsx`, `components/agents/streaming-markdown.tsx`.

Le premier fragment de texte est transmis immédiatement. Les suivants sont groupés pendant au plus 40 ms ou 256 caractères et vidés avant chaque frontière d'événement. L'ordre et le texte sont préservés ; chaque événement transmis possède son identifiant persistant. Le client reprend seulement la lecture des événements manquants d'un run identifié, sans nouveau POST ni appel modèle, pendant une fenêtre bornée de 20 lectures/10 secondes hors latence réseau. Il ne s'agit pas d'une reprise automatique après fermeture complète de l'onglet.

L'arrêt annule immédiatement le flux client puis demande l'annulation serveur. Une fin ne peut pas écraser un statut cancelled ; les fragments partiels sont conservés et les ressources confirmées restent disponibles. Les identifiants d'événements et de ressources évitent les doublons. Le heartbeat entretient aussi le verrou de conversation. Les statuts de travail reflètent les événements réels ; les mesures `model_observed` enregistrent durée, première sortie texte et nombre d'outils, sans progression fictive.

Le Markdown est rendu par blocs mémorisés et échappés, avec titres, listes, code et liens HTTP(S) contrôlés. Pas de HTML brut. Les blocs de code longs reviennent à la ligne sur mobile. Les brouillons, sélections, navigation, scroll, panneau et compositeur existants sont conservés. Pas de nouvelle animation.

## Évaluations et mesures reproductibles

La référence initiale comprend 72 contrôles ciblés réussis : 27 agent-routing, 27 production-runtime, 7 skills-agent et 11 model-routing. Leur durée cumulée de processus était 1 422 ms sur la machine locale ; ce n'est pas une latence IA.

Après modifications : `npm test` réussit avec 176 tests unitaires, 18 fichiers d'intégration, 4 suites d'artefacts et 2 lanceurs HTTP. Parmi eux : 40 contrôles agent-routing, 27 production-runtime, 11 model-routing, 16 OpenRouter, 7 skills-agent ; les lanceurs HTTP vérifient 22 parcours API, 6 connecteurs et 71 contrôles fichiers signés. Ne pas additionner ces nombres aux groupes comme s'il s'agissait de catégories disjointes.

`npm run typecheck`, `npm run lint`, `npm run build` et les 40 contrôles Chromium agent-ui réussissent. Tests navigateur avec React réelle, serveur de fixtures et réseau fournisseur bloqué ; desktop 1280×800, tablette 768×1024, mobile 390×844, clavier/réduction du mouvement et absence d'erreur non gérée. Le contrôle mobile vérifie aussi la largeur intérieure du code, car la largeur de page seule ne détectait pas son débordement.

Commandes reproductibles :

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test`
- `node --import ./tests/offline-network.mjs tests/agent-routing.integration.mjs`
- `node --import ./tests/offline-network.mjs --test tests/agent-flow.test.mjs`
- `node tests/agent-ui.browser.mjs` avec Playwright disponible ou `BRAAND_PLAYWRIGHT_MODULE` pointant vers un module exportant chromium.

Les données mesurées et leur environnement sont conservés dans `docs/AGENT_HARNESS_MEASUREMENTS.json`. Les journaux bruts et captures se trouvent localement dans `.tmp/`, non versionnés. Le benchmark de 256 fragments compare l'ancien principe une écriture par fragment au nouveau buffer sur la même SQLite : 256 écritures contre 4, soit 98,4375 % de moins, texte identique. Le temps local inclut le coût du buffer et n'établit aucun gain de latence réseau. Les valeurs ne doivent pas être extrapolées à Cloudflare.

Le scénario complexe scripté effectue 10 requêtes modèle simulées, dont 3 spécialistes, crée un seul livrable et deux reçus structurels, sans action externe. Un des spécialistes relit la ressource enregistrée pour sa revue. La question simple utilise un seul appel et zéro délégation. Ces scénarios testent l'exécution du protocole ; ils ne mesurent pas le choix spontané d'un vrai modèle. Taux d'achèvement métier, pertinence réelle des délégations, p50/p95, coût fournisseur, cache et fluidité mesurée en production restent non évalués.

Les dix familles demandées sont couvertes : question simple ; plan complexe/spécialistes ; création puis contrôle ; interruption/reprise par reçu ; fournisseur indisponible/coût inconnu ; approbation sensible ; longue conversation/checkpoint ; recherche multilingue ; dépassement budgétaire ; données injectées non fiables. Voir `tests/agent-routing.integration.mjs`, `tests/agent-flow.test.mjs`, `tests/production-runtime.integration.mjs`, `tests/model-routing.integration.mjs`, `tests/openrouter.integration.mjs`, `tests/composio.integration.mjs`, `tests/skills-agent.integration.mjs` et les tests de mémoire/facturation existants.

## Activation et risques résiduels

- Appliquer la migration additive `0015_agent_harness.sql` sur la base cible AVANT de déployer ce runtime. Elle n'a été appliquée que dans les bases isolées de tests ; ne pas confondre les 15 anciennes migrations mentionnées dans l'état du staging avec cette nouvelle seizième migration. Les nouvelles fonctions échoueront si leurs tables manquent.
- Valider d'abord sur staging fermé : schéma, identité, isolation, budgets, arrêt et rapprochement. Conserver les drapeaux de fonctions externes désactivés tant que les comptes/contrats ne sont pas validés. Un retour à l'ancien bundle reste possible avec ces tables additives.
- Le document `docs/production/STATE.md` rapporte les preuves antérieures : staging privé, activation R2 encore bloquée, clés de plusieurs intégrations manquantes et authentification/activation à terminer. Cet audit n'a pas refait de constat distant et ne remplace pas la recette réelle.
- Aucune promesse d'exécution facturée pour fal, Composio, navigateur ou paiements ; leurs mocks ne prouvent pas une intégration réelle. Le routage autorisé, les tarifs et le rapprochement sont testés localement, pas les factures fournisseurs.
- Les checkpoints sont des données non fiables et peuvent devenir obsolètes ; le modèle doit relire les ressources. Ils ne suppriment pas l'historique après une correction/retrait de mémoire. Leur rétention, comme celle des nouveaux reçus et événements, doit être incluse dans la politique d'exploitation et de suppression des conversations.
- Le budget de contexte est une borne de caractères pondérés, pas un tokenizer exact. Le compteur de coût existant peut refuser un appel avant émission ; les tests du petit budget de 10 crédits restent inchangés et passent. Les descriptions d'outils et instructions ont été condensées pour éviter une régression de ce cas.
- La réserve commune impose la sérialisation des appels modèles. Une concurrence de spécialistes ne sera sûre qu'avec réservation atomique de sous-budgets ; elle n'a pas été activée pour gagner artificiellement de la vitesse.
- Une action externe incertaine ou un reçu local pending bloque la répétition automatique. La reprise doit d'abord établir ce qui a réellement eu lieu. Une panne D1 peut empêcher la persistance de la dernière sortie ; aucun succès fictif ne doit en découler.

L'évolution est un renforcement incrémental du runtime existant. L'objectif de production reste le livrable exploitable dont les contrôles adaptés sont confirmés, et non le nombre de spécialistes ni la seule déclaration du modèle.
