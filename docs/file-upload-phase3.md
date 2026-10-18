# Aïra — rapport de la Phase 3 : envoi reprenable

## Résumé

Le compositeur peut envoyer des fichiers jusqu’à 50 Mio en blocs R2 multipart, reprendre un transfert incomplet après rechargement en re-sélectionnant le fichier d’origine, et annuler ou réessayer les blocs. Le serveur vérifie la taille réellement reçue, les empreintes SHA-256 de chaque bloc et du fichier entier, le type détecté par signature et l’appartenance à l’espace de travail. Le parcours est derrière `FILE_PREVIEW_V1` et reste local tant que le drapeau n’est pas activé dans la configuration de test.

## Fichiers créés ou modifiés

- `drizzle/0006_file_upload_sessions.sql`, `drizzle/0007_file_upload_byte_limits.sql` : sessions multipart et limitation de débit basée sur le nombre de requêtes et les octets.
- `db/schema.ts` : tables de session, de blocs et de quotas.
- `lib/file-policy.mjs`, `lib/file-upload.mjs` : paramètres centralisés, calcul des blocs, empreintes, durée de session et DTO public sans identifiants de stockage.
- `app/api/files/uploads/route.ts` : création, statut, liste, réception de bloc, finalisation et annulation ; contrôles d’identité et de tenant à chaque requête.
- `lib/file-retention.ts`, `app/api/internal/billing-tick/route.ts` : purge des envois incomplets expirés et nettoyage des fichiers supprimés après rétention.
- `app/api/files/route.ts` : limitation de débit en octets des envois directs historiques.
- `app/studio.tsx`, `app/file-upload.css` : progression, reprise, annulation, sélection, glisser-déposer global, collage d’image PNG/JPEG/WebP, ajout au compositeur.
- `scripts/dev-local.mjs` : simulation locale du multipart R2 pour tester l’API sans service externe.
- `tests/file-upload.test.mjs`, `tests/file-preview.integration.mjs`, `tests/file-migration.test.mjs`, `tests/run-file-upload-integration.mjs` : tests unitaires, de migration et HTTP avec base et stockage temporaires.
- `package.json` : commandes de vérification du transfert et du bundle.

## Décisions et écarts

- Taille maximale : 50 Mio ; blocs de 8 Mio ; jusqu’à trois fichiers en parallèle et trois blocs simultanés par fichier ; expiration d’une session incomplète après 24 h. Les valeurs de transfert sont centralisées dans `lib/file-policy.mjs`.
- Le navigateur conserve le brouillon et ne relance pas le message. Après fermeture/rechargement, il faut re-sélectionner le fichier d’origine pour recalculer son empreinte et reprendre les blocs manquants.
- Le collage accepte PNG, JPEG et WebP. Les autres formats d’image collés sont refusés avec une explication ; l’utilisateur peut les joindre via le sélecteur si le format est pris en charge.
- La limite d’espace de stockage complet n’existe pas encore dans le schéma de facturation. Cette phase limite les octets des sessions en attente à 150 Mio par espace, sans prétendre appliquer le quota persistant prévu au plan.
- Le serveur de développement local limite chaque corps HTTP à 24 Mio. Les requêtes de transfert sont plafonnées à un bloc de 8 Mio, donc cette limite n’empêche pas en principe un fichier complet de 50 Mio en multipart. Le test HTTP a toutefois couvert un fichier de plus de 8 Mio, pas encore la taille maximale exacte ; vérifier également les délais et limites par requête du runtime, du proxy/CDN et de R2.
- Le serveur assemble le contenu final en mémoire afin de contrôler sa signature et son SHA-256. La limite de 50 Mio borne ce coût, mais le traitement n’est pas encore isolé dans un worker dédié.
- Pas de vignettes serveur, d’extraction asynchrone, de vitesse estimée, d’OCR ou d’aperçu Office dans cette phase. Les formats actuellement reconnus et autorisés par la politique demeurent ceux de la liste existante.
- Les migrations sont additives. Aucun historique de paiement ou de fichier n’est supprimé par ces migrations. Le journal Drizzle contient aussi des entrées de phases précédentes de l’arbre de travail ; appliquer les migrations SQL numérotées comme pour l’environnement local existant et vérifier le journal de production avant déploiement.
- Le dépôt n’a pas de remote Git configuré et l’arbre partagé contient des changements d’autres phases. Aucune PR ni commit isolé n’a été créé afin de ne pas incorporer des changements non liés.

