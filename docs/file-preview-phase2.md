# Braand — rapport de la Phase 2 : aperçu universel

## Résumé

Un dialogue plein écran commun ouvre les fichiers depuis le panneau de fichiers et le compositeur, conserve l’écran de chat monté et synchronise son état dans `?apercu=`. Les images, documents texte, PDF, audio et vidéo utilisent des lecteurs adaptés ; les formats non pris en charge restent téléchargeables. Les pièces jointes et leur ajout à la conversation utilisent la même `FileCard`. Le lecteur PDF et son worker restent dans des ressources séparées, chargées seulement pour un PDF.

## Fichiers créés ou modifiés

- `components/file-preview/` : types partagés, fournisseur racine, `FileCard`, dialogue d’aperçu, lecteur PDF dynamique et styles adaptatifs.
- `app/layout.tsx` : montage unique du fournisseur de prévisualisation.
- `app/studio.tsx` : cartes communes dans le compositeur, les messages, les fichiers et le panneau latéral ; action « Ajouter à la conversation ».
- `app/api/files/[id]/[action]/route.ts` : lecture des métadonnées de fichier avec réponse privée non mise en cache.
- `app/api/files/route.ts` et `lib/file-policy.mjs` : formats d’envoi additionnels derrière `FILE_PREVIEW_V1`, et plafond de dix pièces jointes cohérent avec la politique centrale.
- `scripts/dev-local.mjs` : fournisseur racine, worker PDF local, chunks dynamiques et lecture correcte des variables de configuration contenant des chiffres.
- `package.json` / `package-lock.json` : ajout exact de `pdfjs-dist@6.4.299` et commande du test de bundle.
- `tests/file-preview.integration.mjs`, `tests/file-preview-bundle.test.mjs`, `tests/file-policy.test.mjs` : contrat de métadonnées, sécurité d’accès et garde contre l’inclusion de PDF.js dans les chunks initiaux.
- `.github/workflows/ci.yml` : vérification globale sur chaque pull request et push, incluant le build et la garde de bundle.

## Décisions et écarts

- L’aperçu reste conditionné par `FILE_PREVIEW_V1` ; il est désactivé par défaut. Le test local a utilisé une configuration temporaire et une clé de signature fictive, sans fournisseur externe.
- Les contrôles PDF utilisent PDF.js depuis le paquet officiel `pdfjs-dist`, sous licence Apache-2.0 et sans dépendance d’exécution déclarée. Version choisie : `6.4.299`. Références : [versions PDF.js](https://github.com/mozilla/pdf.js/releases), [paquet npm](https://www.npmjs.com/package/pdfjs-dist?activeTab=code), [licence](https://github.com/mozilla/pdf.js/blob/master/LICENSE).
- La carte commune affiche une icône de format ; elle n’affiche pas encore de vignettes générées côté serveur. La Phase 1 ne les produit pas.
- L’aperçu texte affiche le contenu complet comme texte échappé. L’aperçu CSV virtualisé et les lecteurs DOCX, XLSX et PPTX ne sont pas inclus.
- Le stockage de contenu reste sur l’origine de l’application. Les URL signées de courte durée sont utilisées avec les cookies de même origine, car les routes de contenu revérifient l’identité de session.
- La fonction d’ajout depuis le panneau vers le compositeur est implémentée. Le glisser-déposer global, le collage d’image et l’envoi reprenable appartiennent encore à la Phase 3.

## Vérifications

- `npx tsc --noEmit` : réussi.
- Lint ciblé des modules d’aperçu, des routes et des tests : réussi.
- `node --test tests/*.test.mjs` : **47 tests réussis**.
- `tests/file-preview.integration.mjs` sur le serveur local et une base isolée : **18 vérifications réussies**, dont métadonnées sans champs internes, cache privé, signature et accès inter-espace.
- Build de production `npm run build` : réussi. Vinext signale encore des routes dont la classification dynamique reste inconnue ; le build se termine.
- `npm run test:file-preview-bundle` : réussi après build. Le test confirme que les signatures d’exécution PDF.js n’apparaissent que dans le chunk `pdf-reader`, et que le worker est un actif séparé.
- Parcours navigateur local vérifié manuellement : ouverture d’un fichier texte et d’un PDF d’une page, extraction de texte PDF sélectionnable, fermeture par Échap, mise à jour de l’URL, ouverture depuis la liste de fichiers, ajout au compositeur et conservation du brouillon. Aucune erreur console observée.
- Le lint complet du dépôt reste en échec : 151 erreurs et 15 avertissements, principalement des `any` explicites dans les autres modules et `app/studio.tsx`. Les nouveaux composants d’aperçu passent leur lint ciblé.
- Axe, NVDA/VoiceOver, matrice mobile et audit npm en ligne n’ont pas été exécutés. La consultation npm de vulnérabilités avait échoué faute de résolution réseau vers le registre ; l’absence d’avis de vulnérabilité n’est donc pas confirmée.

## Risques ouverts avant activation réelle

- La Phase 1 ne réencode pas les images et ne supprime pas EXIF/GPS ; les vignettes serveur et le domaine de contenu séparé manquent aussi. Ne pas activer les aperçus image en production avant correction de ces points.
- L’envoi direct reste limité à 5 Mio malgré la limite théorique configurée de 50 Mio. L’envoi en blocs reprenable de la Phase 3 reste nécessaire.
- Les fichiers Office, SVG, GIF et AVIF ne sont pas disponibles dans les lecteurs d’aperçu de cette phase. Les documents non gérés doivent rester en téléchargement.
- La lecture intégrale des PDF est chargée dans le navigateur ; les limites d’extraction IA et de taille de contexte restent à la Phase 5.
- La CI a maintenant un workflow dédié, mais son exécution sur le fournisseur Git distant n’a pas pu être confirmée : le dépôt local ne déclare aucun remote.

## Étapes de test manuel

1. Dans un environnement local isolé, définir `FILE_PREVIEW_V1=true` et une clé de signature de test d’au moins 32 caractères ; ne pas réutiliser de clé de production.
2. Ouvrir Braand, importer un PNG, un TXT et un PDF, puis ouvrir chaque fichier depuis le panneau latéral et le compositeur.
3. Vérifier le zoom image/PDF, la sélection de texte et le changement de page PDF, le téléchargement, Échap et le bouton Retour.
4. Ajouter un fichier de la liste au compositeur ; saisir un brouillon, ouvrir puis fermer l’aperçu et confirmer que le brouillon est conservé.
5. Après `npm run build`, exécuter `npm run test:file-preview-bundle`.

## Description de PR prête à coller

**Titre :** `feat(files): add a shared full-screen file preview`

**Description :** Ajoute un aperçu plein écran partagé pour les fichiers du studio, des messages et du panneau latéral. L’état suit `?apercu=`, le brouillon du chat reste en place, et les lecteurs texte, média natif et PDF chargent leurs contenus avec les URL signées existantes. PDF.js est chargé dans un chunk séparé et une vérification de bundle empêche son inclusion dans les chunks initiaux. Le parcours reste protégé par `FILE_PREVIEW_V1`. Le build, les 47 tests unitaires, les 18 contrôles d’intégration et le parcours local ont été exécutés. Les vignettes, l’assainissement image et les gros envois restent à compléter avant activation en production.

**Publication :** branche locale `file-preview/phase-2`. Aucun PR n’a été créé : le dépôt n’a pas de remote configuré et contient des modifications antérieures non liées qui doivent être conservées.
