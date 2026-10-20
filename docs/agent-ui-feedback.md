# Statuts de l’agent et révélation des visuels

`AiStatus` et `GridReveal` utilisent les libellés français, les variables de thème d’Aïra et des animations CSS/canvas natives. Aucune dépendance d’animation supplémentaire n’est installée.

- `components/ui/ai-status.tsx` : préparation, analyse, rédaction, fin confirmée, erreur et arrêt. L’horloge utilise le temps réellement écoulé. Un message historique ne reçoit pas une durée inventée.
- `lib/agent-status.mjs` : traduction déterministe des événements de streaming en états d’interface. Un résultat d’outil ou du texte reçu ne valent jamais confirmation de fin. Une fin de flux sans événement `done` conserve le texte et signale l’interruption.
- `components/ui/grid-reveal.tsx` : grille décorative, puis image effectivement chargée, sans recadrage. La grille n’affiche aucun pourcentage fournisseur. Un échec de chargement propose de relire l’image, sans nouvelle génération.
- `components/media-generation-preview.tsx` : observation d’une proposition déjà approuvée. Les lectures sont espacées, bornées et suspendues quand l’onglet est masqué. Les reprises relisent la même opération ; ce composant ne contient aucun appel de soumission.

La grille est importée dynamiquement. Les images historiques s’affichent directement ; la révélation accompagne seulement un résultat nouvellement obtenu. Les animations s’arrêtent hors écran ou dans un onglet masqué et respectent `prefers-reduced-motion`.

## Vérification locale

```sh
node --test tests/agent-status.test.mjs
npm run build
```

`tests/agent-ui.browser.mjs` lance le vrai composant Studio dans Chromium avec un serveur de fixtures lié à `127.0.0.1`. Les requêtes hors de cette origine sont bloquées. Aucun secret de `.dev.vars` n’est chargé, aucun fournisseur et aucun paiement réel ne sont sollicités. Le test couvre le streaming, la coupure, l’arrêt, le double clic d’approbation, la grille, l’échec/réessai de lecture d’image, le mobile et la réduction des animations.

Avec Playwright disponible dans l’environnement de développement :

```sh
node tests/agent-ui.browser.mjs
```

Si Playwright est fourni par un runtime externe, définir `AIRA_PLAYWRIGHT_MODULE` vers son module `index.mjs` avant de lancer cette commande. Le navigateur Chromium doit être installé ; Microsoft Edge local sert de solution de repli. Les captures et le relevé des vérifications restent dans `.tmp/agent-ui-browser/`, ignoré par Git.

## Test manuel

1. Envoyer une demande, observer les libellés pendant les événements réels, puis la fin et sa durée.
2. Interrompre une réponse : le texte déjà reçu reste consultable.
3. Ouvrir une proposition d’image et approuver une fois son plafond. La grille apparaît pendant le suivi, puis le résultat est révélé lorsqu’il est disponible.
4. Revenir sur un visuel déjà consulté : il s’affiche directement.
5. Activer la réduction des animations et vérifier les mêmes actions sur mobile.

La validation fournisseur de fal.ai ou du modèle reste distincte des tests de présentation simulés.