## Vérifications

- `npm run build` : réussi après les changements finaux. Vinext affiche son avis habituel sur la classification statique de quelques routes API ; la compilation se termine.
- `npx tsc --noEmit` : réussi.
- `node --test tests/*.test.mjs` : **51 tests réussis**.
- `npm run test:file-upload-integration` : **65 vérifications HTTP locales réussies** avec SQLite et stockage fictifs isolés. Le scénario couvre un fichier de plus de 8 Mio, reprise d’un bloc déjà reçu, empreintes erronées, taille invalide, bloc manquant, finalisation, accès inter-espace, annulation et purge d’une session expirée.
- `npm run test:file-preview-bundle` : réussi ; le lecteur PDF reste hors du bundle initial.
- ESLint ciblé sur les routes d’envoi, la politique, les helpers, les tests et le serveur local : réussi.
- `npm run lint` : **échoue** sur des erreurs `no-explicit-any` et des règles React dans `app/studio.tsx`, `app/api/internal/billing-tick/route.ts` et d’autres modules existants. Le périmètre ciblé hors de ces deux fichiers passe ; les erreurs héritées n’ont pas été masquées ni désactivées.
- Test du navigateur réel, audit Axe/NVDA/VoiceOver, vérification du proxy/CDN de production et transfert exact de 50 Mio : non exécutés. Aucune clé ni aucun fournisseur externe n’a été utilisé.

## Risques ouverts

- Avant activation en production, vérifier que runtime, proxy/CDN et bucket R2 acceptent les blocs de 8 Mio ainsi que le nombre de requêtes et la durée d’un transfert complet de 50 Mio.
- Les tâches planifiées doivent appeler `/api/internal/billing-tick` avec le secret de test puis de production configuré séparément ; sans planificateur fiable, les sessions expirées ne sont purgées qu’au prochain appel planifié.
- Le quota persistant de stockage, les vignettes de cartes et un traitement isolé sans accès réseau restent à réaliser.
- `app/studio.tsx` conserve des problèmes de lint de plusieurs zones préexistantes ; il faut les traiter dans une tâche dédiée plutôt que d’assouplir les règles.

## Étapes de test manuel

1. Démarrer le serveur local avec `FILE_PREVIEW_V1=true` et une clé `FILE_URL_SIGNING_SECRET` réservée aux tests.
2. Joindre un fichier texte de plus de 8 Mio et vérifier les deux blocs, la progression et l’état « prêt ».
3. Couper le réseau après le premier bloc, recharger la page, remettre le réseau et choisir « Reprendre » puis le fichier d’origine.
4. Annuler un transfert en cours et vérifier que la session disparaît de la liste ; vérifier l’erreur lorsque le fichier re-sélectionné ne correspond pas à son empreinte.
5. Coller une image PNG/JPEG/WebP dans le champ de discussion ; vérifier son aperçu puis l’envoi.
6. Répéter le test avec un autre espace de travail : un identifiant de session d’un espace ne doit pas permettre de consulter ou modifier l’envoi d’un autre.

## Description de PR prête à coller

**Titre :** `feat(files): add resumable multipart uploads`

**Description :** Ajoute l’envoi de fichiers reprenable jusqu’à 50 Mio avec blocs R2 multipart, empreinte SHA-256 par bloc et complète, validation du type réel, quotas de transfert temporaires, progression, annulation, reprise après rechargement, glisser-déposer et collage d’image dans le compositeur. Les sessions expirées sont purgées par la tâche planifiée existante. Le parcours reste protégé par `FILE_PREVIEW_V1`. Build, types, 51 tests unitaires, 65 vérifications HTTP locales, lint ciblé et contrôle du bundle PDF ont été exécutés. Le lint complet échoue sur les règles existantes du studio et d’autres modules ; les limites de proxy/R2 et un transfert réel de 50 Mio restent à valider dans l’environnement cible.
