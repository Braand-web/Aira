# Vérifications locales et CI

La CI s’exécute sur chaque pull request et chaque push, sans filtre de chemins. Elle utilise Node 24 et les versions verrouillées par `package-lock.json`.

Depuis la racine du dépôt :

```sh
npm ci --include=dev --include=optional
npm run typecheck
npm run lint
npm run build
npm test
```

`npm test` lance tous les groupes de `tests/run-tests.mjs` : tests unitaires, intégrations de services (facturation, Composio, OpenRouter, missions et opérations), inspection des artefacts de production, puis tests HTTP et fichiers avec des serveurs locaux temporaires. Le build doit précéder les tests d’artefacts. Tout échec renvoie un code de sortie non nul ; les tests ne sont pas ignorés.

Pour une vérification ciblée :

```sh
npm run test:unit
npm run test:integration
npm run test:artifacts
node tests/run-tests.mjs http
```

Le runner découvre automatiquement les fichiers `*.test.mjs` et `*.integration.mjs`. Les tests nécessitant les artefacts du build et les scripts HTTP qui démarrent leur propre serveur sont enregistrés explicitement dans le runner. Un nouveau script `run-*-integration.mjs` doit déclarer les fichiers qu’il exécute.

Chaque processus de test reçoit le garde `tests/offline-network.mjs`, y compris les serveurs et sous-processus HTTP. Seules les connexions loopback sont autorisées ; les fournisseurs sont simulés. Les variables de configuration et les credentials fournisseurs sont retirés de l’environnement transmis. Les tests HTTP utilisent des bases, répertoires et secrets fictifs temporaires, sans appeler de compte externe.

Le lint porte sur l’ensemble du dépôt et échoue aussi sur les avertissements. Les scripts historiques `test:file-preview-bundle`, `test:worker-config`, `test:http-integration` et `test:file-upload-integration` restent disponibles pour le diagnostic manuel ; la CI utilise toujours la suite complète protégée.

## Interface du chat et aperçus média

Test navigateur complémentaire (Playwright et Chromium installés séparément dans l'environnement de test) :

```sh
node tests/agent-ui.browser.mjs
```

Si Playwright est fourni par un runtime externe, définir `AIRA_PLAYWRIGHT_MODULE` avec le chemin absolu de son `index.mjs`. Ce test optionnel ne fait pas partie de `npm test` : il nécessite un navigateur. Il exécute les vrais composants React avec un serveur de fixtures loopback et bloque les requêtes vers toute autre origine. Le composant Image utilise le même shim Vinext que le build. Aucun compte ni clé fournisseur n'est nécessaire. Il vérifie le flux, l'interruption, l'arrêt, la double approbation, le suivi puis l'affichage média, le mobile et la réduction des animations. Résultats et captures sont enregistrés dans `.tmp/agent-ui-browser/`, exclu de Git.
