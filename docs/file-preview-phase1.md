# Braand — fondations des fichiers (Phase 1)

Cette phase ajoute les métadonnées durables des fichiers, les références de pièces jointes dans les messages, le contrôle des accès par espace, les signatures HMAC temporaires et la suppression douce. Le drapeau `FILE_PREVIEW_V1` reste désactivé par défaut.

## Configuration

- `FILE_PREVIEW_V1=false` garde les nouvelles routes d’accès signé fermées.
- `FILE_URL_SIGNING_SECRET` doit être un secret aléatoire d’au moins 32 caractères. À défaut, le serveur utilise `TOKEN_ENCRYPTION_KEY` pour les environnements locaux existants.
- Ne placez aucun de ces secrets dans le navigateur ou dans une variable `NEXT_PUBLIC_*`.

## Contrat d’accès signé

`POST /api/files/:id/url` reçoit `{ "scope": "content" | "download" | "thumbnail" }` et renvoie une URL valable cinq minutes. Chaque lecture vérifie à nouveau l’identité, l’espace actif, la portée, la signature et l’état du fichier. Les erreurs de fichier absent et d’accès à un autre espace utilisent le même statut et le même code.

Les contenus sont servis avec le type détecté, `nosniff`, une CSP restrictive, une politique de cache privée et une disposition en pièce jointe pour les types non autorisés en ligne. Les requêtes `Range` audio/vidéo sont bornées ; une plage invalide renvoie `416`.

## Migration et conservation

La migration `0005_file_foundation.sql` ajoute les tables `files`, `file_upload_audit`, `file_upload_limits` et la colonne `messages.attachments`. Elle copie les ressources fichier existantes sans les supprimer. Le retrait du nouveau code peut se faire sans revenir la base en arrière ; les tables ajoutées restent inertes.

La suppression utilisateur marque le fichier comme supprimé et masque son contenu. Le planificateur de facturation existant purge les clés de stockage, les vignettes/extraits futurs et les instantanés liés après 30 jours, tout en gardant une ligne tombstone afin que l’historique puisse afficher « Fichier supprimé ».

## Limites avant activation du parcours d’aperçu

- L’envoi direct reste limité temporairement à 5 Mio ; le plafond configuré de 50 Mio nécessite le transfert reprenable de la Phase 3.
- Les formats d’envoi actuels restent PNG, JPEG, WebP et texte. Les PDF, archives Office, audio et vidéo ne sont pas encore activés dans l’interface.
- Les signatures et dimensions d’image sont contrôlées, mais l’environnement Worker actuel n’a pas de décodeur/réencodeur d’image isolé. Les métadonnées EXIF/GPS ne sont donc pas encore supprimées. Ne déployez pas l’aperçu image ou l’analyse IA de fichiers avant cette étape de sécurité.
- L’aperçu universel, la reprise en blocs, les vignettes et l’extraction IA appartiennent aux phases suivantes.

## Tests locaux

Sans aucun secret fournisseur, lancez les tests unitaires et la migration avec `node --test tests/file-policy.test.mjs tests/file-migration.test.mjs`. Pour les routes HTTP, lancez le serveur local avec un fichier de configuration vide, une base temporaire, `FILE_PREVIEW_V1=true` et une clé de signature de test, puis exécutez `tests/file-preview.integration.mjs` et `tests/http.integration.mjs` avec `BRAAND_TEST_URL` fixé sur localhost.
