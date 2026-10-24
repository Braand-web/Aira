# Braand : renommage et raccordement — 24 octobre 2026

Le propriétaire a choisi **Braand**, `braand.fun` et un compte Resend dédié. L’adresse Gmail fournie sert de contact technique et de destinataire de test ; elle n’est pas utilisée comme expéditeur du domaine. Ce relevé décrit les opérations terminées à 15:17 UTC et les limites restantes.

## Produit et compatibilité

Le nom visible est remplacé dans l’application, ses métadonnées, les pages de connexion, les messages e-mail, les factures, les avoirs, les consignes des agents et les compétences originales. Le catalogue de 25 compétences est régénéré depuis les sources ; les empreintes correspondent au contenu. Les textes importés d’autres auteurs ne sont pas réécrits.

Les ressources `aira-*`, noms des skills, cookies, formats de sauvegarde, contrats API et clés de stockage restent identiques. Ces identifiants techniques ne demandent aucune migration pour le renommage. Aucun utilisateur, crédit, compte connecté ou historique n’est recréé. Le design et les dimensions du composeur sont conservés.

## Déploiements distants

- Staging : Worker `aira-staging`, version `b8ccc611-73f7-45dc-8941-0b5f6482ae35`, D1 `7a2e1508-922b-4138-97ba-40e61c9be447`, buckets `aira-staging-files` et `aira-staging-backups`.
- Production privée : Worker `aira-production`, version active après ajout des secrets `a9e4f323-aef9-4744-ad3b-2e6b134456c3`, D1 `b7f76985-2bb9-45ef-9fa0-b575ad2a3cce`, buckets `aira-production-files` et `aira-production-backups`. Version initiale du code : `9803a1c0-e6ec-4ac0-a733-91a83dff7f42`.
- Les deux D1 ont les migrations 0000 à 0015. Bases et buckets sont séparés. URLs workers.dev et previews persistantes désactivées, aucune route publique.
- Les quatre buckets ont passé une écriture de contrôle, une relecture comparée par SHA-256 puis une suppression. URLs R2 publiques désactivées, aucun domaine personnalisé attaché. Cela ne prouve ni l’upload applicatif authentifié ni la restauration d’une sauvegarde.
- Origine prévue : `https://braand.fun`, expéditeur prévu : `connexion@braand.fun`. Authentification, e-mails, paiements, navigateur, autonomie, Instant et sauvegardes restent fermés. Aucun indicateur de recette non effectuée n’est activé.

## Fournisseurs : preuves et limites

- **OpenRouter** : clé acceptée sur `GET /api/v1/key` (200). Le modèle existant `anthropic/claude-opus-5.5` est disponible dans le catalogue et ses prix de tokens correspondent à la configuration. Modèle et tarifs conservés, aucune génération facturée. La conversion monétaire et les frais internes ne sont pas revalidés par cette lecture.
- **Composio** : catalogue HTTP 200 et lecture réussie avec le SDK installé. Clé liée aux deux Workers. Aucune nouvelle connexion OAuth ni exécution métier sur un compte tiers n’est prouvée.
- **SasPay** : clé live acceptée sur les tarifs et comptes marchands (200), marchand déterminé sans paiement. Clé et marchand liés aux deux Workers. `SASPAY_ENV=live` correspond à la clé, mais `BILLING_ENABLED=false`. Aucun webhook Braand vérifié ni secret de signature disponible. La création/modification des webhooks passe par le tableau de bord selon l’API documentée ; la clé permet leur consultation. Fiscalité, données légales, économie, XAF, webhook et restauration restent à valider avant encaissement.
- **Resend** : ancienne clé acceptée (200), trois domaines existants vérifiés. Ajout de `braand.fun` refusé (403, limite du forfait). Aucun domaine supprimé ni abonnement acheté. Après le choix d’un compte dédié, l’ancienne clé n’est pas copiée en production ; elle reste au staging, envoi désactivé. Nouvelle clé et vérification DNS restent à faire.

Les clés fournies sont des secrets Cloudflare `secret_text`. Les secrets techniques de production sont aléatoires et distincts du staging. Leurs sauvegardes locales sont chiffrées pour l’utilisateur Windows et ignorées par Git. Un scan des valeurs exactes est effectué avant commit. Une variable Resend saisie précédemment en clair dans le staging a été remplacée par un secret ; cela n’efface pas les anciennes versions Cloudflare. Une rotation des clés partagées dans la conversation reste recommandée après raccordement.

## Domaine : blocage et procédure

Cloudflare ne retrouve aucune zone `braand.fun`. Le DNS public annonce `aster.dns-parking.com` et `helios.dns-parking.com`. La création via OAuth CLI est refusée : HTTP 403, permission manquante `com.cloudflare.api.account.zone.create`. Aucun serveur de noms ni enregistrement DNS n’a été modifié.

1. Dans Cloudflare, choisir **Ajouter un domaine**, saisir `braand.fun`, puis l’offre **Free**.
2. Examiner et préserver les enregistrements du site et du courrier existants. Cloudflare affichera les deux serveurs de noms assignés ; ne pas les inventer ou reprendre ceux d’un autre domaine.
3. Chez le vendeur du domaine, remplacer les serveurs de noms par ceux de cette zone. Attendre l’état actif et vérifier les enregistrements conservés.
4. Dans le compte Resend dédié, ajouter `braand.fun`, installer les enregistrements SPF/DKIM fournis et attendre leur vérification. Stocker sa clé dans le secret serveur `RESEND_API_KEY` du bon Worker.
5. Raccorder le domaine au Worker de production, vérifier HTTPS et l’origine, puis tester le vrai parcours de connexion avant les e-mails clients. La facturation exige sa recette distincte.

Les outils actuels n’accèdent pas aux sessions du panneau droit. Aucune extraction de cookies ou contournement d’authentification n’a été utilisé.

## Vérifications

- Types, lint, build et `git diff --check` : réussis.
- `npm test` : 176 tests unitaires, 18 suites d’intégration, 4 suites d’artefacts et 2 lanceurs HTTP réussis, réseau externe bloqué. Une première exécution des artefacts a croisé la compilation en cours ; la suite complète relancée après le build réussit sans assouplissement.
- Chromium : 41 contrôles agent/interface et 7 contrôles de connexion réussis. Ordinateur/mobile/tablette, brouillons, permissions, streaming et absence de débordement couverts ; fournisseurs simulés. Captures ordinateur/mobile examinées.
- Preview distante du même bundle et ressources de production : huit contrôles réussis. Accueil et santé D1 200 ; workspace, lecture/requête chat et Meta sans session 401 ; identité usurpée 401 ; connexion désactivée 503. Nom Braand présent. Aucun utilisateur fictif, e-mail, paiement ni génération créé.
- Mesures ponctuelles du proxy : accueil 2176 ms, santé D1 261 ms, refus d’accès 53–111 ms. Observations uniques incluant réseau/preview : ni benchmark public, ni comparaison avant/après, ni délai de réponse IA.

Le parcours authentifié sur `braand.fun`, les générations facturées, les comptes métier, le webhook et la restauration cloud restent non validés. Les alertes de dépendances documentées dans le guide Cloudflare subsistent ; aucune certification de sécurité ou de disponibilité publique n’est revendiquée.
