# Braand — première implémentation

Application React / TypeScript, Vinext, Cloudflare D1 et R2. Interface française inspirée des captures fournies ; le nom Braand est provisoire.

## État réel

Cette livraison est un **socle fonctionnel de préversion**, pas l’implémentation complète du plan directeur ni une ouverture commerciale.

### Implémenté dans le code
- Interface responsive : navigation, chat, recherche, projets, bibliothèques, Analytics, missions, paramètres et panneau redimensionnable avec fermeture manuelle respectée.
- Connexion utilisateur fournie par Sites ; espace privé par utilisateur et filtres serveur par propriétaire sur chaque lecture/écriture.
- Discussions et ressources persistantes, images et textes en stockage R2, contexte multimodal pour les images.
- Boucle Anthropic Messages : modèle configurable (par défaut `claude-opus-5-5`), streaming natif, outils déclarés au modèle, validation serveur, arrêt, journal séquencé récupérable par curseur.
- Délégation native aux spécialistes créatif et campagnes, maximum trois tâches par réponse, outils de lecture limités, rapports persistants et arrêt contrôlé. Le modèle maître reste responsable de la restitution.
- Aucun aiguillage conversationnel par mots-clés ; seules les réponses réellement produites par l’API deviennent des messages d’assistant.
- Outils : recherche des ressources, sauvegarde de connaissances, création et révision de pages, catalogue média, proposition de génération, plans de campagne et de mission, lecture Meta, candidats de compétences privées.
- Pages structurées, rendu HTML échappé, aperçu isolé sans scripts, formats ordinateur/téléphone, export HTML, versions et restauration.
- Catalogue fal.ai administré avec schémas d’entrées bornés et plafonds en crédits ; approbation versionnée, réservation transactionnelle, soumission réelle à la queue, consultation du résultat et débit unique.
- OAuth Meta en lecture (`ads_read`, `pages_show_list`), état anti-rejeu à usage unique, jetons chiffrés AES-GCM, comptes et statistiques réelles des 30 derniers jours.
- Journal d’audit, contrôles de coût, états d’erreur explicites et garde-fous de mandat testés.

### Dépendances externes non configurées
Aucune clé Anthropic ou fal.ai, aucune application Meta, aucun compte publicitaire, aucune enveloppe payante n’a été ajouté. Les connexions réelles ne sont donc pas testées de bout en bout. Un indicateur « configuré » signifie que les paramètres sont présents, pas que le fournisseur a été certifié opérationnel.

### Encore à développer avant de satisfaire le plan complet
- Création et lancement d’annonces Meta, ad sets, médias publicitaires, Pixel/CAPI, suivi vérifié, permissions d’écriture et revue Meta.
- Moteur durable de missions, mandats actifs, échéances, reprises après crash, travail hors ligne et optimisations autonomes.
- Exécution parallèle des spécialistes, budgets comptables dédiés, évaluations de qualité et validation fournisseur de la délégation.
- Promotion et partage contrôlés de compétences communes, évaluation indépendante, canary et retour arrière. Les compétences actuelles restent privées et candidates.
- Hébergement public des landing pages sur une origine distincte, domaines, formulaires, prospects et événements de conversion.
- Session Chromium distante isolée et transfert de contrôle. Le panneau actuel propose uniquement une ouverture externe explicite.
- Abonnements, rechargement des crédits, tarification commerciale, comptabilité des appels du modèle, plafonds globaux et console admin de rapprochement. Les refus explicites de fal.ai libèrent maintenant la réservation ; les résultats incertains restent à rapprocher.
- Équipes / plusieurs entreprises, rôles effectivement appliqués, isolation des projets à l’intérieur d’une entreprise, export/suppression complets, rétention et notifications.
- Recherche web, analyse des sites par URL, PDF/vidéo/audio comme entrées, éditeur de créations avancé et génération structurée de dashboards.
- Reconnexion transparente du client au flux actif : l’API de replay est disponible ; le client ne relance jamais automatiquement une réponse interrompue.
- Certification accessibilité, tests fournisseurs réels, charge, restauration de sauvegarde et tests utilisateurs.

Les boutons d’autonomie et de diffusion ne sont pas activés artificiellement. Fermer le navigateur peut interrompre un tour du modèle. Une génération déjà acceptée par fal.ai continue chez le fournisseur ; son résultat se récupère avec « Vérifier la génération ».

## Installation

Node.js 22.13+ (Node 24 recommandé pour les tests SQLite), npm et Git.

```powershell
npm ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_thankful_punisher.sql
npm run dev
node --test tests/core.test.mjs
```

Ne rejouez pas une migration déjà appliquée. Le fichier `.openai/hosting.json` conserve l’identité du site et les bindings DB / BUCKET. La publication Sites applique les migrations hébergées.

## Configuration serveur

