# Phase 4 — Aperçus Office en lecture seule

## Résumé

- DOCX, XLSX et PPTX sont reconnus depuis la structure ZIP/OOXML et peuvent être ouverts dans le dialogue universel Braand.
- Les lecteurs sont chargés à la demande ; le traitement OOXML s’exécute dans un Web Worker dédié, sans bibliothèque ou dépendance ajoutée.
- Les formules ne sont jamais calculées, les macros et notes PowerPoint ne sont jamais exécutées ou chargées, et les textes sont rendus comme texte React échappé.
- Le build, TypeScript, 61 tests unitaires et 71 contrôles HTTP locaux passent ; le lint ciblé passe.
- Cette livraison est sur `file-preview/phase-4`. Aucune PR n’a été créée : le dépôt n’a pas de remote configuré et les changements des phases précédentes sont encore non commités.

## Fichiers créés ou modifiés pour la phase

- `lib/file-policy.mjs` : MIME Office, limites centralisées de décompression, XML, rendu et délai.
- `lib/office-archive.mjs` : lecture bornée du répertoire ZIP, contrôle des chemins, compression, CRC et signatures OOXML.
- `lib/office-preview.mjs` : lecture XML locale et conversion DOCX/XLSX/PPTX vers des structures de données simples.
- `components/file-preview/file-preview-dialog.tsx`, `types.ts`, `file-card.tsx`, `file-preview.css` : prise en charge du dialogue universel, des cartes et des états Office.
- `components/file-preview/office-preview.worker.ts`, `use-office-preview.ts`, `office-reader-types.ts`, `office-reader-state.tsx` : worker, hook et états communs.
- `components/file-preview/docx-reader.tsx`, `xlsx-reader.tsx`, `pptx-reader.tsx` : lecteurs différés par format.
- `tests/office-preview.test.mjs`, `office-preview-fixtures.mjs`, `file-preview.integration.mjs`, `file-preview-bundle.test.mjs` : tests de parseur, d’API et de séparation des bundles.

## Fonctionnement et décisions

- La reconnaissance serveur vérifie les entrées attendues (`word/document.xml`, `xl/workbook.xml`, `ppt/presentation.xml`) et le manifeste OOXML ; le nom ou l’extension seuls ne suffisent pas.
- Les lecteurs Office, le code du parseur et le worker ne sont pas présents dans les chunks initiaux. Les imports dynamiques sont vérifiés par le test de bundle.
- Les archives sont limitées à 50 Mio d’entrée, 200 Mio de taille décompressée annoncée, un ratio maximal de 100:1 et 5 000 entrées ; les archives imbriquées et chemins traversants sont rejetés.
- Un élément XML est limité à 20 Mio, le parseur à 500 000 nœuds cumulés, le texte affiché à 1 000 000 caractères et le traitement à 30 secondes. Ces limites supplémentaires réduisent la charge avant et pendant le rendu.
- La décompression utilise `DecompressionStream("deflate-raw")` dans le Web Worker. MDN documente cette API comme disponible dans les Web Workers et largement prise en charge depuis 2023 : [documentation DecompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream).
- Le DOCX affiche les titres, paragraphes, listes simples et tableaux en lecture seule. Les images intégrées et la mise en forme fidèle ne sont pas prises en charge.
- Le XLSX affiche les onglets, signale les feuilles masquées, les valeurs calculées déjà enregistrées dans le fichier et virtualise les lignes affichées. Il ne calcule aucune formule.
- Le PPTX affiche le texte de 50 diapositives au maximum ; les notes du présentateur ne sont pas lues. Les images sont omises et signalées dans l’interface.
- Aucun extracteur IA Office, OCR ni migration n’a été ajouté dans cette phase. Les pièces jointes Office ne sont donc pas encore fournies au modèle ; cela relève de la phase 5.
- Aucun paquet externe n’a été ajouté. Aucun secret, chemin de stockage ou URL permanente n’est transmis au navigateur comme métadonnée de fichier.

## Résultats des vérifications

