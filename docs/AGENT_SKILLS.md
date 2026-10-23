# Compétences internes des agents Aïra

Aïra embarque 17 méthodes de travail consultables par ses agents : huit compétences marketing importées sous MIT, une compétence de conception frontend importée sous Apache-2.0, quatre compétences média originales et quatre compétences documentaires originales. Elles aident le modèle à choisir une méthode et à préparer un résultat. Elles n'ajoutent ni outils, ni permissions, ni accès à un compte ou à un fournisseur.

Cette intégration appartient au SaaS Aïra. Elle n'installe rien dans Codex, ne dépend pas de son répertoire personnel de skills et ne constitue pas une équivalence parfaite avec les environnements d'origine.

## Catalogue et capacités

La liste utilisée par le générateur est [skills/catalog.json](../skills/catalog.json). Chaque entrée définit un identifiant, un titre et une description Aïra, une catégorie, un répertoire, une provenance de licence et une indication de capacité. Cette indication décrit le périmètre attendu ; elle n'accorde pas le droit d'exécuter une action.

Les huit méthodes marketing sont conservées sous `skills/vendor/marketing/` :

- `product-marketing` : offre, cible, preuves, positionnement et contexte de marque.
- `copywriting` : textes de vente et appels à l'action à partir des faits du client.
- `ad-creative` : angles, accroches et variantes publicitaires.
- `ads` : stratégie de campagne, audience, budget et analyse des données disponibles.
- `cro` : améliorations de conversion d'une page ou d'un formulaire.
- `social` : planification et rédaction de contenus sociaux.
- `seo-audit` : examen des éléments SEO fournis, avec distinction des vérifications encore nécessaires.
- `analytics` : plan de mesure et analyse des indicateurs réellement accessibles.

`frontend-design`, sous `skills/vendor/anthropic/frontend-design/`, apporte une méthode de direction visuelle et de hiérarchie pour des brouillons de page. Sa lecture ne fournit pas de shell, de navigateur, de moteur frontend ou de publication supplémentaire.

Les quatre méthodes originales média sont sous `skills/aira/media/`, dans un dossier portant leur identifiant :

- `aira-product-visuals` : brief produit, mise en scène, fidélité aux références et proposition de création.
- `aira-video-direction` : intention, plans, rythme, mouvement et continuité.
- `aira-image-variants` : retouche et adaptation de format à partir d'une référence acceptée.
- `aira-media-pipeline` : dépendances, critères d'acceptation, budget cumulé et reprise par étapes.

Elles emploient le catalogue administrateur réel : `media_catalog`, puis `prepare_media` pour une proposition exacte. La génération attend sa validation dans l'interface. Une étape dépendante attend une sortie `ready` et acceptée comme référence ; une lecture de skill ne remplace jamais ces contrôles. Les modèles, paramètres et coûts viennent du serveur et du catalogue, pas des dépôts consultés. Le budget de production inclut les coûts consommés, engagements et devis en attente, sans double comptage.

Les quatre méthodes originales documentaires sont sous `skills/aira/documents/` :

- `aira-docx` : rédaction, lecture du contenu accessible, modifications localisées et propositions de révision Word.
- `aira-pdf` : extraction accessible, contenu à exporter, manifeste de fusion ou sélection de pages et correspondance des champs d'un formulaire ; sans OCR.
- `aira-pptx` : récit, organisation et contenu des diapositives, notes et changements proposés.
- `aira-xlsx` : lecture et nettoyage de données accessibles, schéma de classeur, formules proposées et analyses justifiables sur ces données.

Leurs dossiers sont `aira-docx`, `aira-pdf`, `aira-pptx` et `aira-xlsx`, afin de correspondre au champ `name` du `SKILL.md`. Chacun conserve `references/controles.md` avec des contrôles pratiques et des scénarios comportementaux.

Ces quatre entrées portent `document_content_only`. Aucun moteur de création ou modification binaire Office/PDF, de recalcul de classeur ou de rendu documentaire n'est connecté au modèle. Les extractions et aperçus de fichiers existants ne fournissent pas ces capacités. `create_page` crée une page Aïra, pas un DOCX, PDF, PPTX ou XLSX. Un tableau ou une formule proposés ne prouvent ni l'édition ni le recalcul d'un classeur. Le modèle doit signaler la limite et livrer le contenu contrôlable, sans annoncer un fichier créé ou modifié ni inventer un lien de téléchargement.

## Sources épinglées et licences

Le snapshot marketing est décrit par [son manifest](../skills/vendor/marketing/manifest.json) : dépôt `coreyhaines31/marketingskills`, révision `e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b`, licence MIT. Les huit `SKILL.md`, leurs références Markdown sélectionnées et [la notice MIT](../skills/vendor/marketing/LICENSE) sont conservés avec leurs octets amont. Les scripts, guides d'intégration, installateurs, assets HTML et autres skills ne font pas partie de la sélection. Les liens vers des fichiers absents ou vers une branche amont évolutive ne sont pas des fichiers implicitement importés.

