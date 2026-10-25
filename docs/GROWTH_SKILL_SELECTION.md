# Sélection des méthodes de croissance Braand

Audit du 23 octobre 2026. Ce lot ajoute huit méthodes au catalogue interne, qui en compte désormais 25. La sélection vise les décisions marketing et les livrables qu'Braand peut préparer avec ses outils actuels : comprendre le client, construire une offre, améliorer l'activation, tester une hypothèse, rédiger des séquences et adapter des contenus. Elle ne constitue pas un classement universel des agents ou des services.

Les fichiers importés sont des textes de référence sous licence vérifiée. Les stratégies originales Braand sont écrites indépendamment. Aucun service de publication, d'analytics, d'expérimentation ou de rendu vidéo n'est installé ou activé par ce lot. Le [guide du runtime](AGENT_SKILLS.md) décrit la recherche, la lecture à la demande, les budgets partagés et les autorisations.

## Ce qui est ajouté

Le premier besoin est de relier une recommandation à une preuve client et à un résultat observable. Cinq méthodes complètent donc le snapshot marketing existant :

- `customer-research` prépare la recherche client et exploite les éléments fournis, sans lancer de collecte ni contacter des personnes.
- `offers` structure une offre et ses conditions. Les prix, garanties, preuves et disponibilités doivent venir de l'entreprise ; un exemple de rareté ne prouve pas une contrainte réelle.
- `ab-testing` prépare une hypothèse, une métrique principale, les limites du test et ses critères de décision. Il ne répartit pas de trafic et n'installe pas d'instrumentation.
- `emails` prépare des brouillons et des séquences ; il n'importe pas de contacts et n'envoie ni ne programme d'emails.
- `onboarding` cherche le premier résultat utile et les obstacles du parcours, à partir des données réellement accessibles.

Deux méthodes sociales répondent à des besoins distincts : `cross-platform-repurposing` transforme une source en variantes adaptées à chaque plateforme ; `crisis-and-moderation` distingue critique, réclamation et abus, prépare une réponse factuelle et une escalade humaine. Aucune des deux ne donne un droit de publication, de réponse ou de suppression.

La méthode originale `braand-growth-strategy` relie ces travaux. Elle commence par le goulot prioritaire, choisit un canal principal et une alternative conditionnelle, puis définit un test et un plan adaptable sur 30 jours. Les métriques précisent numérateur, dénominateur, unité, source et période. Les conditions de décision dépendent du budget, de la marge, de la capacité de livraison et des volumes du client ; les variations avant/après ne sont pas présentées comme une preuve causale.

Sa référence `marches-locaux.md` vérifie les facteurs qui changent réellement une décision : langue, devise, découverte, confiance, conversation, paiement, livraison et accès technique. Un pays ou un continent ne suffit pas à supposer un usage, une connexion disponible ou un moyen de paiement. WhatsApp, le SMS, une page ou un formulaire sont évalués selon le segment et les outils effectivement accessibles. Aucun frais, taux de change, consentement ou résultat local n'est inventé.

## Sources dont le texte est conservé

### Corey Haines — Marketing Skills

