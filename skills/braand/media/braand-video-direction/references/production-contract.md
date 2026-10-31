# Contrat d'une vidéo livrable

Utiliser pour passer d'un brief à une production complète, une révision ciblée
ou plusieurs formats. Le contrat décrit ce qu'il faut obtenir et vérifier ; il
n'installe aucun moteur ni outil de code ou d'encodage.

## Sources et timeline modifiables

Conserver dans un livrable versionné : objectif, message, textes exacts, scènes,
début et fin en secondes, mouvements, transitions, références d'assets possédés par
l'espace et rôle de chaque piste sonore. Pour les chiffres animés, garder la source,
les unités et les valeurs réelles ; ne pas remplir un graphique de données inventées.
Une timeline enregistrée est une source éditoriale modifiable, pas un projet Remotion,
une archive de montage ou une vidéo MP4 effectivement calculée.

Choisir le mode selon le besoin : générer un plan, assembler des rushs existants,
ou programmer une composition graphique. `media_catalog` décrit les générations
disponibles ; `capabilities` avec `area: "media"` expose montage et inspection.
Une génération par prompt n'assure pas une typographie exacte ni une animation
déterministe. Le runtime actuel n'exécute pas du JavaScript, SVG, Canvas ou Remotion
libre et n'exporte pas ces sources animées en MP4. Ne pas attribuer cette capacité
au montage limité de rushs ou à `create_page`.

## Montage et son

Pour `prepare_video_edit`, utiliser les fichiers réels, leurs versions et empreintes.
Les coupes, cadrages, fondus, mouvement simple d'image, presets colorimétriques,
volume et sous-titres dépendent du contrat retourné ; aucun filtre ou script brut
ne sert à ajouter des effets absents. Le service doit être déclaré prêt.

Définir voix, musique et silence selon le message et les droits disponibles.
`audio_speech` produit une voix seulement si un profil du catalogue le permet.
Ce profil n'ajoute ni clonage vocal, musique, mixage multipiste ou synchronisation
labiale. Un volume de clip ne constitue pas un moteur de mixage complet.

Pour les rushs, identifier les moments utiles dans les observations effectivement
accessibles ; ne pas prétendre avoir visionné ou transcrit toute une vidéo à partir
de son seul nom ou de quelques images. Ne pas inventer des timecodes observés.

## Retouches et déclinaisons

Relire la version actuelle, identifier la scène ou la phrase touchée et conserver
les autres décisions. Réviser la source éditoriale, puis préparer un nouveau devis
si un nouveau rendu est nécessaire. L'ancien fichier reste la sortie de sa version,
pas celle de la correction demandée. Une approbation périmée ne suit pas la révision.

Décliner vertical, carré et horizontal comme des sorties distinctes avec dimensions,
recadrage, placement des textes et coût propres, uniquement si les moteurs les
acceptent. Ne pas étirer le média pour prétendre à une adaptation. Réutiliser les
assets prêts et le budget restant ; ne pas régénérer toute la production sans raison.

## Vérifications et remise

Attendre le résultat réel de `get_video_edit_result` ou de la proposition média.
Séparer : fichier stocké, format/durée/dimensions décodés, images échantillonnées,
revue sémantique et écoute. Une planche-contact ne prouve pas la synchronisation
audio ; un MP4 décodable ne prouve pas le respect du brief. Vérifier les critères
possibles et exposer ceux qui demandent encore un contrôle humain ou un outil absent.

Donner les fichiers effectivement produits, les sources éditoriales conservées,
les formats prêts et les réserves. Une publication reste une opération distincte.
Si le compte fournisseur n'est pas financé, le moteur absent, la réponse incertaine
ou le plafond insuffisant, préserver le storyboard et les résultats disponibles.
Ne pas payer, recommencer une génération incertaine ou simuler un rendu réussi.
