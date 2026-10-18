# Composio dans Aïra

Intégration locale ajoutée le 18 octobre 2026. Aïra conserve sa boucle Messages/streaming Opus via OpenRouter ou Anthropic, son identité Sites et sa bibliothèque de compétences privées. Aucun déploiement ni appel externe payant n’a été effectué pendant cette intégration.

## Installation et configuration

Node >=22.13.0 ; `npm ci`. SDK verrouillés : `@composio/core@0.25.0` et `@composio/anthropic@0.11.5`.

Ajouter `COMPOSIO_API_KEY=` dans le fichier **existant** `.dev.vars`, puis renseigner la valeur dans l’éditeur. Ne pas remplacer les autres variables et ne jamais envoyer la clé dans le chat. Le modèle de configuration sans secret est `.env.example`.

Le serveur local charge ce fichier et les variables `COMPOSIO_*` de son environnement, puis applique les migrations SQL additives au démarrage. Redémarrer le serveur pour prendre en compte une nouvelle clé :

```powershell
$env:PORT='4180'
node scripts/dev-local.mjs
```

Arrêter d’abord le serveur qui occupe ce port. Ne pas lancer une seconde instance sur la même base pendant l’application d’une migration. Les conversations et fichiers existants ne sont pas effacés. Pour les tests, `AIRA_DATA_DIR`, `AIRA_BUILD_DIR` et `AIRA_CONFIG_FILE` permettent d’utiliser un répertoire temporaire et un fichier sans identifiants.

La clé n’était présente ni dans l’environnement de travail ni dans `.dev.vars` lors des vérifications. L’intégration sur un véritable compte reste à valider après sa saisie.

## Catalogue et connexion utilisateur

Ouvrir **Intégrations** : recherche, pagination, statut et connexion du catalogue complet. Aucun ajout de toolkit dans le code n’est nécessaire. Un compte expiré ou révoqué doit être reconnecté ; aucune lecture ou écriture n’est exécutée avec un compte inactif.

Le bouton génère un lien Composio. L’utilisateur ouvre ensuite **Autoriser…** dans un nouvel onglet et donne lui-même son accord. Au retour dans Aïra, **Actualiser les connexions** recharge les statuts. Aïra ne saisit pas les identifiants du fournisseur et ne consent pas à la place de l’utilisateur.

Les utilisateurs du dashboard Composio déjà connectés ne deviennent pas automatiquement ceux d’Aïra : chaque utilisateur doit connecter ses comptes depuis Aïra. L’identifiant Composio est un SHA-256 stable de l’espace Aïra et de son utilisateur. Les connexions d’un membre ne sont pas héritées par un autre membre ou une autre marque.

Pour les applications en authentification gérée, aucune configuration ni aucun compte n’est créé manuellement par Aïra. **Meta Ads (`metaads`) exige une configuration d’authentification personnalisée** dans Composio et les permissions Meta correspondantes. Indiquer son identifiant existant dans `COMPOSIO_AUTH_CONFIGS_JSON`, par exemple une association de `metaads` à l’identifiant `ac_…` obtenu dans le dashboard. Ne pas mettre de secret Meta dans ce JSON. Restreindre les scopes à la lecture lors des premiers tests ; n’élargir aux campagnes qu’après validation des permissions/app reviews nécessaires.

Pour une ouverture publique, configurer également la vérification d’identité des liens Composio avec un callback HTTPS authentifié, conformément à la documentation de production. Le flux local utilise le lien hébergé standard ; il ne fournit pas encore ce callback renforcé. Ne pas considérer ce point comme validé par un test OAuth local.

## Agent, skills et actions

Le modèle reçoit seulement les méta-outils de recherche et de schémas, plus les adaptateurs Aïra. La réponse de `COMPOSIO_SEARCH_TOOLS` est transmise entière au prochain appel du modèle : outils, étapes recommandées et pièges inclus. Il n’existe pas de téléchargement ou d’API de liste des skills à maintenir. Les compétences privées déjà enregistrées dans Aïra restent indépendantes.

Les lectures explicitement étiquetées `readOnlyHint`, sans métadonnées contradictoires, sont autorisées sur un compte actif vérifié. Les métadonnées inconnues exigent une approbation. Ces tags sont des indications du catalogue, pas une preuve sémantique absolue du comportement d’une API tierce.

Toute écriture crée une proposition contenant le toolkit, l’outil, le compte, les arguments exacts et une échéance de quinze minutes. Le modèle ne peut pas cliquer sur son approbation. La proposition est liée côté serveur à l’utilisateur, à l’espace et à la session. Un remplacement du compte ou une modification des paramètres invalide l’accord. Un double clic ne provoque qu’une exécution. Les résultats incertains ne sont jamais resoumis automatiquement.

Les propositions sont accessibles dans **Missions**. Après approbation, l’agent peut lire leur reçu avec `aira_connector_receipt`, puis préparer l’étape suivante. La poursuite automatique hors ligne n’est pas ajoutée par ce connecteur. Les fichiers ou créations Aïra doivent être transmis dans le format/URL accepté par l’outil découvert : cette intégration ne prouve pas encore un parcours réel complet d’import d’une création, création de campagne et diffusion.

Le sandbox, bash, proxy et l’exécution multiple bruts ne sont pas exposés au modèle. Les appels applicatifs passent par `session.execute`, avec contrôle du propriétaire et des permissions. Les journaux d’audit contiennent utilisateur, outil, statut et identifiant de log ; aucun argument, résultat ni clé.

L’ancien tableau de bord Meta utilise toujours l’intégration Meta directe existante. Les comptes Composio s’analysent dans le chat ; l’unification des deux tableaux de bord reste à réaliser.

