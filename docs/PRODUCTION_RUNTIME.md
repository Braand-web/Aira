# Publication des pages et missions durables

État vérifié le 18 octobre 2026 : services et routes exécutés contre une base SQLite isolée. Aucun déploiement distant, achat, campagne, e-mail ou appel IA payant effectué par ces tests. Une mise en ligne et un ordonnanceur Cloudflare réel restent à valider.

## Pages publiques

- `PAGES_ORIGIN` : origine HTTPS dédiée aux pages publiques, distincte de l'administration. Une URL publique ne fonctionne pas sur l'origine de l'application. Aucun cookie de l'administration ne doit être partagé avec ce domaine (cookies limités à l'hôte).
- `PAGE_FORM_SECRET` : secret serveur aléatoire de 32 caractères minimum, seulement si les formulaires sont activés.
- L'abonnement doit être actif pour préparer, approuver et servir une page. L'expiration suspend immédiatement la lecture publique sans supprimer le brouillon.
- La publication utilise un instantané, son empreinte SHA-256 et la version précise du brouillon. Toute préparation d'une nouvelle version suspend l'ancien instantané et nécessite une nouvelle approbation.
- Aucune publication depuis le modèle : le client authentifié appelle les routes après action explicite. Le rôle doit permettre `approve`.

Séquence API (prix, crédits et campagnes ne sont pas modifiés) :

1. `POST /api/pages/:id` avec `{ "action":"prepare", "version":1 }`. Renvoie l'aperçu, l'URL publique et l'empreinte `digest`. Un formulaire est optionnel : `form:{enabled:true,privacyUrl:"https://..."}`. Le responsable de la marque doit fournir la politique applicable.
2. Après vérification, `POST /api/pages/:id` avec `{ "action":"publish", "version":1, "digest":"empreinte retournée", "approved":true }`.
3. Visiter l'URL retournée, depuis l'origine publique configurée. La page sert du HTML échappé sans script, sous une politique CSP restrictive.
4. `POST /api/pages/:id` avec `{ "action":"suspend" }` retire immédiatement la page.
5. `GET /api/pages/:id?leads` permet aux membres autorisés de consulter les demandes. Pagination par `cursor` retourné. Les envois ne sont jamais présentés comme ventes confirmées.

Les formulaires vérifient l'origine, le consentement, le format e-mail, la taille de corps et un champ piège. Ils limitent à cinq envois par page/adresse réseau/heure ; c'est une politique initiale de l'application, pas une limite de Cloudflare. L'adresse réseau n'est pas enregistrée : seule son empreinte HMAC à usage antiabus est conservée temporairement. La délivrabilité d'une notification par e-mail n'est pas implémentée ici ; les demandes sont enregistrées et consultables dans l'API privée.

## Définition de l'autonomie implémentée

Une mission approuvée permet au modèle de réaliser, sans navigateur utilisateur ouvert, une suite bornée d'analyses, de lectures autorisées et de brouillons privés. Chaque étape utilise le moteur `runAgent` et la comptabilisation IA existants. Les écritures externes et Instant conservent leurs approbations distinctes. Une campagne publicitaire n'est pas lancée automatiquement par ce mécanisme.

Le mandat comporte la version exacte du plan, les étapes, les critères et conditions d'arrêt fournis, le plafond total, le plafond par étape et une expiration. Les limites de budget, de rôle et de temps sont appliquées par du code. Les conditions métier rédigées librement sont soumises au modèle ; elles ne constituent pas des règles déterministes supplémentaires.

Variables serveur :

- `AUTONOMY_ENABLED=false` tant que les tests de déploiement n'ont pas été effectués.
- `AUTONOMY_SCHEDULER_VERIFIED=false` tant que le déclenchement hors navigateur n'a pas été démontré.
- `SCHEDULER_SECRET` : secret serveur indépendant, transmis uniquement en en-tête Authorization par le planificateur.

Séquence API :

1. Créer un brouillon de mission `mode:"autonomous"` via l'agent.
2. Après revue du mandat : `POST /api/missions/:id` avec `{ "action":"activate", "version":1, "approved":true, "maxCredits":20, "stepCredits":10, "expiresAt":<date future en millisecondes> }`. Valeurs d'exemple, pas une estimation du coût fournisseur. Le produit plafond-par-étape × nombre d'étapes doit tenir dans le plafond total. La durée maximale actuelle du mandat est sept jours.
3. Le planificateur appelle `POST /api/internal/mission-tick` avec `Authorization: Bearer <secret serveur>` ; ne jamais mettre ce secret dans une URL.
4. `GET /api/missions/:id` renvoie les étapes, les crédits rapprochés et les références des conversations et runs persistants.
5. `POST /api/missions/:id` avec `action:"suspend"`, `"cancel"` ou `"resume"` contrôle la mission. Une reprise vérifie les permissions, l'expiration, les propositions en attente et l'absence d'étape incertaine.

Le worker revendique un bail exclusif et conserve les checkpoints. Plusieurs déclenchements concurrents ne doivent pas exécuter deux fois une étape. Une fermeture du navigateur n'annule pas un tick cloud déjà exécuté par le planificateur. Les droits sont revérifiés pendant l'exécution.

Un arrêt du worker pendant un appel externe devient `waiting_user` avec étape `uncertain` : aucune relance aveugle. Le support doit rapprocher les identifiants d'exécution et consommations avant toute décision. Un outil administratif automatisant cette résolution reste à développer ; une étape incertaine ne peut pas être reprise depuis l'API utilisateur. Les étapes déjà terminées restent conservées.

Les résultats, blocages et tâches interrompues créent des notifications internes dédupliquées dans `billing_notifications` (`mission.*`). Leur acheminement par e-mail doit être validé séparément.

## Vérifications

```text
node tests/production-runtime.integration.mjs
npx tsc --noEmit
npx eslint lib/pages.ts lib/durable-missions.ts "app/api/pages/[id]/route.ts" "app/api/published/[id]/route.ts" "app/api/missions/[id]/route.ts" app/api/internal/mission-tick/route.ts tests/production-runtime.integration.mjs
```

Les tests utilisent les vrais services et routes, une base SQLite éphémère et un exécuteur injecté. Ils prouvent la politique d'autorisation et la reprise déterministe ; ils ne prouvent ni l'accès réel aux fournisseurs ni le déclenchement d'un worker cloud. N'activer les deux indicateurs d'autonomie qu'après test complet en staging, avec un modèle et des coûts vérifiés et une autorisation distincte de l'utilisateur pour toute dépense réelle.
