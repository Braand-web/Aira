# Exploitation, alertes et exercice de restauration

## Mise à jour cloud — 24 octobre 2026

Le Worker `braand-staging` est maintenant déployé sur le compte du propriétaire,
sans URL publique. Le cron a exécuté les tâches `monitor` et `browser_cleanup`
aux passages de 04:40 et 04:45 UTC, avec état `completed` et une tentative dans
D1 distante. Cela prouve la planification et ces tâches sur une base sans clients,
pas un rapprochement de paiement ni une mission facturée.

Une fausse alerte sur `missions` a été reproduite : l'autonomie désactivée
retournait 503 au cron. Le Worker omet désormais cette tâche lorsque
`AUTONOMY_ENABLED` n'est pas `true`, tout en exécutant les autres tâches. Les
4 contrôles de `tests/worker-scheduler.integration.mjs` couvrent aussi les vraies
erreurs et le secret absent. Les alertes historiques sont conservées, sans purge.
Le passage distant de 05:00 UTC après déploiement du correctif termine les tâches
et ne crée aucune nouvelle alerte missions (dernière alerte historique : 04:55).

R2 renvoie encore 10042 ; aucun bucket ni exercice de restauration cloud.
Resend reste fermé sans clé API : destinataire de test configuré en secret,
aucun e-mail envoyé ou reçu. Les preuves locales ci-dessous restent valables,
sans être confondues avec ces vérifications distantes partielles.

## Ce qui a été exécuté

Le **20 octobre 2026**, `node tests/production-operations.integration.mjs` a exécuté **21 contrôles** avec les vrais services TypeScript, les vraies routes, SQLite en mémoire et Web Crypto AES-GCM. Ils passent : secret du planificateur, verrou concurrent, déduplication, erreur de tâche, outbox, refus d'envoi non configuré, demande de test, timeout incertain, garde de production, sauvegarde chiffrée v2 et compatibilité de restauration v1. La sauvegarde/restauration inclut réellement un fichier de **50 Mio**, **208 objets** (trois pages de métadonnées), les métadonnées HTTP et personnalisées, ainsi que le refus des corruptions, parties manquantes/interverties, limites SQL/médias, changements ETag, écritures interrompues et collisions de destination.

La restauration compare toutes les tables et données du snapshot, les objets et métadonnées, les séquences SQLite et l'intégrité des clés étrangères. Les déclencheurs financiers sont recréés **après** les lignes : restaurer un lot ne réattribue pas ses crédits et ne redébite pas une allocation. Aucun `DROP`/`DELETE` ne fait partie du code de restauration.

**Limite de preuve :** R2 est simulé en mémoire (lectures par plage et consommation incrémentale des flux avec contre-pression réelle Node). Le contrat `FixedLengthStream` de Cloudflare est reproduit par une fixture de taille contrôlée ; le runtime cloud reste à valider. Resend est remplacé par un stub HTTP. Aucun e-mail réel n'est parti, aucun e-mail n'est prouvé reçu, aucun bucket réel n'a été créé et aucune restauration Cloudflare distante n'est prouvée. Les comptes/domaine/destinataire n'étant pas configurés, les preuves externes restent **BLOQUÉES**.

## Routes et droits

- `GET /api/health` : état minimal `ok` ou `unavailable`, réponse non cachée ; ne renvoie ni environnement, ni nom de base, ni clé. Ce contrôle vérifie la disponibilité de la connexion D1, pas tous les fournisseurs.
- `POST /api/internal/operations-tick` : en-tête `Authorization: Bearer <SCHEDULER_SECRET>`. Secret serveur de **32 à 512 caractères** imposé par Braand ; comparaison de condensats SHA-256 de taille constante. Ces bornes sont des choix internes, pas des limites fournisseur.
- `GET /api/admin/operations` : réservé aux identifiants internes explicitement listés dans `OPS_ADMIN_IDS`. L'appartenance à une entreprise ne donne aucun droit d'exploitation global.
- `POST /api/admin/operations` : seule action `test-alert`, uniquement en `test` ou `staging`, origine identique exigée, corps borné, clé d'idempotence UUID. Cette route met en file ; elle n'envoie pas directement d'e-mail.

