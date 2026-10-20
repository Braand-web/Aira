# Réponses en streaming

Le composant `StreamingResponse` adapte le composant [beUI](https://beui.dev/components/agents/streaming-response) à Aïra : textes français, thème existant, transitions CSS natives et réduction des animations. Aucun paquet supplémentaire ni commande de registre n’est nécessaire.

## Comportement

- Les actions apparaissent après la fin réelle du flux. Une interruption ou un arrêt reste distinct d’une réponse terminée. Les messages anciens sans lien vers une exécution conservent un statut inconnu.
- La copie annonce sa réussite seulement après confirmation du presse-papiers. Un refus affiche une aide et conserve le texte.
- Les avis « utile » et « peu utile » sont modifiables et annulables. Ils sont enregistrés par utilisateur, message et espace. Un échec conserve l’avis précédent et propose de réessayer.
- « Reprendre la demande » restaure le texte utilisateur et les pièces jointes encore disponibles dans le compositeur, en préservant le brouillon. L’utilisateur vérifie puis envoie : ce bouton ne relance aucun modèle ni outil.
- Les sources proviennent exclusivement des citations structurées du fournisseur. Les liens dans une réponse ne sont pas transformés en sources. Aucune source n’est inventée si le fournisseur n’en renvoie pas.
- Les sources s’ouvrent au clavier dans un volet repliable. Les URL sont limitées à HTTP(S), sans identifiants ; les liens externes utilisent `noopener noreferrer`. Les titres sont échappés et aucun favicon tiers n’est téléchargé.

## Données et API

La migration additive `drizzle/0011_response_feedback.sql` ajoute `messages.run_id` et `response_feedback`. Les messages existants ne sont ni réécrits ni supprimés. Appliquer les migrations avant d’activer cette version du serveur ; l’adaptateur local les applique à son démarrage. Le journal Drizzle et le schéma TypeScript incluent cette évolution.

- Le flux SSE émet `assistant_message` après la persistance de chaque tour : `{ messageId, runId, sources }`.
- `GET /api/chat?conversationId=…` renvoie les statuts réels, sources et avis de l’utilisateur authentifié.
- `PATCH /api/chat` accepte strictement `{ messageId, feedback: "up" | "down" | null }`. L’identité et l’espace viennent de la session ; un message inaccessible renvoie le même 404 qu’un message absent. Les écritures externes à l’origine sont refusées.
- Les citations natives restent intactes dans le contexte du fournisseur, notamment les champs opaques requis pour les tours suivant un appel d’outil. Seules les métadonnées d’affichage sont transmises dans `sources`.

Retour arrière : revenir au code précédent en conservant la colonne et la table ajoutées. Aucune suppression de données n’est nécessaire.

## Vérification

```sh
npm run typecheck
npm run lint
npm run build
npm test
node tests/agent-ui.browser.mjs
```

Le test navigateur utilise Playwright/Chromium (Edge en repli), un serveur de fixtures local et bloque les requêtes externes. Le chemin d’un runtime Playwright fourni peut être indiqué par `AIRA_PLAYWRIGHT_MODULE`. Aucun fournisseur réel ni paiement n’est appelé. Les tests de routes utilisent une base SQLite isolée et de vrais gestionnaires HTTP, avec le flux modèle simulé.

Contrôle manuel : envoyer une demande, attendre la fin, copier puis autoriser/refuser le presse-papiers, modifier/annuler un avis et recharger la discussion. Vérifier les sources si le fournisseur en fournit. Reprendre une demande avec un brouillon existant : aucun nouvel envoi ne doit se produire avant validation par l’utilisateur. Vérifier aussi un arrêt, une coupure, le clavier et le mobile avec réduction des animations.

Limites : les tests n’appellent pas le fournisseur réel ; la présence de citations dépend de ses capacités et des outils utilisés. Les essais avec VoiceOver/NVDA restent manuels.
