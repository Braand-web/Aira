---
name: aira-image-variants
description: Décliner un visuel approuvé en retouches ou formats cohérents pour une campagne, en conservant l'identité produit, la marque et une comparaison utile des variantes.
metadata:
  version: "1.0.0"
  author: "Aïra"
  origin: "original"
---

# Édition et variantes cohérentes

Partir d'un média de référence identifié et d'un changement précis. Une variante doit avoir une raison : adapter un placement ou tester une hypothèse créative, sans perdre les éléments qui font reconnaître l'offre.

## Définir ce qui change

Lire les médias et connaissances pertinents de l'espace avec `search_workspace`. Identifier la ressource, sa version et l'accord qui en fait la référence. Une image encore en génération ou non acceptée ne devient pas automatiquement la base d'une série.

Distinguer :

- L'adaptation de format : recadrer ou prolonger un fond, déplacer la zone de texte et ajuster la taille apparente du produit.
- La retouche locale : changer un élément délimité en conservant le reste de la scène.
- L'hypothèse publicitaire : varier un bénéfice confirmé, une situation ou une composition pour évaluer ensuite son effet.

Énoncer les invariants : produit et conditionnement, visage autorisé, couleurs de marque, matières, éléments légaux, offre et composition de référence. Pour une comparaison créative, varier un facteur principal à la fois lorsque cela permet une lecture utile ; ne pas présenter une différence comme un gain de performance sans données.

Pour chaque placement demandé, spécifier le ratio ou les dimensions, le cadrage, la position du sujet et les espaces nécessaires au texte et au logo. Vérifier les contraintes actuelles du placement si elles sont disponibles ; sinon présenter les marges comme une recommandation de composition. Garder le titre et le prix éditables si un outil d'assemblage approprié existe. Ne pas redessiner un logo officiel à partir de son nom.

## Utiliser les capacités disponibles

Un recadrage ou un placement de logo peut relever d'un outil d'édition déterministe. Utiliser cet outil seulement s'il est réellement disponible. À défaut, fournir les instructions de composition ou préparer une édition média ; ne pas affirmer qu'un export ou une transformation a été réalisé.

1. Appeler `media_catalog` pour connaître les entrées, références, formats, nombres de sorties et tarifs validés. Ne pas étendre le catalogue à partir de listes externes ou d'un nom de modèle mémorisé.
2. Choisir `image_edit`, ou `image_edit_precision` si le besoin et le catalogue le justifient. Préférer une instruction qui nomme le changement puis les invariants, avec la référence autorisée acceptée par le schéma. Ne pas supposer qu'un champ de masque, de graine ou de fidélité existe.
3. Préparer chaque `input` avec les bornes exactes du catalogue et un nombre fini de variantes demandé. Appeler `prepare_media` avec `title`, `rationale`, `task`, `input` et `maxCredits` compatible avec le plafond connu ; faire préciser ce plafond s'il manque. Aucune variante ne se génère à cette étape.
4. Attendre l'approbation de chaque proposition exacte dans l'interface Aïra. Une approbation ne couvre pas une série supplémentaire ni une retouche ultérieure. Ne pas contourner ce circuit par genmedia, un shell, du réseau brut ou une clé.
5. Relire les ressources `proposal` et `media` via `search_workspace` ou un outil de lecture disponible. Attendre le média `ready` et son résultat effectif. Si une variante doit servir à la suivante, attendre aussi son acceptation comme référence avant de préparer l'étape dépendante et sa nouvelle approbation.

Si le catalogue est vide, non configuré ou incompatible, livrer les consignes de déclinaison et signaler la capacité manquante. Pour la série, la somme des coûts déjà consommés, des opérations encore engagées, des devis en attente et de la nouvelle proposition doit rester dans le budget total, sans compter deux fois une même opération. Utiliser les coûts exacts retournés par les propositions ; ne pas réutiliser tout le budget comme plafond indépendant de chaque variante. Si le restant est incertain, clarifier l'état avant une nouvelle proposition.

## Livrer une série traçable

Associer chaque résultat à sa référence, son changement et son placement. Si le rendu a réellement été consulté, vérifier les invariants, les bordures prolongées, les petits textes, les logos et le cadrage. Sinon, expliciter les contrôles restant à effectuer.

Ne pas déclarer une série complète lorsqu'une partie attend approbation ou génération. En cas d'échec ou de résultat incertain, ne pas relancer la série. Proposer une correction ciblée avec nouveau coût validé et nouvelle approbation, sans dupliquer une opération dont l'état est inconnu.
