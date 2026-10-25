# Direction

Design system Muse v3 fourni par le client, adapté à Braand. Surface de travail sobre et française ; une seule police Manrope conservée, aucune fonte propriétaire importée.

Palette sémantique dans `app/design-tokens.css` : fond #181819, fenêtre #28292b, surface élevée #323435, couches blanches translucides, texte blanc, action #1793ff avec texte noir, focus bleu. Les petits textes secondaires sont éclaircis pour maintenir leur contraste.

Navigation déployée 240 px, rail réduit 72 px ; conversation centrée sur 768 px, panneau de travail redimensionnable (360 px au départ). Le mobile présente une zone à la fois et conserve une navigation accessible en tiroir.

Bulles agent #1f1f20 et utilisateur #0074e8, texte 16/22. Compositeur compact de 58 px au repos sur ordinateur : texte et actions sur une rangée. Dès que le texte dépasse une ligne, il occupe toute la largeur et les actions passent en dessous. Sur mobile, les actions restent sous le texte avec des cibles de 44 px. Hauteur automatique jusqu’à 192 px pour le texte puis défilement interne ; sa largeur reste fixe.

Le clover de Bot Avatars accompagne l’assistant : 64 px sur l’accueil et 32 px à côté des réponses. Sur l’accueil, les yeux et la tête suivent la souris à proximité avec un amorti progressif, puis retrouvent doucement leur pose au repos quand elle s’éloigne. Seule la réponse en cours utilise l’état « working » ; les avatars des anciens messages restent immobiles. Le composant se charge à la demande et respecte la réduction du mouvement. Le logo Braand de navigation conserve sa forme.

Paramètres dans une fenêtre native 880 × 680, navigation latérale 224 px défilante, contenu indépendant défilant. Dix rubriques regroupent compte, connecteurs, compétences, portefeuille, facturation, équipe, stockage, autorisations, aide et informations légales. La barre principale réserve sa place aux activités ; la facturation et les compétences ne remplacent plus la conversation par une page distincte. Coins 32 px, ou squircle avec repli standard. Les cartes ont un rayon de 16 px ; les petits contrôles sont arrondis.

Les forfaits de facturation se comparent dans un carrousel horizontal : deux cartes lisibles avec une amorce de la troisième, une seule carte sur les petits conteneurs. Flèches de navigation, défilement tactile et au trackpad, clavier et focus visible ; aucun défilement automatique. La navigation devient immédiate avec la réduction du mouvement.

Le Tableau de bord conserve son nom. En-tête compact, compte actif contrôlé, périodes de 7, 30 ou 90 journées terminées dans le fuseau du compte. Six métriques calculées sur les totaux, courbe quotidienne avec comparaison précédente, barres par campagne et tableau triable avec recherche et export CSV. Les observations sont déterministes et les actions Braand préparent une demande dans le chat. Séries absentes, rapports partiels et conversions non mesurées restent explicites. Graphiques accessibles au clavier, axes lisibles sur mobile et chargement à la demande ; aucune animation ni dépense automatique.

Campagnes devient un atelier de préparation : plans filtrables, prochaine information manquante, brief modifiable et versionné, créations et page explicitement associées, export du brief et projection arithmétique du budget sur 7, 14 ou 30 jours. Neuf contrôles distinguent les informations renseignées des vérifications de destination et de mesure encore nécessaires. Les demandes Braand restent des brouillons dans le chat. Aucun lancement publicitaire, réservation de budget ou contrôle technique réussi n’est simulé. Enregistrement protégé contre les conflits de version, consultation seule selon le rôle et mise en page adaptée au mobile.

Transitions utiles de 150 ms, réduction du mouvement, clavier et focus visible ; erreurs techniques distinctes de l’assistant. La fermeture manuelle du panneau, les budgets, les autorisations et tous les flux métier sont conservés. Les extraits de documents dans les lecteurs gardent leur propre mise en forme.


Le rendu des réponses utilise des blocs Markdown mémorisés, échappés et stables : titres, listes, code avec retour à la ligne et liens HTTP(S) contrôlés. Le flux peut récupérer les événements persistants manquants d'une réponse active sans relancer sa génération. Arrêt immédiat côté client, conservation du texte partiel et ressources dédupliquées ; aucun changement de dimensions du compositeur ni nouvelle animation.
L’attente initiale du chat reste discrète : le clover travaille et le bouton d’arrêt reste accessible, sans bandeau de préparation, de connexion au modèle ni compteur sous le compositeur. Une annonce réservée aux lecteurs d’écran conserve le retour accessible. Les étapes utiles et les erreurs restent liées aux événements réels.
Les informations légales sont une rubrique des paramètres. Les trois documents s’ouvrent dans un nouvel onglet, avec une indication explicite, tandis que la fenêtre des paramètres et le brouillon restent en place.
