# Adaptation des compétences fournies — 25 octobre 2026

Six méthodes compactes complètent les 25 méthodes existantes. Le modèle principal
et les spécialistes utilisent le même registre, sélectionnent les identifiants selon
le sens de la demande et lisent seulement la méthode ou référence utile. Aucun
routeur métier par mots-clés n'a été ajouté. La recherche lexicale reste un secours.

- **Pilotage publicitaire** : adaptation commune des deux longs guides publicitaires.
  Complète la stratégie existante avec économie unitaire, tests et contrôles d'action.
- **Recherche documentée** : méthode portable 06.
- **Décision et priorisation** : méthode 08.
- **Organisation et suivi de projet** : fusion des méthodes 07 et 11.
- **Rédaction professionnelle** : fusion des méthodes 09 et 10.
- **Réunions et actions** : méthode 12.

Les méthodes de développement 01 à 05 sont exclues : Braand ne dispose pas d'un
terminal général ou d'un environnement de programmation pour ses utilisateurs.
Le fichier AGENTS.md de l'archive n'est pas adopté comme instruction du projet.
Les installations, connecteurs fictifs, références absentes, délais universels,
promesses de surveillance et parcours fixes des guides ne sont pas importés.

## Provenance et intégrité

`skills/user-adapted/manifest.json` enregistre les empreintes des entrées disponibles
et des neuf fichiers Markdown adaptés. L'archive initiale ayant été retirée du
dossier Downloads après inspection, sa provenance est représentée par l'empreinte
du snapshot Markdown extrait et inspecté, et non par une empreinte ZIP supposée.
Le marqueur `User-provided-adapted` décrit cette provenance ; il n'attribue pas une
licence MIT ou Apache aux documents fournis. Les gros documents bruts, chemins
personnels et éventuels scripts de l'archive ne sont pas distribués dans le produit.

Le générateur refuse tout fichier adapté non déclaré ou dont l'empreinte a changé.
Les sources de compétences restent côté serveur, chargées à la demande avec les
budgets existants (4 méthodes, 8 lectures, 60 000 caractères maximum par demande).
Les règles système, les permissions et les budgets conservent la priorité.

## Interface et limites

Les paramètres affichent désormais les métadonnées du registre réel, via
`GET /api/skills`, protégé par l'identité et l'accès à l'espace, sans cache partagé.
La réponse ne contient ni instructions complètes, ni chemins, ni fournisseurs.
« Utiliser » prépare un brouillon : aucun modèle ou outil externe n'est exécuté.
Les méthodes privées restent des candidates indépendantes du registre validé.
Un échec de chargement propose une nouvelle tentative et préserve leur accès.

Aucun nouvel outil, droit de publication, dépense, compte publicitaire ou tâche
récurrente n'est créé. L'enregistrement d'un plan, d'un checkpoint ou d'un rapport
ne confirme jamais une exécution externe. Les actions incertaines ne sont pas
relancées aveuglément. Les capacités de production Office/PDF restent inchangées.

## Validation

Les contrôles de génération sont exécutables sans dépendances. Les contrôles
TypeScript, lint, build, isolation des sources, tests SQLite/agents et navigateur
s'exécutent dans GitHub Actions pour éviter l'installation volumineuse locale.
Les scénarios agents utilisent des réponses modèle simulées et des fournisseurs
interdits : ils vérifient le runtime, pas la qualité cognitive en production.
