# Exploitation, alertes et exercice de restauration

## Ce qui a été exécuté

Le **18 octobre 2026**, `node tests/production-operations.integration.mjs` a exécuté **12 contrôles** avec les vrais services TypeScript, les vraies routes, SQLite en mémoire et Web Crypto AES-GCM. Ils passent : secret du planificateur, verrou concurrent, déduplication, erreur de tâche, outbox, refus d'envoi non configuré, demande de test, timeout incertain, garde de production, sauvegarde chiffrée et restauration complète.

La restauration compare toutes les tables et données du snapshot, les objets et métadonnées, les séquences SQLite et l'intégrité des clés étrangères. Les déclencheurs financiers sont recréés **après** les lignes : restaurer un lot ne réattribue pas ses crédits et ne redébite pas une allocation. Aucun `DROP`/`DELETE` ne fait partie du code de restauration.

**Limite de preuve :** R2 est simulé en mémoire et Resend est remplacé par un stub HTTP. Aucun e-mail réel n'est parti, aucun e-mail n'est prouvé reçu, aucun bucket réel n'a été créé et aucune restauration Cloudflare distante n'est prouvée. Les comptes/domaine/destinataire n'étant pas configurés, les preuves externes restent **BLOQUÉES**.

## Routes et droits

- `GET /api/health` : état minimal `ok` ou `unavailable`, réponse non cachée ; ne renvoie ni environnement, ni nom de base, ni clé. Ce contrôle vérifie la disponibilité de la connexion D1, pas tous les fournisseurs.
- `POST /api/internal/operations-tick` : en-tête `Authorization: Bearer <SCHEDULER_SECRET>`. Secret serveur de **32 à 512 caractères** imposé par Aïra ; comparaison de condensats SHA-256 de taille constante. Ces bornes sont des choix internes, pas des limites fournisseur.
- `GET /api/admin/operations` : réservé aux identifiants internes explicitement listés dans `OPS_ADMIN_IDS`. L'appartenance à une entreprise ne donne aucun droit d'exploitation global.
- `POST /api/admin/operations` : seule action `test-alert`, uniquement en `test` ou `staging`, origine identique exigée, corps borné, clé d'idempotence UUID. Cette route met en file ; elle n'envoie pas directement d'e-mail.

La migration additive `0010_operations.sql` crée les journaux des tâches, alertes, outbox et manifestes de sauvegarde. Exécuter la migration en staging puis vérifier la route ; ne jamais supprimer une migration ou des écritures financières pour revenir à une ancienne version.

## Planification et reprise

Le Worker Aïra possède un `scheduled()` handler. La configuration Cloudflare Vite utilise `triggers.crons: ["*/5 * * * *"]` et le build génère ce déclencheur dans `dist/server/wrangler.json`. `tests/worker-config.test.mjs` vérifie le cron et les bindings D1/R2 générés. La syntaxe correspond au champ Wrangler `triggers.crons` décrit dans la [documentation Cloudflare](https://developers.cloudflare.com/workers/wrangler/configuration/). Le worker exécute en série `billing-tick`, `mission-tick`, puis `operations-tick`. Chaque route vérifie le même secret serveur d'au moins 32 caractères ; le helper compare les condensats à taille constante. Un échec de tâche crée une alerte sans journaliser le secret ni le corps d'erreur. Ces preuves sont locales : le Worker Aïra n'a pas été déployé et aucun déclencheur Cron distant n'a été observé.

`runOperationsTick()` regroupe :

1. Inspection des incidents une fois par fenêtre interne de cinq minutes : événements de paiement morts, coûts fournisseurs inconnus depuis plus d'une heure, tâches interrompues, notifications échouées/incertaines.
2. Sauvegarde quotidienne UTC lorsque `BACKUP_ENABLED=true` et les prérequis sont vérifiés.
3. Traitement borné de l'outbox opérationnelle.

`runTrackedJob(name, id, work)` conserve un identifiant métier, un état, les tentatives, un verrou temporaire et un code d'erreur public. Il ne stocke jamais le message brut d'une exception ou le résultat d'un fournisseur dans les journaux d'exploitation.

Une tâche d'exploitation terminée ne se réexécute pas avec le même identifiant. Une exécution interrompue devient **incertaine**, avec alerte ; elle n'est pas répétée aveuglément. Une tâche bloquée par configuration conserve son diagnostic. Corriger la configuration puis examiner la tâche ; ne pas modifier son identifiant pour forcer une nouvelle action externe avant rapprochement. La configuration du compte Cloudflare, le déploiement du Worker Aïra et l'observation d'au moins un déclenchement réel restent à faire.

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

Sources officielles consultées le **2026-10-18** : [Send Email](https://resend.com/docs/api-reference/emails/send-email), [idempotence](https://resend.com/docs/dashboard/emails/idempotency-keys). Le prestataire conserve ses clés d'idempotence **24 heures** ; le journal Aïra conserve durablement l'état local, et ne se repose pas sur une déduplication fournisseur illimitée.

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

`createEncryptedBackup()` lit les tables dans un batch D1, récupère les objets avec leur ETag, inclut schémas/index/triggers et séquences, chiffre l'archive AES-256-GCM avec IV aléatoire et identifiant authentifié, puis écrit dans le bucket distinct sans écrasement. Aucun contenu métier ne figure dans le manifeste de supervision.

Le parcours est volontairement **borné pour l'exercice de reprise** : archive claire maximum **8 MiB**, **10 000 lignes**, **100 objets** et **100 tables** (limites internes Aïra). Au-delà il refuse explicitement, au lieu de produire une sauvegarde partielle présentée comme complète. Ce mécanisme ne suffit pas à sauvegarder les quotas médias Business : prévoir un export D1 natif et une copie R2 durables adaptés au volume, puis exécuter un exercice sur le cloud avant lancement. La simple présence de ce code ne valide pas les engagements de sauvegarde en production.

`restoreEncryptedBackup(id, targetDb, targetBucket)` :

1. exige `APP_ENV=test` ou `staging` et `BACKUP_RESTORE_ALLOWED=true` ;
2. refuse la base source, les buckets source/sauvegarde et toute destination contenant des tables applicatives ou objets ;
3. vérifie l'authenticité AES-GCM, l'identifiant, la taille, les types et les condensats des objets **avant** la première écriture ;
4. restaure les objets sans écrasement, puis recrée tables/données/index/triggers dans un batch transactionnel ;
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