Les valeurs restent dans les secrets de l’hébergement ou dans un fichier local ignoré ; aucune clé ne doit entrer dans le bundle client.

- `ANTHROPIC_API_KEY` : API Anthropic.
- `ANTHROPIC_MODEL` : facultatif, défaut `claude-opus-5-5`. Vérifier l’accès réel à ce modèle.
- `FAL_KEY` : API fal.ai.
- `FAL_CATALOG_JSON` : liste administrée, vide par défaut. Chaque entrée comprend id, name, kind (image/video/audio), credits (entier positif), description, inputSchema (objet JSON Schema limité aux champs scalaires, additionalProperties=false, limites explicites). Tester chaque endpoint, entrée et tarif avant activation.
- `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION` : configuration de votre application Meta et version officiellement prise en charge.
- `META_REDIRECT_URI` : origine réelle suivie de /api/meta/callback, enregistrée chez Meta.
- `TOKEN_ENCRYPTION_KEY` : clé AES-256 aléatoire encodée base64, séparée du secret Meta.

Les crédits démarrent à zéro. Aucun solde fictif n’est offert. La conversation est limitée à 20 tours par utilisateur et par jour pour cette préversion ; ce contrôle doit devenir une réservation de quota atomique avant usage public à grande échelle.

## Points d’attention pour la reprise

- Routes HTTP dans app/api ; politique pure dans lib/core.mjs ; orchestration dans lib/agent.ts ; connecteurs dans lib/providers.ts.
- Toutes les mutations d’objets versionnés doivent utiliser updateResource ; ne pas contourner la vérification de version pour une action approuvée.
- Les opérations de génération utilisent l’identifiant proposition:version. Un timeout fournisseur devient needs_reconciliation et conserve la réservation : ne pas resoumettre aveuglément.
- Une panne après passage en settling doit être rapprochée avec le résultat externe conservé. Il n’existe pas encore de reconciler automatique ; accès administrateur nécessaire avant une ouverture commerciale.
- La grille de statistiques affiche au maximum 100 campagnes et signale les résultats partiels. Elle ne transforme pas les clics en ventes et ne calcule pas une rentabilité sans coûts/encaissements.
- L’authentification locale est celle du starter ; l’identité hébergée vient exclusivement du proxy Sites.
- Les informations présentes dans un fichier ou une compétence n’autorisent aucune action.

## Vérifications de cette livraison

- 15 tests Node passent : mandats, expiration/révocation, versions, parsing SSE fragmenté, URL, encodage HTML, métriques, limites d’entrée fal.ai, réservations SQL et acquisition unique d’un règlement.
- Contrôle TypeScript du code applicatif avec déclarations d’environnement de test : réussi. Cela ne remplace pas le build Vinext complet.
- 10 parcours UI sur Chromium : navigation, suggestions, brouillon conservé, connexion requise, panneau, bibliothèques, Analytics vide et mobile sans débordement.
- Détecteur Impeccable : aucune alerte.
- 13 tests HTTP supplémentaires passent sur les vraies routes avec SQLite et stockage local isolés : identité, persistance, versions, origine des mutations, fichiers, signature MIME et indisponibilité explicite des fournisseurs.
- Compilation et publication distante du premier état réussies sur Sites. URL privée : https://braand-growth-studio.wiseskunk64.chatgpt.site
- Captures : ../braand-desktop.png et ../braand-mobile.png.
- Compilation complète locale impossible : installation interrompue par disque plein. Les dépendances incomplètes du projet ont été nettoyées. Une vérification réduite a été installée dans work/verify.

## Aperçu local avec serveur

`scripts/dev-local.mjs` exécute les mêmes routes API que l’application avec SQLite et un stockage de fichiers locaux. C’est un adaptateur de développement uniquement, lié à 127.0.0.1 ; il n’est jamais utilisé par le Worker hébergé.

- Démarrage : `node scripts/dev-local.mjs` après installation des dépendances. Le paquet esbuild doit être disponible.
- Dans cet environnement à disque limité, définir BRAAND_TOOLCHAIN vers le dossier work/verify/node_modules avant le démarrage.
- Port par défaut : 4175 ; variable PORT pour le changer.
- Données privées locales : .local-data, ignoré par Git. BRAAND_DATA_DIR permet un dossier de test distinct.
- La connexion locale est une session de développement, pas une authentification ChatGPT réelle. Le badge Local le signale après connexion.
- Les clés peuvent être définies dans .dev.vars, également ignoré. Le serveur ne lit aucune clé du navigateur.
- Pour tester : démarrer une instance isolée sur 4176, puis `node tests/http.integration.mjs`. Ce script refuse les cibles non locales.

## Références fournisseurs

- [Anthropic streaming](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [Anthropic tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [fal.ai queue](https://fal.ai/docs/model-apis/queue)
- [Meta Marketing API](https://developers.facebook.com/docs/marketing-apis/)

