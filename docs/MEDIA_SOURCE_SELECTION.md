# Sélection des sources média Braand

Audit documentaire du 23 octobre 2026. Les liens ci-dessous épinglent les révisions consultées. La consultation a porté sur les README, licences, arborescences GitHub et contrats Braand locaux ; aucun installateur, script ou binaire amont n'a été exécuté. Aucun appel média payant n'a été effectué.

## Ce qui est retenu

Les besoins de photographie produit, publicité, direction de plans, continuité et production en plusieurs étapes sont pertinents pour Braand. Ils sont traités par quatre textes français originaux, version `1.0.0`, sous `skills/braand/media/` :

- `braand-product-visuals` : brief produit, mise en scène, fidélité et proposition de création.
- `braand-video-direction` : intention, progression, plans, mouvement et continuité.
- `braand-image-variants` : retouche ou adaptation de format à partir d'une référence acceptée.
- `braand-media-pipeline` : dépendances, critères d'acceptation, budget et reprise sans duplication.

Ces fichiers ne reproduisent ni ne traduisent les compétences communautaires. Aucun catalogue, choix de modèle, tarif, exemple de prompt ou script amont n'y est embarqué. Leur routage est exprimé avec les tâches Braand ; le catalogue administrateur et le serveur restent responsables de la sélection et de la validation. Aucun dépôt amont n'est ajouté comme dépendance d'exécution par ces compétences.

## fal-ai-community/genmedia-cli