La migration additive `0010_operations.sql` crée les journaux des tâches, alertes, outbox et manifestes de sauvegarde. Exécuter la migration en staging puis vérifier la route ; ne jamais supprimer une migration ou des écritures financières pour revenir à une ancienne version.

## Planification et reprise

Le Worker Braand possède un `scheduled()` handler. La configuration Cloudflare Vite utilise `triggers.crons: ["*/5 * * * *"]` et le build génère ce déclencheur dans `dist/server/wrangler.json`. `tests/worker-config.test.mjs` vérifie le cron et les bindings D1/R2 générés. La syntaxe correspond au champ Wrangler `triggers.crons` décrit dans la [documentation Cloudflare](https://developers.cloudflare.com/workers/wrangler/configuration/). Le worker exécute en série `billing-tick`, `mission-tick`, puis `operations-tick`. Chaque route vérifie le même secret serveur d'au moins 32 caractères ; le helper compare les condensats à taille constante. Un échec de tâche crée une alerte sans journaliser le secret ni le corps d'erreur. Ces preuves sont locales : le Worker Braand n'a pas été déployé et aucun déclencheur Cron distant n'a été observé.

`runOperationsTick()` regroupe :

1. Inspection des incidents une fois par fenêtre interne de cinq minutes : événements de paiement morts, coûts fournisseurs inconnus depuis plus d'une heure, tâches interrompues, notifications échouées/incertaines.
2. Sauvegarde quotidienne UTC lorsque `BACKUP_ENABLED=true` et les prérequis sont vérifiés.
3. Traitement borné de l'outbox opérationnelle.

`runTrackedJob(name, id, work)` conserve un identifiant métier, un état, les tentatives, un verrou temporaire et un code d'erreur public. Il ne stocke jamais le message brut d'une exception ou le résultat d'un fournisseur dans les journaux d'exploitation.

Une tâche d'exploitation terminée ne se réexécute pas avec le même identifiant. Une exécution interrompue devient **incertaine**, avec alerte ; elle n'est pas répétée aveuglément. Une tâche bloquée par configuration conserve son diagnostic. Corriger la configuration puis examiner la tâche ; ne pas modifier son identifiant pour forcer une nouvelle action externe avant rapprochement. La configuration du compte Cloudflare, le déploiement du Worker Braand et l'observation d'au moins un déclenchement réel restent à faire.

Une panne de D1 empêche aussi l'outbox de fonctionner : un contrôle de disponibilité **extérieur** doit alerter quand tout le service est inaccessible. Il n'a pas été configuré ici.

## Configuration Resend

Variables uniquement serveur, sans valeur dans le dépôt :

```dotenv
APP_ENV=test
OPS_ADMIN_IDS=
SCHEDULER_SECRET=
RESEND_MODE=disabled
RESEND_API_KEY=
RESEND_FROM=
RESEND_TEST_RECIPIENT=
OPS_ALERT_EMAIL=
RESEND_LIVE_APPROVED=false
```

Par défaut, aucun appel Resend n'est possible. `sandbox` exige `APP_ENV=test` ou `staging`, un expéditeur explicite et `RESEND_TEST_RECIPIENT`. Cela **limite l'application au destinataire de test** ; Resend n'a pas pour autant une infrastructure d'envoi gratuite/sandbox distincte garantie. Un test d'envoi réel consomme potentiellement du quota et exige l'autorisation prévue pour la mission. Aucun destinataire réel n'est inventé.

`live` exige `APP_ENV=production`, `RESEND_LIVE_APPROVED=true`, expéditeur et `OPS_ALERT_EMAIL`. Ne pas activer cette configuration avant l'accord du propriétaire, domaine validé et message test effectivement reçu. Ici seuls les messages d'exploitation à un destinataire configuré sont implémentés : ni broadcasts, ni relances commerciales, ni notifications clients générales.

Le client REST appelle uniquement `https://api.resend.com/emails`, avec clé serveur et `Idempotency-Key` stable. L'identifiant fournisseur est enregistré sans le contenu de la réponse. Succès API signifie **accepté par Resend**, pas reçu en boîte. Un timeout, une réponse 5xx ou ambiguë devient `uncertain` : aucun renvoi automatique après une interruption. Pour résoudre, consulter Resend et rapprocher l'identifiant avant toute nouvelle action. L'alerte sur un problème d'e-mail reste dans la console afin de ne pas créer une boucle d'e-mails d'alerte.

Sources officielles consultées le **2026-10-18** : [Send Email](https://resend.com/docs/api-reference/emails/send-email), [idempotence](https://resend.com/docs/dashboard/emails/idempotency-keys). Le prestataire conserve ses clés d'idempotence **24 heures** ; le journal Braand conserve durablement l'état local, et ne se repose pas sur une déduplication fournisseur illimitée.

## Sauvegarde chiffrée et restauration

Variables/bindings serveur nécessaires :

```dotenv
BACKUP_ENABLED=false
BACKUP_ENCRYPTION_KEY=
BACKUP_MAINTENANCE_CONFIRMED=false
BACKUP_RESTORE_ALLOWED=false
```

- `DB` : base source ; `BUCKET` : fichiers source ; `BACKUP_BUCKET` : bucket de sauvegarde **distinct** et privé. Configurer réellement deux ressources séparées ; le contrôle d'identité des bindings ne peut pas certifier que deux alias d'hébergement ne pointent pas sur le même bucket.
- `BACKUP_ENCRYPTION_KEY` : **32 octets aléatoires encodés en base64**, gardés hors Git et séparément des archives. Sans cette clé, aucune récupération n'est possible. Conserver les anciennes clés sous contrôle restreint lors d'une rotation, puis tester leur récupération.
- `BACKUP_MAINTENANCE_CONFIRMED=true` : atteste une fenêtre sans mutation applicative ni écriture R2 externe. Le contrôle est une précondition d'exploitation ; il ne suspend pas magiquement tous les utilisateurs et fournisseurs. D1 et R2 ne partagent pas de transaction globale. Ne pas affirmer qu'il existe un snapshot simultané sous charge d'écriture.

`createEncryptedBackup()` produit désormais une archive **v2 segmentée**, dans le bucket distinct et sans écrasement :

1. Le snapshot SQL est lu ligne par ligne, sous une borne explicite, avec schémas/index/triggers et séquences. Il est enregistré en segments chiffrés d'au plus **1 Mio**.
2. La liste R2 est parcourue par pages de **100 objets**. Chaque objet est lu par plages d'au plus **1 Mio**, sous condition d'ETag, puis chaque plage est chiffrée séparément en AES-256-GCM avec IV aléatoire. L'identifiant de sauvegarde et le chemin logique de la partie sont authentifiés ; une partie déplacée ne s'authentifie pas.
3. Les tailles et empreintes SHA-256 des parties, les clés d'objets et leurs métadonnées sont rangées dans des pages chiffrées d'au plus **512 Kio** et **100 entrées**. Le fichier média entier et la liste complète des objets ne sont jamais réunis en mémoire par le service.
4. Le manifeste racine chiffré `braand-backups/<id>.bin`, préfixé `BRAAND2`, est écrit **après** tous les segments, puis le manifeste de supervision D1 est enregistré. Les parties sont sous `braand-backups/<id>/`. Aucun contenu métier ne figure dans le manifeste de supervision.

Un échec avant le manifeste racine laisse éventuellement des segments chiffrés orphelins, jamais une sauvegarde marquée terminée. Un échec D1 après le commit R2 peut laisser une archive complète non répertoriée ; la conserver et rapprocher son identifiant. Aucun effacement automatique n'est ajouté. Prévoir une politique d'inventaire, de rétention et de nettoyage après diagnostic ; les fragments ont un coût de stockage.

Le parcours reste **borné**, et `backupReadiness().limits` expose ses limites internes :

- Snapshot SQL : **8 Mio de JSON encodé**, **10 000 lignes**, **100 tables**. Cette borne indépendante des médias permet de restaurer D1 dans un seul batch transactionnel, sans contourner ses contraintes étrangères. Au-delà, utiliser un export/import D1 natif validé séparément.
- Médias : **100 000 objets**, **1 Gio par objet**, **64 Gio cumulés**, sans chargement intégral d'un fichier en mémoire. Un fichier de 50 Mio accepté par l'application tient dans ce parcours. Au-delà des bornes, la sauvegarde est refusée explicitement.
- Taille d'une partie claire : **1 Mio** ; pages de métadonnées : **512 Kio**. Chiffrement et lecture utilisent ces tampons bornés ; seul le petit snapshot SQL conserve une borne globale distincte.

Ces plafonds sont des garde-fous, pas des capacités Cloudflare mesurées. `ready=true` signifie que la configuration requise est présente ; il ne certifie ni que les données tiennent sous les limites SQL, ni que la durée, la mémoire, le CPU et les sous-requêtes du Worker suffisent au volume voulu. Une sauvegarde et une restauration à volume cible, avec mesure de la durée et des limites réelles du cron, restent indispensables avant lancement. Les lectures SQL/R2 ne constituent pas un snapshot simultané sous charge ; une fenêtre de maintenance exclusive reste exigée.

`restoreEncryptedBackup(id, targetDb, targetBucket)` :

1. exige `APP_ENV=test` ou `staging` et `BACKUP_RESTORE_ALLOWED=true` ;
2. refuse la base source, les buckets source/sauvegarde et toute destination contenant des tables applicatives ou objets ;
3. reconnaît les nouvelles archives **v2**, tout en conservant la lecture des anciennes archives **v1** (archive monolithique jusqu'à 8 Mio) ; vérifie l'authenticité AES-GCM, l'identifiant, les tailles, les types, les compteurs, l'ordre unique des clés et les condensats des parties **avant** la première écriture ;
4. relit et réauthentifie les parties v2 pendant leur envoi via `FixedLengthStream`, avec condition R2 de non-existence ; aucun tampon contenant le fichier complet n'est créé. Puis recrée tables/données/index/triggers dans un batch SQL transactionnel. Les archives v1 gardent leur parcours borné historique ;
5. n'expose **aucun endpoint de restauration de production**.

La destination doit être une base neuve, **sans migrations applicatives déjà exécutées**. Les contraintes étrangères sont différées pendant l'import. Les tables internes Cloudflare ne sont pas exportées. Les types/valeurs non représentables de manière exacte sont refusés. Une erreur entre R2 et D1 peut laisser une destination partiellement remplie : la conserver pour diagnostic, ne pas la purger automatiquement et recommencer sur une **nouvelle** destination après analyse. Une restauration en production nécessitera une procédure distincte, un plan de retour et un accord explicite.

Sources officielles consultées le **2026-10-18** : [batch D1](https://developers.cloudflare.com/d1/worker-api/d1-database/), [import/export et contraintes étrangères](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [API R2 et écritures conditionnelles](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [Time Travel D1](https://developers.cloudflare.com/d1/reference/time-travel/). Les fonctions natives Cloudflare n'ont pas été testées sur le compte du propriétaire.

## Procédure d'incident minimale

1. Examiner les états `/api/admin/operations` avec un compte explicitement autorisé.
2. Bloquer les nouvelles dépenses dans la configuration de la fonction concernée ; conserver les preuves et réservations incertaines.
3. Rapprocher le système externe avant toute relance financière, média ou e-mail.
4. Pour une reprise de données, conserver la source, choisir des destinations test/staging neuves et vérifier l'exercice complet. Ne jamais substituer une restauration à l'annulation de vrais paiements.
5. Notifier le propriétaire par le canal de support validé. Adresse et canal d'astreinte restent à fournir.

Avant ouverture : vrai scheduler cloud observé, domaine Resend vérifié SPF/DKIM/DMARC, destinataire de test fourni et réception confirmée, alerte externe de disponibilité, buckets séparés, sauvegarde à volume réel et restauration cloud prouvées, conservation/rotation/accès du propriétaire validés.