Le snapshot frontend est décrit par [son manifest](../skills/vendor/anthropic/frontend-design/manifest.json) : dépôt `anthropics/skills`, révision `dbd4588f9e1033efb41dad4bef2f7947c8993d44`, uniquement `skills/frontend-design/SKILL.md` et [sa licence Apache-2.0](../skills/vendor/anthropic/frontend-design/LICENSE.txt). Cette sélection et cette notice ne s'étendent pas à tous les répertoires du dépôt. Les compétences documentaires propriétaires amont, leurs prompts, scripts et assets sont exclus ; les quatre méthodes documentaires Aïra sont des textes originaux.

Les méthodes originales portent `Aira-original` dans le catalogue et la version `1.0.0` dans la provenance générée. `Aira-original` est un repère de provenance du projet, pas une déclaration MIT ou Apache-2.0 ni une nouvelle licence publique. Ne pas attribuer les huit textes originaux à leurs sources d'inspiration.

La [sélection documentaire média](MEDIA_SOURCE_SELECTION.md) donne les décisions et révisions consultées :

- `fal-ai-community/genmedia-cli` à `19957fe26c306b3ad4a0bf9dcb2c54c528ea7be6` : notice MIT ; aucun CLI importé ou installé.
- `fal-ai-community/skills` à `9ca850412943251fc9a466c4c29fdaf7a303a3d8` : le README déclare MIT, mais l'audit n'a trouvé aucune notice LICENSE globale. Cette nuance est conservée ; aucun texte communautaire n'est copié ou traduit ici.
- `fal-ai/fal` à `8f4b4c44bacd14b469b3f4c3f1a9660a43deb2f6` : notice Apache-2.0 ; aucun SDK Python ajouté à ce runtime.

Ces dépôts média servent de sources documentaires, pas de dépendances d'exécution des skills. Les manifests et notices locales font foi pour les fichiers réellement importés. Préserver les notices lors d'une redistribution des fichiers concernés.

## Chargement progressif dans le runtime

[lib/skills/registry.ts](../lib/skills/registry.ts) expose deux outils internes aux agents. Le contexte initial contient les identifiants et descriptions du catalogue, avec les règles de méthode ; il ne contient pas tous les corps ou références.

1. `search_skills` recherche les métadonnées par mots et catégorie (`marketing`, `creative` ou `documents`). La requête est limitée à 300 caractères et le résultat à huit entrées. La recherche ne charge pas de contenu et n'exécute aucune méthode.
2. `read_skill` lit le fichier `SKILL.md` d'un identifiant connu. Sa réponse interne contient le texte, les références disponibles, la provenance, le digest et le budget restant.
3. Si `nextOffset` n'est pas nul, une lecture supplémentaire avec cette position permet de poursuivre le fichier. Ne pas traiter un extrait tronqué comme un fichier entièrement consulté.
4. Une référence se lit seulement après le `SKILL.md` du même skill, avec le chemin exact présent dans `references`. Les chemins arbitraires, remontées de répertoire et URL ne sont pas un système de fichiers ou un accès réseau.

Exemple d'arguments d'outils, dans l'ordre :

```json
{"query":"formules données tabulaires","category":"documents"}
```

```json
{"id":"aira-xlsx"}
```

```json
{"id":"aira-xlsx","reference":"references/controles.md"}
```

Les plafonds de [lib/skills/policy.mjs](../lib/skills/policy.mjs) sont communs à l'agent principal et aux spécialistes qu'il délègue pendant le même run : au plus **18 000 caractères par lecture**, **60 000 caractères au total**, **huit lectures** et **quatre skills distincts**. Les lectures des références et des fragments suivants consomment le même budget ; relire un fichier consomme une nouvelle lecture. Il ne s'agit pas d'une enveloppe séparée par spécialiste. Les positions et compteurs suivent les chaînes JavaScript, pas les octets ni les tokens ; réutiliser `nextOffset` plutôt que calculer soi-même une position.

`runAgent` crée la session de lecture et la transmet à `runSpecialist` dans [lib/agent.ts](../lib/agent.ts). Une limite atteinte renvoie `skill_context_limit`. L'agent doit alors terminer avec les éléments déjà consultés ou préciser ce qui manque, sans supposer que le reste a été lu.

## Autorisations, confidentialité et traçabilité

Une méthode reste sous les règles système, le brief, les droits de l'utilisateur et les outils réellement exposés. Les commandes, chemins locaux, services, tarifs et installations cités dans un texte amont sont des données de référence, jamais des autorisations. Les agents ne lancent ni scripts amont, ni CLI genmedia, ni commandes shell ou requêtes fournisseur brutes à partir de ces textes.

