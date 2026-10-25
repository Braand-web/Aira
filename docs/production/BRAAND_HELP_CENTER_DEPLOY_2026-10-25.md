# Centre d’aide Braand — mise en ligne du 25 octobre 2026

## Publication vérifiée

- Le dépôt GitHub s’appelle `Braand-web/Braand`. Le commit applicatif `74d8434` est publié sur `main`.
- Le code de l’application et du centre d’aide a été publié sur le Worker qui dessert déjà `braand.fun`. Version Cloudflare : `a0c2d6f9-c048-4723-93ec-7d98ccfc43aa`.
- Les routes `/aide` et ses sept articles renvoient HTTP 200, avec titres, canoniques et `index, follow`. Le sitemap contient les huit URL d’aide.
- L’accueil privé renvoie HTTP 200 et conserve `noindex, nofollow`. Les API workspace et chat restent protégées sans session (401). `/api/health` renvoie `ok`. Un slug d’article inconnu renvoie 404 et propose le retour au centre.
- La feuille de style publique répond HTTP 200. Les pages légales gardent leurs métadonnées et leur indexation existantes.
- Les filtres et boutons d’effacement de l’aide ont des cibles tactiles minimales de 44 px.

## Données et périmètre de cette mise en ligne

La publication met à jour le code en réutilisant la route et les bindings de production déjà en service. Elle n’a exécuté aucune migration D1/R2 et n’a modifié aucun compte, message, crédit, fichier ou historique utilisateur. La lecture des anciennes sessions, préférences locales et sauvegardes chiffrées est maintenue par compatibilité dans le code.

Le transfert vers des ressources Cloudflare portant exclusivement les nouveaux noms Braand reste à effectuer. La configuration active contient encore les bindings historiques. Les valeurs des secrets Cloudflare ne sont pas récupérables par lecture depuis Wrangler; elles devront être provisionnées dans le nouveau Worker par le canal sécurisé du compte. Le droit de modifier la route du domaine devra également être confirmé avant la bascule.

## Séquence de migration restante

1. Sauvegarder la D1 et les objets R2 de production; restaurer la sauvegarde dans un environnement isolé et comparer schémas, comptes, crédits, références de fichiers et empreintes d’objets.
2. Préparer les ressources Braand séparées, puis activer une fenêtre de lecture seule qui bloque paiements, uploads et autres écritures.
3. Copier les données et objets sans réécrire le texte des utilisateurs; comparer identifiants, volumes, sommes financières et empreintes. Réencoder les sauvegardes avec le format Braand puis vérifier une restauration.
4. Configurer les secrets du nouveau Worker via le gestionnaire Cloudflare, sans les placer dans Git ou dans un document. Vérifier santé, authentification, lecture des données et accès aux fichiers avant de déplacer la route.
5. Basculer `braand.fun/*`, vérifier les pages publiques, les API anonymes, les assets et les ressources de données, puis rouvrir les écritures.
6. Garder les anciennes ressources en lecture seule pendant sept jours. Le retour arrière doit rester compatible avec les nouvelles écritures ou prévoir leur réconciliation; ne pas revenir à une base ancienne après avoir accepté des écritures sur la nouvelle.

Aucune ancienne ressource n’a été supprimée et aucune fenêtre de maintenance n’a été ouverte pendant cette publication.
