---
name: aira-product-visuals
description: Préparer des photographies produit, mises en scène et visuels publicitaires pour une marque, puis proposer leur génération dans le circuit média Braand.
metadata:
  version: "1.0.0"
  author: "Braand"
  origin: "original"
---

# Visuels produit et publicité

Transformer une offre réelle en direction visuelle précise. Un visuel sert une intention commerciale ; il ne constitue ni une preuve de performance du produit ni une promesse de résultat publicitaire.

## Construire le brief

Lire les connaissances et médias pertinents de cet espace avec `search_workspace`. Réutiliser le produit, la charte et les références déjà fournis. Distinguer les faits confirmés des choix créatifs. Ne demander que les informations qui changent le rendu : produit à montrer, bénéfice vérifiable, public, emplacement et références indispensables.

Préciser :

- Le rôle du visuel : montrer fidèlement le produit, expliquer son usage, faire percevoir une matière ou attirer l'attention sur une offre confirmée.
- Les invariants : forme, proportions, couleurs, contenu et libellés du conditionnement. Une scène publicitaire ne doit pas inventer une fonction, une certification ou un accessoire vendu avec le produit.
- La mise en scène : cadrage et point de vue, support, échelle, lumière, ombres, arrière-plan et objets secondaires utiles au message.
- L'espace destiné au titre, au prix et au logo, avec des marges adaptées au placement prévu. Une zone calme et une bonne lisibilité priment sur une scène chargée.

Une référence produit sert à conserver son identité. Une référence d'ambiance sert à décrire la lumière ou la composition ; ne pas la traiter comme une autorisation de reprendre une autre marque. Respecter les personnes et les droits d'usage des références. Si une personne identifiable doit être réutilisée et que l'autorisation est ambiguë, clarifier ce point avant de transmettre son image.

## Préparer le média

1. Appeler `media_catalog` et ne retenir que les capacités, paramètres et coûts validés qu'il retourne. Le catalogue Braand est borné ; aucun modèle, prix, endpoint ou accès illimité ne vient de cette compétence.
2. Choisir `image` pour une création, `image_edit` pour travailler depuis un média existant. Utiliser `image_precision` ou `image_edit_precision` seulement si le besoin de fidélité le justifie et si le catalogue couvre les entrées requises. Ne pas promettre une reproduction parfaite.
3. Construire `input` avec les seuls champs et bornes du schéma retenu. Inclure les références autorisées sous la forme acceptée ; ne pas inventer une URL ou un champ pour contourner une capacité absente.
4. Appeler `prepare_media` avec `title`, `rationale`, `task`, `input` et un `maxCredits` compatible avec le plafond connu du mandat. Si ce plafond manque, terminer le brief et le faire préciser avant la proposition. Cet appel enregistre une proposition, sans génération ni débit.
5. Présenter la proposition exacte et attendre son approbation dans l'interface Braand. Une modification du modèle, des entrées ou du coût exige une nouvelle proposition. Aucun shell genmedia, réseau brut, clé ou appel fournisseur ne remplace cette approbation.

Si le catalogue est vide, non configuré ou incompatible avec le brief, livrer la direction préparée et signaler la capacité manquante. Pour plusieurs créations, déduire du budget total les coûts déjà consommés, les opérations encore engagées et les devis en attente, sans compter deux fois une même opération ; ne pas réutiliser le budget total comme plafond de chaque proposition.

Après l'approbation, relire la proposition et le média avec les outils disponibles, notamment `search_workspace` pour les types `proposal` et `media`. Une proposition approuvée ou `generating` n'est pas un livrable : attendre le média `ready` et son résultat effectif. En cas d'état incertain, ne pas relancer automatiquement.

## Contrôler et livrer

Vérifier le produit, le conditionnement, les éléments en trop, le cadrage et la place du texte. Préférer les vrais fichiers de logo et une composition distincte lorsqu'un outil adapté est disponible ; ne pas certifier un texte ou un logo simplement parce qu'il apparaît dans le prompt. Si aucun outil ne permet l'assemblage final, livrer le visuel et les consignes de composition en indiquant cette limite.

Ne déclarer un contrôle visuel que si le rendu a réellement été consulté. Remettre la ressource disponible, le concept et les réserves observables. Toute reprise payante passe par une nouvelle proposition et son approbation exacte ; la publication ou le lancement d'une publicité reste une action distincte.
