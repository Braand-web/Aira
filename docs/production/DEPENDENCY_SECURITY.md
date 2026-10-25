# Dépendances : preuve et exceptions — 2026-10-18

## Commandes exécutées

- `npm audit --json` : initialement impossible dans le sandbox (`ENOTFOUND`), puis exécuté avec accès réseau ; **27** dépendances signalées (**15 élevées**, **12 modérées**, aucune critique).
- Installation compatible : `npm install --ignore-scripts` ; aucun `--force`, aucune migration de framework, aucun script d'installation lancé.
- `npm audit --json` après correction : **19** dépendances signalées (**8 élevées**, **9 modérées**, **2 faibles**, aucune critique). Un audit n'est donc pas « propre ».
- `npm audit --omit=dev --json` : **5 avis modérés** dans les dépendances de production, aucun élevé ou critique. Chaîne observée avec `npm ls` : `@composio/anthropic` → `@mastra/mcp` → `@mastra/core` → `gray-matter` → `js-yaml` → `argparse` → `sprintf-js`.
- `npm audit fix --dry-run --json` : **0 paquet modifié**. Aucun correctif automatique n'a été appliqué ; les versions du SDK Composio et les dépendances doivent être évaluées en compatibilité avant mise à jour.
- `npm ls react react-dom react-server-dom-webpack image-size @modelcontextprotocol/client ws undici --depth=3` : **exit 0**, plus d'arbre `ws` invalide.

## Corrections appliquées

- React, React DOM et React Server DOM Webpack alignés **19.2.9**, contre 19.2.6 : [déni de service Server Functions](https://github.com/advisories/GHSA-wx67-qw84-cm4g).
- Vite **8.0.16**, contre 8.0.13 : [contournement de filtrage de fichiers Windows](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) et [chemins UNC](https://github.com/advisories/GHSA-v6wh-96g9-6wx3).
- Override `image-size` **2.0.4** : [parseurs JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) et [ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr).
- Override MCP Client **2.2.0** : [destination OAuth non fiable](https://github.com/advisories/GHSA-6qxp-vccf-f47h).
- Overrides `ws` **8.22.0** et `miniflare > undici` **7.30.1** : [fragmentation WebSocket](https://github.com/advisories/GHSA-96hv-2xvq-fx4p), [validation TLS Undici](https://github.com/advisories/GHSA-w293-vg96-wgc3), autres vulnérabilités Undici annoncées par npm.
- Version minimale Node alignée sur le SDK Composio installé : **>=22.22.3**. Aucun changement de version majeure applicative.

## Exceptions restantes, à revoir avant chaque déploiement

Les 19 lignes npm sont largement des remontées de quelques causes transitives ; ce ne sont pas 19 défauts indépendants démontrés dans les routes d'Braand.

**Élevé : braces <=3.0.3** et remontées `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, `eslint-config-next`, `vite-plugin-dynamic-import`, `vite-plugin-commonjs`, `vinext`. [Avis officiel](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Aucun correctif braces 3 n'est publié au registre interrogé. Les usages identifiés servent les motifs de fichiers de compilation/lint ; Braand ne propose pas d'API où l'utilisateur fournit ces motifs. Ne pas exposer le serveur de développement au public et ne pas traiter de projet de code non fiable dans le même processus. Le conseil npm de rétrograder Next ESLint vers 14 ou vinext vers 0.0.15 n'est pas appliqué : il casserait la compatibilité. Une migration éventuelle doit être validée et testée séparément.

**Modéré : sprintf-js <=1.1.3** et chaîne `argparse` → `js-yaml` → `gray-matter` → `@mastra/core` (transitive du provider Composio). [Avis officiel](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). L'audit de production remonte cinq paquets de cette même chaîne. Le code Braand utilise le formatage Anthropic ; il n'appelle pas le parseur front-matter de Mastra. Ne pas autoriser de format arbitraire provenant d'un utilisateur. Le graphe est présent dans des dépendances de production, donc il ne peut pas être classé comme avis uniquement développement. Le dry-run npm n'a proposé aucune modification ; une mise à jour compatible du SDK/du graphe est à examiner avant ouverture. Aucune absence universelle d'exploitabilité n'est affirmée.

**Modéré/faible : esbuild** sous `@esbuild-kit/core-utils`/`drizzle-kit` (0.18) et Wrangler (0.27), puis remontées Cloudflare plugin. [Avis dev-server](https://github.com/advisories/GHSA-67mh-4wv8-2f99), [Windows](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr). Ces outils de développement ne sont pas des endpoints de l'application publiée. Le CLI Drizzle n'est pas utilisé comme serveur HTTP. Les versions majeures/transitives suggérées par npm n'ont pas été forcées. Maintenir l'écoute locale et isoler CI ; réévaluer après un correctif fournisseur compatible.

Ces exceptions sont **justifiées par le chemin observé dans le dépôt**, pas acceptées automatiquement par le propriétaire et pas une preuve de sécurité complète. Le build et les tests applicatifs de la vérification finale doivent rester verts. Aucun assouplissement de test ni suppression de dépendance indispensable n'a été fait pour masquer l'audit.
