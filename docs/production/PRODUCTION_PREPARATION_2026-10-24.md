# Préparation de la production — 24 octobre 2026

> Relevé historique antérieur au raccordement des clés. L’état plus récent figure dans [le déploiement Braand](BRAAND_ROLLOUT_2026-10-24.md) : R2 est désormais disponible et les deux Workers privés sont déployés.

Le propriétaire a explicitement autorisé la connexion des fournisseurs et la préparation d'une mise en production. Cette note distingue les opérations réellement terminées des accès encore manquants.

## Ressource créée et vérifiée

Base D1 distante `aira-production`, ID `b7f76985-2bb9-45ef-9fa0-b575ad2a3cce`, compte `2ead1748668417f67d184d93a3fd69ec`, région indicative WEUR. Elle est distincte de `aira-staging` et des bases des autres produits.

Les 16 migrations, de 0000 à 0015, ont été appliquées avec succès. Vérification distante : 16 entrées dans `d1_migrations`, quatre tables du harness présentes, zéro utilisateur dans `auth_users`, aucune anomalie renvoyée par `PRAGMA foreign_key_check`. Aucun utilisateur ou crédit de démonstration n'a été créé.

Le manifeste local ignoré `.wrangler/deploy/production-migrations.json` sert uniquement aux commandes D1 ; il n'est pas un manifeste de déploiement complet et n'a pas été utilisé pour publier un Worker. Le staging et sa configuration n'ont pas été remplacés.

## Fournisseurs et accès constatés

- Cloudflare : l'accès CLI fonctionne. La liste R2 échoue toujours avec le code 10042, « Please enable R2 through the Cloudflare Dashboard ». Aucun bucket de production ni de sauvegarde n'a été créé et aucune activation R2 n'est déclarée réussie.
- La liste des secrets du staging comporte maintenant `COMPOSIO_API_KEY`. Présence seulement : la clé n'a pas été lue, remplacée ou exportée, et aucun appel métier n'a validé ce connecteur pendant cette préparation.
- `RESEND_API_KEY`, `SASPAY_SECRET_KEY`, `SASPAY_MERCHANT_ID` et `SASPAY_WEBHOOK_SECRET` sont absents de cette liste. Une session de tableau de bord ouverte ne fournit pas automatiquement ces identifiants au Worker.
- Le contrôle du panneau droit n'est pas exposé dans les outils de cette conversation. Les capacités disponibles ont été revérifiées après la demande de le forcer ; aucun outil de contrôle navigateur/Computer Use utilisable n'est apparu et aucun endpoint CDP n'a été constaté sur les ports usuels vérifiés. Aucun cookie, profil navigateur ou stockage d'authentification n'a été extrait.
- Le navigateur TinyFish installé dispose d'un profil Default sans site connecté déclaré. Il est distinct des onglets du panneau droit ; aucune session authentifiée ou exécution facturée n'a été lancée avec ce profil.

## Suite nécessaire

Rendre disponible le contrôle navigateur dans la session, ou utiliser une connexion autorisée dans un navigateur contrôlable, ou saisir les clés directement dans les secrets Cloudflare. L'autorisation de créer des clés est acquise ; il manque le canal technique permettant d'utiliser les tableaux de bord.

Terminer l'activation R2, les buckets séparés, la configuration d'une origine HTTPS et d'un expéditeur e-mail vérifié. Valider les appels fournisseurs et le parcours authentifié avant publication. Les encaissements nécessitent en plus les preuves réelles exigées par `releaseReadiness`, notamment les tests XAF/webhook, coûts, fiscalité, identité légale et restauration ; aucun indicateur de validation ne doit être déclaré vrai sans preuve.

Le Worker public de production, les paiements live et l'envoi d'e-mails clients ne sont pas activés par cette préparation. La version privée du staging demeure `6f4aa0ee-abe9-4405-978b-a262af34978e` au dernier déploiement effectué dans cette conversation.
