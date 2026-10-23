# Direction

Design system Muse v3 fourni par le client, adapté à Aïra. Surface de travail sobre et française ; une seule police Manrope conservée, aucune fonte propriétaire importée.

Palette sémantique dans `app/design-tokens.css` : fond #181819, fenêtre #28292b, surface élevée #323435, couches blanches translucides, texte blanc, action #1793ff avec texte noir, focus bleu. Les petits textes secondaires sont éclaircis pour maintenir leur contraste.

Navigation déployée 240 px, rail réduit 72 px ; conversation centrée sur 768 px, panneau de travail redimensionnable (360 px au départ). Le mobile présente une zone à la fois et conserve une navigation accessible en tiroir.

Bulles agent #1f1f20 et utilisateur #0074e8, texte 16/22. Compositeur compact de 58 px au repos sur ordinateur : texte et actions sur une rangée. Dès que le texte dépasse une ligne, il occupe toute la largeur et les actions passent en dessous. Sur mobile, les actions restent sous le texte avec des cibles de 44 px. Hauteur automatique jusqu’à 192 px pour le texte puis défilement interne ; sa largeur reste fixe.

Paramètres dans une fenêtre native 880 × 680, navigation latérale 224 px défilante, contenu indépendant défilant. Neuf rubriques regroupent compte, connecteurs, compétences, portefeuille, facturation, équipe, stockage, autorisations et aide. La barre principale réserve sa place aux activités ; la facturation et les compétences ne remplacent plus la conversation par une page distincte. Coins 32 px, ou squircle avec repli standard. Les cartes ont un rayon de 16 px ; les petits contrôles sont arrondis.

Transitions utiles de 150 ms, réduction du mouvement, clavier et focus visible ; erreurs techniques distinctes de l’assistant. La fermeture manuelle du panneau, les budgets, les autorisations et tous les flux métier sont conservés. Les extraits de documents dans les lecteurs gardent leur propre mise en forme.

Le cadrage dans le chat utilise une carte de 440 px maximum : une question active, contrôles natifs, compteur discret et actions en pied. Le dernier bouton prépare le brouillon ; les validations d’exécution restent explicites et distinctes. Les réponses libres, le focus clavier et la réduction du mouvement sont pris en charge.