## Instant et marge

Capacité Instant activable avec `COMPOSIO_INSTANT_ENABLED=true`, désactivable immédiatement avec `false`. Les sessions ordinaires envoient toujours `instant:false` ; les sessions payantes sont séparées. Un changement inattendu de politique de session bloque l’exécution.

Limites initiales UTC par mois : Découverte 0 $ ; Pro 0,50 $ et 0,05 $ par appel ; Business 2 $ partagés par organisation et 0,10 $ par appel. La limite organisationnelle empêche de multiplier le budget par membre ou par marque. Ce sont des plafonds de coûts supplémentaires, pas des prix de vente ni une garantie de marge de 75 %.

Le registre `COMPOSIO_INSTANT_CATALOG_JSON` est vide par défaut : **aucun appel payant n’est alors exécutable**. Chaque entrée administrateur doit fournir `toolkit`, `toolSlug` découverts, `maxCostUsd`, `verifiedAt` UTC et `sourceUrl` Composio officielle. La vérification expire après trente jours. Le plafond doit couvrir les paramètres réellement autorisés ; ne pas approuver un tarif variable dont la borne n’est pas démontrée. Un texte de prix renvoyé par la recherche n’est pas converti arbitrairement en plafond.

Avant chaque appel : vérifier l’éligibilité Instant auprès du fournisseur, le registre, l’abonnement, les plafonds, les crédits disponibles et obtenir une approbation. Le taux de change et les frais d’exécution viennent du barème IA déjà vérifié par Aïra. Le devis en crédits réserve le plafond USD converti, majoré de 20 % et des frais directs, au coefficient existant de 4 FCFA par crédit. Les budgets sont vérifiés atomiquement dans SQLite/D1.

Un coût réel USD explicite permet le rapprochement ; une charge absente ou supérieure au plafond conserve la réservation à vérifier et bloque toute relance de cette opération. Un échec fournisseur sans livrable restitue les crédits du client, tout en conservant le coût plateforme dans le budget. Aïra absorbe un dépassement ; Composio ne fournit pas de plafond natif en dollars. Le rapprochement administratif des cas incertains et la validation économique réelle par forfait restent nécessaires avant vente publique d’Instant.

## Vérifications reproductibles

```powershell
npx tsc --noEmit
npx eslint lib/composio.ts lib/composio-policy.mjs app/connectors-panel.tsx app/api/connectors/ --ext .ts,.tsx
node --test tests/*.test.mjs
node tests/composio.integration.mjs
node tests/composio-sdk.integration.mjs
node tests/openrouter.integration.mjs
node tests/billing.integration.mjs
npm run build
```

Les deux suites Composio interceptent les fournisseurs : elles prouvent les contrôles applicatifs et le contrat du SDK installé, pas l’accès à un vrai compte Meta. Pour le test réel, connecter son propre compte depuis Aïra, puis demander : « Liste mes comptes publicitaires Meta, puis lis les insights d’une campagne disponible, sans rien modifier ». Ne confirmer aucune proposition d’écriture pendant ce test. Conserver l’identifiant de log Composio retourné comme preuve ; un simple lien OAuth ou une recherche d’outils ne constitue pas une exécution réelle réussie.

Le build final et TypeScript ont réussi. Les 29 tests applicatifs Composio et les 8 tests du SDK installé ont réussi, ainsi que les 13 tests de politique, 6 vérifications HTTP locales et 2 vérifications du bundle navigateur. Le lint des nouveaux fichiers est propre ; le lint global reste bloqué par les erreurs préexistantes du projet, principalement `any` et des effets React. Les tests n’ont envoyé aucun e-mail, créé aucune campagne réelle et consommé aucun crédit Instant.

### Points bloquants avant production

L’audit npm du 18 octobre signale 7 vulnérabilités de dépendances de production (2 élevées et 5 modérées), introduites par les dépendances peer transitives de l’adaptateur Anthropic : chaîne Mastra/MCP et YAML/formatage. Le chemin natif utilisé ici n’importe pas Mastra ou le client OAuth MCP ; cela réduit la surface active sans supprimer les avis. Leur correction compatible et une nouvelle vérification sont nécessaires avant ouverture publique. Aucun `npm audit fix --force` ni changement majeur n’a été appliqué. La consultation des versions corrigées a été empêchée par un échec du contrôle automatique d’autorisation lié au quota de l’outil ; les dépendances n’ont pas été modifiées pour masquer le résultat.

Il reste également à fournir la clé projet, connecter un compte réel depuis Aïra, configurer l’authentification Meta personnalisée et les scopes requis, valider un appel réel en lecture avec son log fournisseur, et tester le parcours complet création média → campagne sur des actifs de test autorisés. Les fonctions vendues doivent être validées séparément : le catalogue complet ne signifie pas que chaque fournisseur et chaque type de campagne a déjà été testé.

Pour Instant, remplir le catalogue de bornes de prix vérifiées et valider le rapprochement des coûts, les frais réels Composio et les économies par offre. Le registre vide reste volontairement fermé aux dépenses. Un traitement administratif des résultats incertains et le callback de vérification d’identité sont encore à terminer pour la production. Aucune valeur de configuration ne remplace ces validations.

Documentation consultée : [Sessions](https://docs.composio.dev/docs/configuring-sessions), [Skills](https://docs.composio.dev/docs/skills), [Authentification](https://docs.composio.dev/docs/authentication), [Instant](https://docs.composio.dev/docs/instant-tools), [Approbations](https://docs.composio.dev/docs/approvals), [Préparation à la production](https://docs.composio.dev/docs/production-readiness).