Les droits des modes et rôles restent ceux du runtime. Un spécialiste ne gagne aucun outil d'écriture, de dépense, de publication ou de délégation en lisant une méthode. En mode autonome, `search_skills` et `read_skill` sont autorisés mais la lecture d'un skill média n'ajoute pas `prepare_media` à la liste des outils permis. Les contrôles d'espace, d'identité, de budget et d'approbation existants demeurent applicables.

Le contenu lu est transmis au modèle comme résultat interne. `publicSkillResult` réduit les événements SSE visibles par le client à des métadonnées de progression : pour une lecture, identifiant, titre, version, référence, nombre de caractères, indicateur de troncature et statut `method_loaded` ; pour une recherche, statut et nombre de résultats. Le corps, la liste des références et la provenance détaillée ne sont pas renvoyés dans ces événements.

Une lecture réussie enregistre un audit `skill.read` ciblant l'identifiant du skill, avec version, référence, nombre de caractères, troncature et digest. Cet audit ne contient pas le corps du texte. Il indique la version lue, pas la bonne application de la méthode ni la réussite d'une action. Une lecture rejetée ne constitue pas une lecture réussie à auditer.

Les modules générés sont réservés au serveur et chargés à la demande. Ne pas importer `lib/skills/catalog.generated.mjs` ou `lib/skills/content/` depuis un composant client, un endpoint public de corpus ou une interface de téléchargement.

## Vérifier, importer et générer

Exécuter les commandes depuis la racine du projet, avec Node et les dépendances de développement déjà disponibles. Aucun de ces gestes n'est délégué au modèle Aïra par la lecture d'un skill.

Vérifications locales sans accès réseau :

```sh
node scripts/import-marketing-skills.mjs --verify
node scripts/import-design-skill.mjs --verify
node scripts/build-skill-catalog.mjs --check
```

Les importateurs vérifient la provenance et l'intégrité du snapshot épinglé. Le générateur exécute ces vérifications hors ligne avant de compiler ; il refuse notamment un contenu amont modifié sous sa provenance épinglée. Le contrôle `--check` signale des modules générés périmés sans les réécrire.

Pour réacquérir explicitement les mêmes snapshots depuis leurs sources réseau, les commandes sont :

```sh
node scripts/import-marketing-skills.mjs --import
node scripts/import-design-skill.mjs --import
```

Ces imports téléchargent et valident la sélection épinglée avant écriture. Ils ne suivent pas automatiquement `main` et n'exécutent aucun code amont. Une mise à jour de révision est un changement de code à examiner avec les chemins, octets, empreintes et notices attendus ; modifier seulement un manifest ne doit pas rendre une nouvelle source acceptable.

Après un changement examiné du catalogue ou d'un texte original, régénérer puis vérifier :

```sh
node scripts/build-skill-catalog.mjs
node scripts/build-skill-catalog.mjs --check
```

Le générateur produit `lib/skills/catalog.generated.mjs` et un module `lib/skills/content/<id>.generated.mjs` par skill. Il collecte uniquement `SKILL.md` et les fichiers Markdown de `references/`, avec une limite de 64 000 octets par fichier. Les originaux doivent être sous `aira/`, dans un dossier égal à leur identifiant, avec un frontmatter `name` correspondant et des fins de ligne LF. Modifier les sources, puis régénérer ; ne pas corriger les fichiers générés à la main.

## Contrôles développeur

Les contrôles ciblés suivants utilisent le préchargement hors ligne du projet :

```sh
node --import ./tests/offline-network.mjs --test tests/skills.test.mjs tests/skills-design-import.test.mjs
node --import ./tests/offline-network.mjs tests/skills-agent.integration.mjs
```

Ils couvrent la provenance et les règles de validation des snapshots, la découverte par métadonnées, les fragments, les références autorisées, les limites partagées, les droits des spécialistes et du mode autonome, les audits et les résultats SSE. La réacquisition réseau avec `--import` n'est pas exercée par ces tests hors ligne. L'intégration exécute les boucles réelles d'agents avec des réponses de modèle simulées et une base SQLite locale ; elle ne valide pas le raisonnement d'un modèle distant et n'appelle pas de fournisseur réel.

Après une construction de production, contrôler aussi les fichiers effectivement émis :

```sh
npm run build
node --import ./tests/offline-network.mjs tests/skills-bundle.integration.mjs
```

Ce contrôle recherche des passages représentatifs, chemins internes et marqueurs de provenance dans les bundles navigateur et leurs source maps éventuelles ; il vérifie aussi la présence de contenu dans des chunks serveur importés à la demande. Il ne faut pas se contenter de constater que les sources TypeScript semblent séparées.

Les vérifications générales restent disponibles avec `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration` et `npm test`. La suite complète inclut des contrôles d'artefacts qui nécessitent une construction préalable. Les scénarios des références documentaires évaluent des décisions et des affirmations ; ils ne prouvent aucune ouverture, modification, exportation ou qualité de rendu de fichiers Office/PDF.
