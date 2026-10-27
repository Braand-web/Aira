# Video & Motion Studio — livraison du 26 octobre 2026

## Code et versions déployées

- Code applicatif : `a85220971e55f9547a5e2eb0c3483db7c9a88485`, comprenant l’import `072f223` et la vérification des paramètres juste avant exécution.
- Dépôt : `Braand-web/Braand`, branche `main` et branche de travail `feat/video-motion-skill`, poussées sans réécriture d’historique.
- Préproduction `aira-staging` : `04c5491d-0dc7-43ee-bb80-ed611756e294`, à 100 %.
- Production `aira-production` : `aef26873-ebc3-46ee-900c-6f05dff76493`, à 100 %, sur `https://braand.fun/`.
- Même build déployé en préproduction puis en production, avec réutilisation des ressources existantes et provisionnement automatique désactivé. Aucune migration de base nécessaire.

## Fonctionnalités livrées

La compétence `video-motion-studio`, intitulée « Montage vidéo et motion design », rejoint les 29 méthodes existantes. Le harness la découvre et charge progressivement ses guides et modèles. L’adaptation Braand précède les instructions originales et décrit les outils réellement disponibles, les budgets et les limites.

Les outils `prepare_video_edit` et `get_video_edit_result` complètent l’assemblage et l’inspection existants. Le contrat de montage v2 permet cadrage, zoom d’image fixe, couleurs prédéfinies, fondus, volume et sous-titres. Le service privé produit un contrôle technique réel et six images dans une planche-contact. La revue visuelle reste explicitement limitée aux images échantillonnées.

L’approbation porte sur les paramètres et le tarif exacts. Le Worker recalcule aussi l’empreinte avant de contacter le moteur. Un changement postérieur à l’accord est bloqué sans envoi externe ; un résultat incertain conserve la réservation et n’est pas relancé automatiquement.

Voir [le contrat et les limites](../VIDEO_MOTION_STUDIO.md).

## Vérifications exécutées

- TypeScript, ESLint, build et contrôle des artefacts : réussis.
- 192 tests unitaires : réussis.
- Suites de services : réussies, dont 20 contrôles de plateforme avec SQLite et 8 contrôles du harness des compétences.
- HTTP local : 24 contrôles API, 6 contrôles de connecteurs et 71 contrôles de fichiers, signatures et conservation réussis, sans services externes.
- Six contrôles Python de contrat et un rendu FFmpeg/ffprobe synthétique réel : réussis. Vidéo, sous-titres, zoom, durée, dimensions, cadence, décodage et planche-contact produits et vérifiés localement. Ce test n’a utilisé aucun média client.
- 59 artefacts JavaScript client inspectés : aucune fuite des extraits privés, chemins internes ou provenances testés. Neuf extraits du corpus, dont celui de la nouvelle compétence, sont présents dans des modules serveur chargés à la demande.
- Nouvelle lecture de configuration après déploiement : les 65 bindings de production et les 58 de préproduction sont conservés, avec mêmes variables, références de secrets, ressources et déclencheurs. Les deux horaires et files existants sont conservés.
- Route `braand.fun/*` toujours liée au Worker de production ; son identifiant technique a été régénéré par Wrangler, sans changement de destination ni de définition.
- Production : accueil, aide et cinq assets HTTP 200 ; `/api/health` HTTP 200 avec `status: ok` ; contrôle assistant HTTP 200 avec `assistantReady: true` et tarification disponible.
- Sans session : compétences, capacités, état d’un montage et résumé de facturation HTTP 401.
- `/pricing` redirige toujours vers les paramètres de facturation. Catalogue public : 15 crédits de bienvenue pour 7 jours. Paiement hébergé et règles commerciales conservés.

## Activation du moteur : limite restante

La compétence et le code des outils sont installés. Les rendus avancés ne sont pas activés en production : `MEDIA_RENDER_ENABLED` et `MEDIA_RENDER_STAGING_VERIFIED` restent à `false`, et le nouveau drapeau `MEDIA_RENDER_VIDEO_EDIT_VERIFIED` n’est pas ajouté.

Le conteneur FFmpeg est un service distinct du Worker. Son hébergement, sa connexion privée, son tarif et sa recette distante restent nécessaires avant activation. Les agents peuvent dès maintenant exploiter la méthode pour un script, une direction ou un storyboard ; ils ne doivent pas annoncer un fichier rendu par un moteur absent. Aucun moteur Remotion, effet anime complexe ou détection de rythme n’est déclaré actif.

Aucun rendu distant payant, e-mail, publication sociale ou nouveau compte de production n’a été déclenché pendant cette recette. Aucun parcours visuel connecté de production n’est présenté comme vérifié ; les contrôles authentifiés du catalogue et des propositions ont été réalisés localement.
