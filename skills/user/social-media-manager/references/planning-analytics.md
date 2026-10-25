# Planification, analyse et rapports

## Sommaire
1. Piliers éditoriaux
2. Construire un calendrier
3. Choisir les créneaux
4. Campagne en phases
5. Indicateurs et formules
6. Rapport hebdomadaire
7. Audit de compte
8. Expériences
9. Quand les données manquent

## 1. Piliers éditoriaux

Définis 3 à 5 piliers dans la fiche marque. Gabarit courant :

| Pilier | Rôle | Exemples |
|---|---|---|
| Éducation | prouver l'expertise | conseils, tutoriels, mythes et vérités |
| Preuve sociale | rassurer | témoignages (avec accord), résultats, avant/après honnêtes |
| Coulisses | humaniser | équipe, fabrication, journée type |
| Offre | convertir | produit, promo, lancement, rappel de réservation |
| Communauté | engager | questions, sondages, réponses aux commentaires, jeux |

Répartition indicative : la majorité en valeur (éducation, preuve, coulisses, communauté) et une minorité en offre (environ 20 à 30 %). Le validateur signale un lot trop promotionnel (champ `pillar`). Ajuste selon le métier : un e-commerce en période de soldes peut dépasser, un cabinet de conseil non.

## 2. Construire un calendrier

1. Récupère les contraintes : fréquence tenable par l'utilisateur, jours de fermeture, événements, lancements, fêtes (voir `africa-francophone.md` pour le contexte local).
2. Fixe la fréquence par réseau selon la capacité réelle (la régularité compte plus que le volume). Départ réaliste pour une petite structure : Instagram 3 à 4 posts par semaine, Facebook 3, LinkedIn 2, TikTok 2 à 3.
3. Place d'abord les temps forts (lancement, événement), puis répartis les piliers sans enchaîner deux contenus promotionnels.
4. Alterne les formats (image, carrousel, vidéo, texte) pour tester ce qui fonctionne.
5. Garde 1 ou 2 créneaux "libres" pour l'actualité ou une opportunité.
6. Produis le lot en pack JSON, valide, exporte en CSV (`--csv`) pour que l'utilisateur voie la vue calendrier.
7. Présente les cartes d'approbation par jour ou par semaine ; ne planifie qu'après validation.

Travaille en lots : une session de création pour 1 à 2 semaines évite l'improvisation quotidienne.

Planifie aussi la **continuité** : si l'utilisateur est absent, propose des contenus évergreen en réserve et dis clairement ce qui sort sans lui.

## 3. Choisir les créneaux

Priorité aux données de l'utilisateur : avec au moins 20 publications et leurs statistiques, calcule les créneaux où la portée moyenne est la meilleure et vérifie qu'ils ne reposent pas sur un seul post exceptionnel.

Sans données, utilise des repères prudents, présentés comme des hypothèses à tester : pour une audience grand public, pause de midi et soirée en semaine ; week-end en fin de matinée ou début de soirée ; LinkedIn plutôt les matins de semaine. Tiens compte du fuseau de **l'audience**, pas de celui de l'agent, et de la vie locale (heures de travail, prière, transports).

Décale légèrement les publications d'un même message sur plusieurs réseaux (10 à 30 minutes) plutôt qu'à la minute exacte.

## 4. Campagne en phases

| Phase | Objectif | Contenu type |
|---|---|---|
| Teaser | créer l'attente | indices, compte à rebours honnête |
| Lancement | informer | annonce complète, tous réseaux |
| Preuve | rassurer | premiers retours, démonstrations, FAQ |
| Rappel | convertir | dates limites réelles, derniers créneaux |
| Bilan | fidéliser | résultats, remerciements, suite |

Définis avant de commencer : objectif chiffré, indicateur principal, durée, budget éventuel, canal de conversion (lien, WhatsApp, boutique). Pas d'urgence artificielle : une fausse rareté détruit la confiance.

## 5. Indicateurs et formules

Choisis les indicateurs selon l'objectif.

| Objectif | Indicateurs principaux |
|---|---|
| Notoriété | portée, impressions, vues vidéo, nouveaux abonnés |
| Engagement | taux d'engagement, enregistrements, partages, commentaires |
| Conversion | clics sur le lien, messages WhatsApp ou DM reçus, demandes de devis, ventes attribuées |
| Communauté | taux de réponse, délai de réponse, croissance qualitative |

Formules (à écrire dans le rapport pour être vérifiables) :

- **Taux d'engagement par portée** = (réactions + commentaires + partages + enregistrements) ÷ portée × 100
- **Taux de clic** = clics ÷ impressions × 100
- **Croissance d'audience** = (abonnés fin − abonnés début) ÷ abonnés début × 100

Les définitions varient selon la plateforme : écris celle que tu utilises. Pour mesurer les clics, utilise des liens avec paramètres UTM (`utm_source`, `utm_medium`, `utm_campaign`) ; pour WhatsApp, un message pré-rempli différent par campagne permet de relier les contacts au post.

## 6. Rapport hebdomadaire

Modèle : `assets/weekly_report_template.md`. Structure :

1. **Résumé en 3 lignes** : ce qui a marché, ce qui a déçu, ce qu'on change.
2. **Chiffres clés** vs semaine précédente (avec la source de chaque chiffre).
3. **Top 3 et flop 3 des contenus**, avec une hypothèse sur la cause (marquée comme hypothèse).
4. **Communauté** : commentaires et messages notables, questions récurrentes, signaux d'alerte.
5. **Décisions** : 3 actions concrètes pour la semaine suivante.
6. **Expériences en cours** et résultat provisoire.

Si tu n'as pas accès aux statistiques, demande une capture ou un export. Sans cela, écris "données non disponibles" : un rapport avec des chiffres inventés est pire que pas de rapport.

## 7. Audit de compte

Quand l'utilisateur demande "pourquoi ça ne marche pas ?" :

- **Profil** : photo, nom, bio (promesse claire, CTA, lien, mots-clés), catégorie, coordonnées, WhatsApp.
- **Contenu** : 20 derniers posts classés par performance, diversité des formats et piliers, qualité visuelle, régularité.
- **Voix** : cohérence, personnalité, clarté de l'offre.
- **Communauté** : délai de réponse, commentaires sans réponse, avis.
- **Conversion** : parcours depuis le post jusqu'à l'achat ou le contact (combien de clics ?).
- **Concurrence** : 3 comptes comparables ; ce qu'ils font que l'utilisateur ne fait pas (inspiration, jamais copie).

Rends 3 constats prioritaires, 3 actions immédiates, 3 chantiers à un mois. Pas une liste de 30 conseils.

## 8. Expériences

Une hypothèse, une variable, un critère de réussite fixé avant. Exemple : "Les carrousels d'étapes obtiennent plus d'enregistrements que les photos seules." Publie au moins 5 contenus par variante avant de conclure. Documente le résultat dans la fiche marque (section "Ce qu'on a appris").

## 9. Quand les données manquent

- Dis-le clairement et explique ce qui manque.
- Propose la façon la plus simple de l'obtenir (export, capture, droit de lecture).
- Donne une recommandation prudente fondée sur les bonnes pratiques, marquée comme telle.
- N'extrapole pas à partir de deux posts.
