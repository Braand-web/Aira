# État de production — Braand, 26 octobre 2026

Le Worker existant est **aira-production**, sur **https://braand.fun/**. Les anciens relevés du 24 octobre décrivent une phase antérieure et ne doivent plus servir à décider de l’activation de l’authentification ou de Resend.

## Fonctions déjà ouvertes

- Authentification indépendante par lien e-mail, création de compte après vérification et retour au brouillon. Resend live approuvé.
- Chat OpenRouter, tarification actualisée et routage adaptatif. La capacité du modèle peut être choisie par le cerveau principal dans les limites serveur, sans changer d’identité, d’historique, de droits ou de plafond de crédits.
- Facturation hébergée SasPay live ; renouvellement manuel. Un parcours ouvert ne prouve pas un encaissement réussi.
- D1 et R2 privés, file de travail et crons configurés. La présence d’une file ne signifie pas qu’une mission est activée.

## Ouverture demandée le 26 octobre

Le propriétaire autorise l’activation et le déploiement. Les interrupteurs produit peuvent être ouverts lorsque leurs dépendances sont présentes. Les attestations de validation ne doivent être renseignées qu’après les contrôles correspondants.

- Les pièces jointes avancées disposent de leurs schémas, lecteurs, quotas, contrôle de type et signatures ; le déploiement d’activation conserve les clés existantes.
- Les allowlists d’administration doivent désigner uniquement l’utilisateur propriétaire vérifié, jamais tous les propriétaires de tous les espaces.
- Le moniteur transforme les anciens verrous expirés en état incertain sans rejouer leurs effets externes.
- Les missions conservent mandat explicite, droits, limites de durée et crédits ; aucune activation produit n’approuve une mission ou une publication à la place d’un utilisateur.

## Prérequis à ne pas déclarer vérifiés par configuration seule

- Recherche : transport réel compatible, sources et coûts contrôlés.
- Navigateur : coût fournisseur, propriétaire durable, interruption, protection réseau et reprise sûre sur le déploiement cible.
- Médias : clé fal, catalogue de modèles tarifés et service de rendu configurés ; aucune valeur inventée.
- Social : comptes utilisateur connectés et recettes de publication réellement vérifiées par réseau.
- Meta natif : paramètres OAuth et autorisations requis ; Composio ne les remplace pas pour le tableau de bord natif.
- Pages : origine d’hébergement public séparée de l’application.
- Sauvegarde : fenêtre sans écritures explicitement établie ; ne pas laisser BACKUP_MAINTENANCE_CONFIRMED=true sur une application recevant des écritures. Restaurer uniquement vers une destination isolée et vide.

## Référence et preuves de publication

Déployer uniquement le commit exact ayant réussi le CI et son artefact vérifié. Préserver les bindings, secrets, routes et files existants. Enregistrer la version précédente, la nouvelle version, les variables réellement modifiées et les tests dans un reçu local. Contrôler l’accueil, la préparation du modèle et le refus des accès anonymes après déploiement. Un test simulé ne prouve pas un paiement, une publication ni une génération média live.