- `npm run build` : réussi.
- `npx tsc --noEmit` : réussi.
- `node --test tests/*.test.mjs` : 61 réussis, 0 échec.
- `node tests/run-file-upload-integration.mjs` : 71 vérifications locales réussies avec une base fictive temporaire nettoyée après le test. Le scénario vérifie l’envoi DOCX, le type servi, la lecture en ligne et le téléchargement en pièce jointe.
- `npx eslint` sur les fichiers de la phase : réussi sans erreur ni avertissement.
- Test de bundle : PDF et lecteurs Office différés ; worker Office séparé ; aucune référence à `fetch()` ou `eval()` dans le bundle du parseur.
- `npm run lint` complet : échoue sur 205 erreurs `no-explicit-any` préexistantes dans plusieurs modules et 5 963 avertissements, dont des fichiers générés dans `.tmp`. Le lint ciblé des fichiers de cette phase passe.
- Pas de test E2E navigateur ni d’audit axe/NVDA/VoiceOver disponible. Le navigateur de test n’a pas pu joindre le port isolé du serveur temporaire. Le test HTTP et le test de build ont été exécutés à la place ; l’aperçu visuel interactif reste à valider manuellement.

## Risques et points ouverts

- Le Web Worker est dédié au traitement mais demeure un worker navigateur de même origine ; il n’a pas d’isolement réseau imposé par le navigateur. Le code du worker n’effectue aucun appel réseau. Pour satisfaire strictement un worker sans accès réseau, mémoire plafonnée matériellement à 512 Mio et système de fichiers temporaire nettoyé, il faudra déplacer le parsing vers un service d’extraction isolé côté serveur.
- Un navigateur ne permet pas d’imposer une limite mémoire de processus. La taille de l’archive, des parties XML, du texte rendu, du nombre de nœuds et le temps sont bornés, mais la limite de 512 Mio n’est pas une garantie du navigateur.
- Les fichiers Office chiffrés au format OLE standard ne sont pas reconnus comme DOCX/XLSX/PPTX à l’envoi ; ils peuvent être refusés comme type non pris en charge. Un élément ZIP marqué chiffré reçoit un état « protégé », mais ce n’est pas le format de chiffrement OOXML courant.
- La mise en forme Office est simplifiée ; DOCX/PPTX omettent les images, et le lecteur ne préserve pas toutes les fonctions avancées, les graphiques ou les styles.
- Le flag `FILE_PREVIEW_V1` reste désactivé par défaut dans `.env.example`. Il faut l’activer uniquement dans l’environnement local de test pour permettre l’envoi de ces formats.
- Les changements des phases 1 à 3 restent mêlés à des modifications non commités dans le dépôt. Il n’y a aucun remote Git, donc pas de PR publiable dans cet environnement.

## Test manuel local

1. Dans le fichier local `.dev.vars`, ajouter `FILE_PREVIEW_V1=true` sans modifier ni afficher les autres secrets, puis redémarrer `npm run dev`.
2. Envoyer un DOCX standard non protégé depuis l’espace Fichiers, le composer ou le panneau droit ; vérifier que le même aperçu plein écran s’ouvre.
3. Vérifier un XLSX avec plusieurs onglets, une formule avec valeur enregistrée et une feuille masquée : l’onglet masqué est signalé et la valeur de formule n’est pas recalculée.
4. Vérifier un PPTX : texte des diapositives visible, notes et images absentes avec message explicatif.
5. Tester un fichier corrompu et vérifier l’état explicite et le bouton de téléchargement.
6. Tester Tab, Maj+Tab, ←/→ dans les onglets XLSX et Échap dans le dialogue.

Commande d’intégration locale : `node tests/run-file-upload-integration.mjs`.

## Description de PR prête à coller

**Titre :** `feat(files): add safe lazy Office previews`

**Description :**

Ajoute des aperçus Office en lecture seule au dialogue universel d’Braand. Les lecteurs DOCX, XLSX et PPTX sont chargés à la demande ; le parseur OOXML tourne dans un worker dédié, rejette les structures ZIP risquées et applique des limites de taille, de ratio, de contenu et de durée. Les formules ne sont pas calculées, les macros ne sont pas exécutées et le texte est rendu sans HTML brut.

Validation : build, typecheck, 61 tests unitaires, 71 contrôles HTTP locaux et vérification des chunks différés. Le lint global reste en échec sur des erreurs et avertissements existants hors de cette phase ; le lint ciblé passe. Le test E2E navigateur reste à faire.