[Révision e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b](https://github.com/coreyhaines31/marketingskills/commit/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b), datée du 19 octobre 2026. La notice racine est MIT. Les cinq ajouts représentent 23 fichiers Markdown, dont 18 références, soit 205 328 octets supplémentaires. Le snapshot complet sélectionné contient treize méthodes, leurs références et la notice : 84 fichiers, 834 021 octets.

Les octets amont sont inchangés. Le [manifest local](../skills/vendor/marketing/manifest.json) donne chaque chemin, URL épinglée, objet Git, empreinte SHA-256 et taille ; [l'importateur](../scripts/import-marketing-skills.mjs) vérifie la sélection. Les guides d'intégration, scripts, installateurs, assets HTML et compétences non sélectionnées restent exclus. Les chemins de travail locaux et les liens vers d'autres skills ne créent aucune ressource implicite dans Braand.

`marketing-plan` n'est pas importé : son workflow suppose d'autres fichiers et intégrations, et un de ses exemples dépasse la limite de fichier du runtime. La stratégie originale conserve un périmètre adapté aux outils Braand. Les méthodes de parrainage et de psychologie ne sont pas prioritaires dans ce lot ; leur utilité dépendrait notamment de preuves de rétention et du contexte de décision.

### Social Media Skills

[Révision f28cef2b7067ec64e79c9d85421c022c06659e03](https://github.com/social-media-skills/skills/commit/f28cef2b7067ec64e79c9d85421c022c06659e03), datée du 15 octobre 2026. La notice racine et les deux compétences sélectionnées indiquent MIT. Le snapshot contient les deux `SKILL.md`, huit références Markdown et la notice : 11 fichiers, 40 784 octets.

Le [manifest local](../skills/vendor/social/manifest.json) et [l'importateur social](../scripts/import-social-skills.mjs) épinglent les sources, chemins, tailles, objets Git et empreintes attendus. La vérification hors ligne refuse notamment un manifest incomplet, un fichier supplémentaire, une empreinte altérée ou une traversée de répertoire. La réacquisition réseau est explicite et valide les fichiers avant écriture.

Les fichiers `brand-profile.md`, `voice.md`, `social-strategy.md` et `audience-research.md` décrivent l'environnement amont. Braand utilise ses connaissances d'espace validées via `search_workspace`. Les compétences liées mais absentes restent indisponibles. Les mentions de WoopSocial et de Postiz ne connectent ni leur API, ni leur CLI, ni leur MCP.

## Sources consultées sans reprise de texte

### OpenCMO

[Révision b45e0a717fa6c076ea8bb248001dab33f8c49e51](https://github.com/About-Intelligence/OpenCMO/commit/b45e0a717fa6c076ea8bb248001dab33f8c49e51), datée du 2 septembre 2026. La licence distingue la structure et les analyses originales sous MIT des citations de tiers réservées à la recherche et à l'éducation. Braand ne reprend ni ces citations, ni les portraits, ni les textes du dépôt. La méthode de croissance originale n'est attribuée à aucun expert et ne suppose pas son approbation.

### PostHog

[Révision 473432f3fbbe053bf964722f26b9c0c2a153d255](https://github.com/PostHog/posthog.com/commit/473432f3fbbe053bf964722f26b9c0c2a153d255), datée du 23 octobre 2026. La notice du dépôt applique MIT au répertoire `/contents/`, sans étendre cette permission au reste du site et à son design. Aucun texte, design ou SDK n'est copié dans ce lot.

Les documents primaires sur [l'activation](https://posthog.com/docs/new-to-posthog/activation), [la rétention](https://posthog.com/docs/product-analytics/retention), [les entonnoirs](https://posthog.com/docs/product-analytics/funnels) et [la préparation d'une expérience](https://posthog.com/docs/experiments/creating-an-experiment) éclairent les définitions de premier résultat utile, de cohorte et de métrique préalable. Ils ne prouvent aucune collecte d'événements dans Braand ni chez un client.

### GrowthBook

[Révision 7a84f338fe217b20641cdc5c01b5b37f0b950527](https://github.com/growthbook/skills/commit/7a84f338fe217b20641cdc5c01b5b37f0b950527), licence MIT. Les compétences d'expérience supposent un outil Bash, des appels API et une clé GrowthBook ; elles ne sont pas importées. La [documentation des résultats](https://docs.growthbook.io/app/experiment-results) sert à distinguer qualité d'exposition, déséquilibre d'échantillon et lecture des résultats. Braand ne doit pas inventer une puissance statistique, une significativité ou un intervalle ; les méthodes fréquentistes et bayésiennes demandent leurs définitions et données propres.

## Intégrations différées

Ces projets peuvent répondre à une étape ultérieure, mais nécessitent une capacité d'exécution, une exploitation ou un examen de licence distincts. Leur présence dans une liste de recommandations n'est pas une installation.

- **Postiz Agent** : [révision 17f1e27b006c02cb46c64e8a319dc75dcfd870d2](https://github.com/gitroomhq/postiz-agent/commit/17f1e27b006c02cb46c64e8a319dc75dcfd870d2), datée du 22 octobre 2026. La notice indique AGPL-3.0-or-later et le package AGPL-3.0 ; aucune licence permissive distincte du skill n'a été identifiée. L'incorporation directe est différée pour examiner les obligations et le mode de déploiement, sans qualifier le projet d'interdit. Aucun CLI, OAuth, upload ou compte n'est ajouté.
- **n8n** : la [licence officielle consultée](https://github.com/n8n-io/n8n/blob/master/LICENSE.md) est la Sustainable Use License, avec des fichiers Enterprise distincts. Ses restrictions d'usage et les conditions d'une intégration dans un SaaS demandent un examen propre. Aucun moteur n8n ni workflow externe n'est installé.
- **HyperFrames** : [révision 3cdae3804e5f155903adfce32ddf81db290c04b3](https://github.com/heygen-com/hyperframes/commit/3cdae3804e5f155903adfce32ddf81db290c04b3), notice racine Apache-2.0. Son intérêt suppose un moteur de rendu HTML/vidéo et une chaîne d'export. Ces capacités ne sont pas présentes dans les outils Braand ; ses compétences ne sont pas importées.
- **Remotion Skills** : [révision 6c67adcd9cdbe6eb84d76342da89b225f9161cb2](https://github.com/remotion-dev/skills/commit/6c67adcd9cdbe6eb84d76342da89b225f9161cb2). Aucune notice de licence racine n'a été identifiée lors de l'audit de ce dépôt ; une licence trouvée dans un fork ou des métadonnées de plugin ne vaut pas permission pour cette révision. La licence du moteur d'exécution est une question distincte. Aucun texte ni moteur Remotion n'est importé.
- **Autres outils vidéo ou de publication cités dans la liste** : aucune compétence n'est récupérée sans source canonique, licence applicable et utilité vérifiées. Les méthodes originales média déjà présentes préparent la direction et les étapes de production ; elles n'exécutent pas du code d'animation et ne rendent pas un MP4.

Une future connexion analytics, d'expérimentation ou de publication devra définir ses données d'entrée, l'isolation par espace, les secrets, les permissions, les validations exactes, les coûts et les retours d'échec. Ce sont des travaux logiciels distincts du chargement de prose.

## Contrôles et portée de la validation

Les commandes de vérification, réacquisition et génération sont dans [AGENT_SKILLS.md](AGENT_SKILLS.md). Les tests ciblés contrôlent la découverte des huit ajouts, la provenance, les lectures et références autorisées, les budgets partagés, les droits et la réduction des événements publics. Le contrôle de construction vérifie que les textes sont chargés à la demande dans les chunks serveur et absents des bundles navigateur.

Ces contrôles ne mesurent ni la qualité d'un modèle distant, ni sa latence, ni une hausse de conversion ou de rétention. La qualité commerciale demandera des cas représentatifs, des critères de réussite définis et des résultats observés. Le runtime conserve ses permissions et validations existantes ; un texte de compétence ne constitue jamais une autorisation de dépense, d'envoi, de publication ou de modération.