Révision consultée : `19957fe26c306b3ad4a0bf9dcb2c54c528ea7be6` (commit du 22 octobre 2026). Le [README épinglé](https://github.com/fal-ai-community/genmedia-cli/blob/19957fe26c306b3ad4a0bf9dcb2c54c528ea7be6/README.md) présente un CLI de découverte, inspection des schémas, exécution et suivi des médias, avec sorties structurées. Son [fichier de licence](https://github.com/fal-ai-community/genmedia-cli/blob/19957fe26c306b3ad4a0bf9dcb2c54c528ea7be6/LICENSE) accorde une licence MIT et demande de conserver la notice lors d'une réutilisation couverte.

Intérêt : outillage possible pour un administrateur qui évalue des capacités et prépare un catalogue borné. Décision : ne pas ajouter son installation, sa configuration, l'authentification ou son exécution aux agents Braand. Un accès CLI direct séparerait l'exécution du devis exact et de l'approbation applicative. Les compétences ne contiennent donc aucune commande genmedia. Toute éventuelle adoption administrative est un travail distinct, avec version, acquisition, paramètres de mise à jour et données transmises à examiner.

## fal-ai-community/skills

Révision consultée : `9ca850412943251fc9a466c4c29fdaf7a303a3d8` (commit du 13 mai 2026). Le [README épinglé](https://github.com/fal-ai-community/skills/blob/9ca850412943251fc9a466c4c29fdaf7a303a3d8/README.md) présente notamment des catégories commercial, marketing, cinématographie et workflows. Leur pertinence justifie la couverture fonctionnelle des originaux Braand ; leur chemin d'exécution via genmedia ne correspond pas au circuit d'approbation de l'application.

Licence observée : le README déclare explicitement « MIT ». L'[arborescence récursive épinglée](https://api.github.com/repos/fal-ai-community/skills/git/trees/9ca850412943251fc9a466c4c29fdaf7a303a3d8?recursive=1) ne contient toutefois pas de fichier LICENSE global ; le seul fichier de ce nom trouvé est [celui de fal-redesign](https://github.com/fal-ai-community/skills/blob/9ca850412943251fc9a466c4c29fdaf7a303a3d8/skills/fal-redesign/LICENSE), qui ne sert pas de notice globale présumée. L'API GitHub ne détecte pas de licence au niveau du dépôt lors de l'audit. Cela ne signifie pas une absence de déclaration de licence : il faut conserver la distinction entre la déclaration du README et une notice complète fournie pour les fichiers concernés.

Décision pour cette livraison : aucune copie, traduction ou incorporation de texte communautaire ; méthodes originales adaptées aux contrats Braand. Une future importation de fichiers devra identifier les notices applicables et les conserver ; elle n'est pas nécessaire à cette livraison.

## fal-ai/fal

Révision consultée : `8f4b4c44bacd14b469b3f4c3f1a9660a43deb2f6` (commit du 21 octobre 2026). Le [README épinglé](https://github.com/fal-ai/fal/blob/8f4b4c44bacd14b469b3f4c3f1a9660a43deb2f6/README.md) distingue `fal`, pour déployer des applications Python sur fal, et `fal-client`, pour appeler les API de modèles depuis Python. Le [fichier de licence racine](https://github.com/fal-ai/fal/blob/8f4b4c44bacd14b469b3f4c3f1a9660a43deb2f6/LICENSE) fournit Apache-2.0 ; les fichiers LICENSE des packages examinés renvoient à cette licence.

Intérêt : source primaire pour les contrats de la plateforme et un éventuel service Python distinct. Décision locale : ne pas installer le SDK Python dans le runtime Cloudflare actuel. Braand dispose déjà d'un adaptateur de file d'attente dans `lib/providers.ts` ; un SDK supplémentaire n'est pas requis pour ces méthodes. Aucune licence de dépôt n'est présentée comme une autorisation d'exploiter toute référence, identité, marque ou sortie de modèle.

## yihui-dev/awesome-opus5-5-videos

Révision consultée : `92aee2f586ac0715cb3cbcb6384834f98a33383d` (commit du 13 octobre 2026). Le [README épinglé](https://github.com/yihui-dev/awesome-opus5-5-videos/blob/92aee2f586ac0715cb3cbcb6384834f98a33383d/README.md) décrit une collection de prompts et de liens vers des animations produites par du code HTML, Canvas, SVG ou Three.js. Le nom du dépôt et ses mentions de modèle sont des affirmations de sa présentation ; ils ne déterminent ni le modèle utilisé par Braand ni ses capacités.

Le [fichier de licence racine](https://github.com/yihui-dev/awesome-opus5-5-videos/blob/92aee2f586ac0715cb3cbcb6384834f98a33383d/LICENSE) fournit MIT, avec attribution à yihui-dev. Le README attribue également chaque vidéo et prompt à son créateur et certains prompts sont partiels. Cette sélection ne présume aucune autorisation d'exploiter les vidéos, marques, captures, musiques ou photos des auteurs et de leurs sources. Aucun média, code ou prompt amont n'est importé dans Braand ; les pages ont été lues comme références documentaires, sans exécuter leurs commandes ni regarder ou évaluer les vidéos liées.

Exemples examinés et pertinence retenue :

- [Lancement d'application](https://github.com/yihui-dev/awesome-opus5-5-videos/blob/92aee2f586ac0715cb3cbcb6384834f98a33383d/prompts/screeendev-981790.md), attribué à @Screeendev : démonstration courte d'un produit avec une progression compréhensible. Le prompt partiel ne constitue pas un moteur de production.
- [Film de lancement produit](https://github.com/yihui-dev/awesome-opus5-5-videos/blob/92aee2f586ac0715cb3cbcb6384834f98a33383d/prompts/ultimaxbt-549714.md), attribué à @ultimaxbt : préparation d'une séquence chronométrée avec références de produit. Ne pas reprendre ses ressources par défaut, sa charte ou son scénario.
- [Rendu à partir des numéros d'images](https://github.com/yihui-dev/awesome-opus5-5-videos/blob/92aee2f586ac0715cb3cbcb6384834f98a33383d/prompts/0xkarmi-129839.md), attribué à @0xKarmi : séparer la description d'une animation, sa production, son encodage et ses contrôles. Les résultats de qualité rapportés par l'auteur n'ont pas été vérifiés ici.
- [Vérification d'une animation](https://github.com/yihui-dev/awesome-opus5-5-videos/blob/92aee2f586ac0715cb3cbcb6384834f98a33383d/prompts/fleyta88-443662.md), attribué à @fleyta88 : contrôler des instants clés et corriger localement plutôt que réécrire toute la séquence. Ses durées et ses outils ne deviennent pas des réglages Braand obligatoires.

Décision : enrichir `braand-video-direction` avec une [référence française originale sur le motion design](../skills/braand/media/braand-video-direction/references/motion-design.md). Elle couvre le teaser produit, la démonstration à partir de captures autorisées, l'explication d'un bénéfice et la typographie animée. Le livrable actuel est une direction créative exploitable et un storyboard chronométré ; une proposition média reste conditionnée aux capacités exactes du catalogue.

`create_page` accepte des sections JSON et échappe les chaînes ; ce n'est pas un environnement d'exécution HTML/Canvas/JavaScript. Aucun moteur de rendu d'animation codée, encodeur MP4, outil de montage ou dépendance Remotion/GSAP/FFmpeg n'est ajouté par cette livraison. Les contrôles d'images ou de vidéo ne doivent être annoncés comme réalisés qu'après accès au résultat et utilisation d'un outil adapté. Les jeux, simulations 3D et démonstrations techniques hors marketing restent hors de cette sélection.

## Contrat d'exécution conservé

Les compétences utilisent les outils effectivement exposés par `lib/agent.ts` et les tâches de `lib/media-routing.mjs` :

1. Lire les références pertinentes de l'espace, puis appeler `media_catalog` pour le catalogue validé et ses schémas bornés.
2. Préparer uniquement des paramètres compatibles avec les capacités réelles. `prepare_media({title, rationale, task, input, maxCredits})` enregistre une proposition sans génération ni débit.
3. Attendre l'approbation de cette proposition exacte dans l'interface. Le serveur vérifie notamment la version, le modèle, les paramètres et le devis ; tout changement nécessite une nouvelle proposition. Aucun CLI ou accès réseau direct n'est autorisé par une compétence.
4. Relire l'état réel avec les outils disponibles. `search_workspace` permet la lecture des ressources `proposal` et `media` ; une proposition envoyée ou en génération n'est pas un média `ready`.
5. Commencer une étape dépendante seulement avec une sortie prête et acceptée comme référence, puis obtenir l'approbation exacte de la nouvelle proposition. Une erreur ou un état incertain ne déclenche ni relance payante automatique ni substitution de modèle.

Le budget d'une production est cumulatif : additionner les coûts consommés, les engagements en cours, les devis en attente et la prochaine proposition, sans double comptage. Un même plafond global ne se réutilise pas comme enveloppe indépendante pour chaque variante. Un catalogue vide ou incompatible donne un brief ou plan avec sa limite explicite, sans exécution de remplacement.

Les agents n'administrent pas les clés, les tarifs ou le catalogue. Ils ne prétendent pas effectuer un montage, une inspection visuelle, une écoute, un export, une publication ou une tâche hors ligne sans outil et résultat qui le confirment. La protection de l'identité du produit, des personnes et de la marque fait partie du brief ; les marges de texte et de logo se règlent selon le placement réel.

Les licences et l'état des dépôts restent ceux des révisions indiquées. Les modèles, tarifs, paramètres et conditions commerciales peuvent évoluer ; ils doivent être vérifiés par l'administration avant d'entrer dans le catalogue Braand, jamais figés dans ces compétences.
