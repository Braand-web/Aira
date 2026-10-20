# Design system Aïra

L’intégration utilise les mesures authentifiées de la v3 du kit Muse fourni par le client : `muse.tokens.css`, `components.authenticated.css`, `INTERFACE-PRIVEE.md` et leurs observations. Les proportions v2 relevées dans des captures ne sont pas utilisées comme dimensions CSS.

## Organisation

- `app/design-tokens.css` centralise couleurs, géométrie, typographie et mouvement. Les alias `--bg`, `--surface`, `--aira-sidebar-*` assurent la compatibilité des composants existants.
- `app/design-system.css`, importé par Studio, adapte les composants sous `html[data-design-system="muse"]` : navigation, chat, compositeur, paramètres, recherche, bibliothèque, compétences, connecteurs, panneau droit et barre de l’aperçu de fichier.
- Les modules CSS de facturation utilisent les mêmes tokens, sans changer tarifs, montants, droits ni calculs.
- Le layout de production, l’adaptateur local et les fixtures navigateur activent le même attribut racine.

## Adaptations assumées

Manrope reste la police d’Aïra : les binaires OptimisticAI ne sont pas fournis. Aucun logo, fichier de police propriétaire, script du catalogue ou CSS utilitaire brut n’est importé. Aucune dépendance nouvelle.

Le kit décrit plusieurs colonnes propres à Muse. Aïra conserve sa navigation et son panneau existants : sidebar 240 px déployée, rail 72 px replié, panneau redimensionnable. Le sélecteur de mode et les envois de fichiers restent présents dans le compositeur compact ; sur mobile, les actions passent sous le texte.

Les petits textes secondaires sont plus clairs que les alpha tertiaires de la référence pour conserver un contraste lisible. Le fond des menus est plus opaque pour qu’un texte derrière ne gêne pas leur lecture. La teinte bleue des messages utilisateur, les surfaces translucides et le focus bleu reprennent la v3.

La bibliothèque de compétences adopte le même thème sombre. Les contenus Office/PDF ne sont pas recolorés ; seule l’interface du lecteur reprend le thème.

Le responsive est une adaptation à Aïra, pas une validation du comportement mobile de Muse. Les fonctions non présentes dans Aïra, telles que ses discussions parallèles, ne sont pas ajoutées comme faux contrôles.

## Vérification

```sh
npm run typecheck
npm run lint
npm run build
npm test
node tests/agent-ui.browser.mjs
```

La suite navigateur utilise une identité, des réponses et des catalogues de test sur loopback, bloque le réseau externe et ne fait aucun achat ni appel modèle réel. Elle vérifie notamment : tokens calculés, rail 72 px, compositeur qui grandit uniquement en hauteur jusqu’à 192 px, défilement interne, paramètres desktop/mobile, compétences, facturation, états de streaming, copie, avis, sources et reprise de demande.

Les captures se trouvent dans `.tmp/agent-ui-browser/design-*.png`, ignoré par Git. Si Playwright vient d’un runtime externe, définir `AIRA_PLAYWRIGHT_MODULE` vers son module avant la commande.

La prévisualisation complète utilise `PORT=4200 node scripts/dev-local.mjs` (PowerShell : `$env:PORT='4200'` puis `node scripts/dev-local.mjs`). Elle reste sur `127.0.0.1`, utilise l’authentification locale de développement et ne publie rien en production.
