# Module Afrique francophone

À utiliser quand l'audience ou la marque se situe en Afrique francophone (Afrique de l'Ouest, centrale, Maghreb, océan Indien). Ce sont des repères d'usage, pas des vérités universelles : les pays, les villes et les secteurs diffèrent beaucoup. Vérifie avec les statistiques de l'utilisateur dès que tu en as, et demande-lui en cas de doute.

## Sommaire
1. Canaux et conversion
2. Contenu léger et accessible
3. Paiements et confiance
4. Langue et ton
5. Fuseaux horaires et créneaux
6. Calendrier des temps forts
7. Pièges à éviter

## 1. Canaux et conversion

- **Facebook** reste souvent le réseau le plus large pour l'audience grand public ; **WhatsApp** est très souvent le lieu où la vente se conclut. Le chemin type : post → message WhatsApp → commande.
- **Le CTA par défaut** : "Écrivez-nous sur WhatsApp au +XXX…" avec un lien `wa.me/<numéro international sans +>?text=<message pré-rempli>`. Un message pré-rempli différent par campagne permet de savoir quel post a généré le contact.
- **WhatsApp Business** : profil complet (description, horaires, adresse), catalogue produits, réponses rapides, statuts quotidiens (coulisses, nouveautés, preuves), listes de diffusion pour les clients qui ont accepté de recevoir des messages. Respecte le consentement : pas de messages non sollicités en masse.
- **TikTok** et **Instagram** servent à attirer ; **LinkedIn** à toucher les entreprises, institutions, recruteurs et partenaires.
- Pour les contenus qui doivent marcher hors ligne ou sur réseau faible : le visuel doit se comprendre sans le texte et sans le son.

## 2. Contenu léger et accessible

- **Poids** : compresse les images et les vidéos ; les données mobiles coûtent cher et les connexions sont inégales. Une image de 200 Ko bien cadrée vaut mieux qu'une image de 5 Mo.
- **Vidéos courtes** (15 à 40 s) avec **sous-titres incrustés** : beaucoup regardent sans le son, et la lecture est facilitée quand l'accent ou la langue de la voix diffère de celle de l'audience.
- **Photos réelles** : produits, équipe, lieux locaux, clients (avec accord). Les images génériques "occidentales" réduisent la confiance.
- **Texte lisible** sur écran d'entrée de gamme : gros caractères, fort contraste.
- **Informations pratiques visibles** : prix en monnaie locale, quartier ou ville, livraison, horaires.

## 3. Paiements et confiance

- Indique les moyens de paiement réellement acceptés : selon le pays, Orange Money, MTN MoMo, Moov Money, Wave, M-Pesa, Airtel Money, carte, paiement à la livraison. Ne cite que ceux que la fiche marque confirme.
- Les arnaques et usurpations de pages sont fréquentes : renforce la confiance (compte vérifié si possible, numéro officiel affiché, mention "nous ne demandons jamais d'argent en message privé avant X" si c'est vrai, adresse physique, avis réels).
- Ne publie jamais un numéro de paiement personnel dans un commentaire public ; passe en privé et utilise les canaux officiels de la marque.
- Prix : toujours en **monnaie locale** (FCFA, MAD, DZD, etc.), clairs, sans "prix sur demande" si ce n'est pas nécessaire ; mentionne livraison ou frais.

## 4. Langue et ton

- Français courant, simple, direct, par défaut. Le tutoiement ou le vouvoiement suit la fiche marque (le vouvoiement protège souvent la crédibilité des services, le tutoiement convient aux marques jeunes).
- **Langues locales et registres populaires** (nouchi, camfranglais, pidgin, wolof, lingala, bambara, dioula, arabe dialectal, etc.) : n'en utilise que si la fiche marque l'indique, **et signale que le texte doit être relu par un locuteur natif**. Un registre mal employé sonne faux ou blesse. Si le doute subsiste, reste en français standard avec une expression locale ponctuelle validée.
- Évite les références culturelles étrangères (jeux de mots, fêtes, météo) qui n'ont pas de sens localement.
- Respect des sensibilités religieuses, ethniques, politiques : relis avec soin tout contenu d'actualité, de fête religieuse ou de société.

## 5. Fuseaux horaires et créneaux

Pas d'heure d'été dans la quasi-totalité de ces pays. Repères (à confirmer par pays) :

| Fuseau | Décalage UTC | Exemples |
|---|---|---|
| GMT | +0 | Sénégal, Côte d'Ivoire, Mali, Burkina Faso, Guinée, Togo, Ghana |
| WAT | +1 | Cameroun, Gabon, Bénin, Niger, Congo-Brazzaville, RDC (Kinshasa, ouest), Tchad |
| CAT | +2 | RDC (est : Lubumbashi), Rwanda, Burundi |
| EAT | +3 | Madagascar, Comores, Djibouti |
| Maghreb | +0 à +1 (variable) | Maroc, Algérie, Tunisie : vérifie la règle de l'année |

Dans le pack JSON, utilise le nom de fuseau dans `timezone` (ex. `Africa/Douala`) et des dates ISO avec décalage (`2026-11-02T18:00:00+01:00`).

Créneaux : hypothèses de départ à tester : tôt le matin avant le travail, pause de midi, début de soirée (18 h à 21 h). Les jours de marché, de prière, de grande rencontre sportive ou d'événements nationaux modifient les habitudes.

## 6. Calendrier des temps forts

À vérifier chaque année (les dates religieuses varient avec le calendrier lunaire ; les fêtes civiles changent d'un pays à l'autre) :

- Nouvel An, Journée internationale des droits des femmes (8 mars), Fête du travail (1er mai), Journée de l'Afrique (25 mai)
- Ramadan, Aïd el-Fitr, Tabaski (Aïd al-Adha), Pâques, Noël
- Fête des mères (la date diffère selon les pays), fête des pères
- Rentrée scolaire et universitaire (septembre à octobre selon les pays)
- Fête nationale du pays concerné
- Périodes commerciales : soldes, fin d'année, saison des mariages et des funérailles, pics de recharge salariale en fin de mois

Prépare les contenus de fête à l'avance, avec un message juste et sobre. Évite l'opportunisme commercial lors de deuils nationaux ou tragédies.

## 7. Pièges à éviter

- Promesses de revenus faciles ("gagnez 500 000 FCFA en 7 jours"), produits financiers ou de santé présentés comme miraculeux. Elles enfreignent les règles des plateformes et abîment la confiance (`safety-compliance.md`).
- Visuels avec trop de texte ou trop lourds.
- Numéros ou liens erronés, ou format de numéro WhatsApp incorrect (indicatif du pays obligatoire, sans espaces ni `+` dans le lien `wa.me`).
- Réponses tardives aux demandes de prix : sur Facebook et WhatsApp, le délai de réponse conditionne la vente.
- Contenu tiré du web sans droits, y compris des photos de produits copiées chez un concurrent.
