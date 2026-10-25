# Guide par réseau

Les chiffres exacts (limites de caractères, hashtags) sont dans `assets/platform_limits.json` et contrôlés par le validateur. Ce fichier donne l'usage : formats, ton, structure, contraintes de publication. Les plateformes changent souvent ; en cas de doute sur un point récent, vérifie sur le web avant de t'engager.

## Instagram

**Comptes et publication** : un compte Business ou Creator est nécessaire pour publier par API ; il est généralement relié à une Page Facebook. Les comptes personnels ne se publient pas par API.

**Formats** : image unique (portrait 4:5, 1080×1350, occupe le plus d'espace), carrousel (jusqu'à 20 images selon la plateforme, à vérifier), Reel (9:16, 1080×1920), Story (9:16, éphémère).

**Texte** : la légende est tronquée après ~125 caractères, donc le crochet va en première ligne. Les liens dans la légende ne sont pas cliquables : renvoie vers "lien en bio", un autocollant lien en Story, ou un numéro WhatsApp.

**Ce qui marche** : carrousels pédagogiques (chaque slide apporte une info), Reels courts avec accroche dans les deux premières secondes, preuves visuelles (avant/après honnêtes, coulisses), appel à enregistrer ou partager plutôt qu'au simple "like". Les mots-clés dans la légende et dans le texte à l'écran aident la recherche interne.

**Hashtags** : 3 à 5 ciblés. Mélange un hashtag de niche, un de localité, un de marque. Instagram a annoncé un plafond à 5 (déploiement progressif, déc. 2025) ; l'ancienne limite était 30.

**Pièges** : texte trop petit sur l'image, logo qui masque le visage dans une zone d'interface, vidéo recadrée car mauvais ratio, musique sans droits sur compte professionnel.

## Facebook

**Comptes et publication** : seules les **Pages** se publient par API, pas les profils personnels. Les Groupes ont leurs propres règles.

**Formats** : texte seul, image (portrait 1080×1350 ou carré), lien (aperçu 1200×630), vidéo et Reel, Story, sondage.

**Texte** : ton plus conversationnel, plus long toléré que sur Instagram, mais garde le message essentiel dans les premières lignes. Les liens sont cliquables.

**Ce qui marche** : annonces locales et pratiques (horaires, adresse, prix, disponibilité), vidéos courtes sous-titrées, questions simples qui invitent à répondre, événements, preuves sociales (photos clients avec leur accord). Très efficace pour les commerces locaux et les audiences qui n'utilisent pas LinkedIn.

**Pièges** : posts uniquement promotionnels, visuels lourds qui chargent mal sur données mobiles limitées, publication du même texte que sur Instagram avec des hashtags en rafale.

## LinkedIn

**Comptes et publication** : selon les permissions accordées, publication sur un profil ou sur une Page entreprise. Vérifie laquelle l'utilisateur veut.

**Formats** : texte, image, carrousel (document PDF, 1080×1350 ou 1080×1080 lisible sur mobile), vidéo, sondage, article.

**Texte** : la zone visible avant "voir plus" est courte (environ 140 caractères sur mobile, 210 sur ordinateur) ; le crochet y tient en une ou deux phrases. Ton professionnel mais humain, à la première personne, avec un point de vue assumé.

**Structure efficace** : crochet, contexte en 2 ou 3 lignes, enseignement en 3 à 5 points courts, question ouverte finale. Paragraphes d'une ou deux lignes.

**Ce qui marche** : retours d'expérience, chiffres vérifiés, erreurs et leçons, études de cas, coulisses du métier. Hashtags : 3 maximum, discrets. Les liens externes dans le corps du post sont souvent associés à une portée réduite : teste en les plaçant en premier commentaire, sans en faire un dogme.

**Pièges** : jargon creux, vantardise sans preuve, "pods" d'engagement (contraires aux règles), emojis en excès dans un contexte B2B sobre.

## TikTok

**Comptes et publication** : l'accès API dépend de l'approbation de l'application. Selon le niveau, les publications faites par API peuvent être limitées (par exemple privées) : vérifie avant de promettre une publication automatique. Sinon livre le pack et indique la planification depuis TikTok Studio.

**Formats** : vidéo verticale 9:16 (1080×1920), diaporama photo.

**Texte** : légende courte (la zone visible est d'environ 80 à 100 caractères) ; l'essentiel est dans la vidéo. Hashtags : 3 à 5, dont un de niche.

**Structure d'une vidéo** : accroche en 0 à 2 secondes (image forte + texte à l'écran), valeur en rythme rapide, preuve, appel à l'action clair. Sous-titres incrustés indispensables. Une idée par vidéo.

**Ce qui marche** : tutoriels rapides, coulisses, réponses à des commentaires en vidéo, tendances adaptées à la marque (pas toutes), authenticité plutôt que production léchée.

**Musique** : les comptes professionnels sont généralement limités à la bibliothèque musicale commerciale ; ne propose pas un son populaire sans vérifier les droits.

**Pièges** : reprendre une tendance qui n'a aucun lien avec la marque, vidéo recyclée avec le logo d'un autre réseau (filigrane), accroche trop lente.

## Autres réseaux (usage occasionnel)

Le fichier de limites inclut aussi X (280 caractères) et Threads (500). Ces entrées sont marquées non vérifiées : vérifie avant usage intensif. WhatsApp Business (statuts, catalogue, liste de diffusion) est détaillé dans `references/africa-francophone.md` car il joue souvent le rôle de canal de conversion.

## Adapter un même message à quatre réseaux

Exemple de départ : "Nouvelle recette de pain au manioc, disponible samedi."

| Réseau | Angle | Forme |
|---|---|---|
| Instagram | visuel appétissant, crochet sensoriel | photo portrait, 3 lignes, CTA "écris-nous sur WhatsApp" |
| Facebook | information pratique | prix, horaire, adresse, question pour engager |
| LinkedIn | histoire d'entreprise | pourquoi cette recette, ce qu'on a appris, un chiffre vrai |
| TikTok | processus | vidéo de 20 s de pétrissage, texte "Samedi, il sort du four" |

Le fait central est identique ; ce qui change, c'est l'angle, la longueur, le format et l'action demandée.
