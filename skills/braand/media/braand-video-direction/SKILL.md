---
name: braand-video-direction
description: Concevoir des vidéos courtes de produit, démonstration ou publicité avec intention, plans et continuité, puis proposer uniquement les créations couvertes par le catalogue Braand.
metadata:
  version: "1.1.0"
  author: "Braand"
  origin: "original"
---

# Direction vidéo courte

Concevoir une séquence facile à comprendre sur son placement réel. Commencer par ce que le spectateur doit remarquer, comprendre et faire ; choisir ensuite les plans et le mouvement.

Pour un teaser produit, une démonstration d'application, un bénéfice expliqué ou de la typographie animée, lire [la référence motion design](references/motion-design.md). Elle aide à préciser le storyboard et le rythme ; elle n'ajoute aucun moteur d'animation ou de rendu aux outils Braand.

## Diriger la séquence

Lire les ressources pertinentes de l'espace avec `search_workspace`. Reprendre l'offre, le public, la charte et les médias approuvés. Fixer la durée et le format en fonction du brief et des capacités disponibles, sans attribuer au produit une propriété non établie.

Décrire la progression en quelques moments utiles : élément qui attire l'attention, démonstration ou bénéfice visible, puis fin lisible portant l'action attendue. Le nombre de plans découle du message et du budget ; ne pas multiplier les générations pour remplir une structure.

Pour chaque plan, préciser le sujet et son action, le cadrage, un mouvement de caméra lisible, la lumière, le décor, le lien avec le plan suivant et l'état final attendu. Séparer le mouvement du sujet de celui de la caméra pour éviter une description contradictoire. Prévoir la durée de lecture des éventuels sous-titres et garder le sujet, les textes et le logo hors des zones de recouvrement connues du placement ; ne pas inventer des dimensions de sécurité officielles.

Conserver les éléments de continuité : produit, proportions, couleurs, visage ou personnage autorisé, vêtements, accessoires, direction de lumière et orientation des mouvements. Réutiliser les références validées plutôt que redécrire une identité de manière approximative. Pour une personne identifiable, un témoignage, une voix ou une imitation, vérifier que l'usage demandé est autorisé ; ne pas transformer une création fictive en avis client authentique.

## Passer à une proposition

1. Appeler `media_catalog`. Retenir uniquement les durées, formats, références et capacités audio réellement couverts par ses schémas bornés. Ne pas promettre son, parole synchronisée, montage, sous-titrage ou export si aucun outil disponible ne les réalise.
2. Choisir `video_short` pour une séquence simple, `video_narrative` lorsque le récit le justifie, ou `video_reference` pour des références utilisables et autorisées. L'intitulé d'une tâche ne prouve pas qu'un modèle accepte tous ces besoins.
3. Composer `input` selon le schéma validé, sans paramètres supposés, modèle ou prix recopiés d'une source externe. Un storyboard peut être livré seul lorsqu'une capacité manque.
4. Appeler `prepare_media` avec `title`, `rationale`, `task`, `input`, `maxCredits` sous le plafond connu du mandat. Si le plafond manque, finaliser la direction et le faire préciser. L'outil prépare une proposition exacte ; il ne génère ni ne débite.
5. Attendre l'approbation de cette proposition dans l'interface Braand. Ne pas appeler genmedia, un shell, du réseau brut ou une clé fournisseur. Tout changement d'entrées, de modèle ou de coût appelle une nouvelle proposition approuvée.

Si le catalogue est vide, non configuré ou incompatible, livrer le storyboard et signaler la capacité manquante. Pour plusieurs plans ou créations, déduire du budget total les coûts déjà consommés, les opérations encore engagées et les devis en attente, sans compter deux fois une même opération ; ne pas réutiliser le budget total comme plafond de chaque proposition.

Après approbation, relire les ressources de type `proposal` et `media` avec `search_workspace` ou un outil de lecture disponible. Attendre un média `ready` et son résultat effectif. Ne pas annoncer une vidéo terminée sur la base d'un statut d'envoi. Une étape suivante dépendante ne commence qu'après résultat prêt, vérifié dans la mesure des capacités réelles et accepté comme référence ; elle exige sa propre approbation de coût.

## Vérifier le résultat

Lorsque le rendu est consultable, vérifier l'identité du produit et des personnes, la continuité, les déformations, les mouvements, la lisibilité et la fin de plan. Vérifier l'audio seulement s'il existe et a été effectivement écouté. Sinon, signaler le contrôle encore nécessaire sans prétendre l'avoir fait.

Livrer la ressource prête avec sa destination prévue et les réserves observées. En cas d'échec ou de résultat incertain, conserver les identifiants et l'état connu, puis arrêter les relances automatiques. Ne jamais promettre une continuation hors ligne, une publication ou un lancement publicitaire sans confirmation d'un outil adapté.

Pour préparer une livraison vidéo complète, des corrections ciblées ou des déclinaisons, lire [le contrat de production](references/production-contract.md).
