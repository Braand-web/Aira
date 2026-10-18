# État des lieux avant préparation à la production

Relevé du 18 octobre 2026. Les observations de code précèdent les modifications de chaque module. Les essais utilisent exclusivement des données fictives, une base locale isolée et des réponses fournisseurs simulées, sauf mention contraire explicite.

| Domaine | Présent au départ | Absent ou à corriger | Preuve |
|---|---|---|---|
| Application | Next 16 / React 19, TypeScript, Vinext / Cloudflare Worker | Correctifs de dépendances et validation complète | `package.json`, `vite.config.ts` |
| Données | D1, Drizzle, R2 ; organisations, rôles, ressources, messages, paiements, journal de crédits | Sauvegarde/restauration démontrée, nouvelles tables des modules ci-dessous | `db/*`, `drizzle/*` |
| Identité | Authentification hébergée Sites ; simulation locale sur boucle locale | Connexion publique distante à vérifier après préparation staging | `app/chatgpt-auth.ts`, `scripts/dev-local.mjs` |
| IA | Adaptateurs OpenRouter / Anthropic, streaming, mesure et réservation | Clés et tarifs effectivement validés dans l'environnement cible | `lib/llm.ts`, `lib/metering.ts` |
| Créations | Catalogue fal.ai et proposition à approuver | Catalogue évalué, preuve d'un livrable réel, prix futur accepté à tort | `lib/providers.ts`, `app/api/proposals/[id]/route.ts` |
| Composio / Meta | Découverte dynamique, comptes séparés, contrôle d'approbation dans le serveur | Clé Composio, configuration Meta Ads, connexion réelle, validation permissions et parcours campagne ; Instant doit rester OFF | `lib/composio.ts`, `COMPOSIO.md` |
| Pages | Brouillon, versions, aperçu, export | Publication sur une origine séparée et collecte de demandes | `lib/pages.ts`, `app/api/pages/[id]/route.ts` |
| Autonomie | Plan enregistré | Exécution persistante, mandat, reprise et ordonnanceur vérifié | `lib/agent.ts` |
| Paiements | Catalogue XAF, devis, checkout SasPay, HMAC, réservations atomiques, annuels, rapprochement | Format canonique de vérification, remboursements/avoirs, contrat carte/USD, test sandbox fournisseur | `lib/billing.ts`, `lib/billing-core.mjs` |
| Tâches | Route interne billing-tick avec secret, allocation et rapprochement | Déclencheur cloud, surveillance, notifications et preuve d'exécution planifiée | `app/api/internal/billing-tick/route.ts` |
| Exploitation | Hébergement Sites public existant, D1/R2 déclarés | Staging, sauvegarde distincte, alertes reçues, support et contrats | `.openai/hosting.json`, tableau de bord Sites |

## Inventaire des routes et des écrans

Écrans : chat, recherche, missions, tableau de bord, créations, fichiers, pages, campagnes, compétences, intégrations, forfait/crédits, administration financière. Le navigateur distant est annoncé comme indisponible.

API existantes : workspace, chat (streaming/reprise), ressources/version, fichiers et téléversement multipart, pages/aperçu, propositions média, Meta/OAuth/callback, connecteurs/catalogue/connexion/actions, facturation/catalogue/devis/checkout/commandes/usage/factures/remboursements, webhook SasPay, administration financière et tâche billing-tick. Les nouvelles routes sont documentées dans les rapports de modules ; leur présence seule ne prouve pas une activation distante.

Variables : inventaire sans valeurs dans `.env.example`. Secrets locaux et hébergés contrôlés uniquement par leur présence. Aucun secret n'est reproduit ici.

## Accès externes vérifiés en lecture seule

- Sites : projet Aïra existant, rôle propriétaire, audience publique, aucune automatisation attachée. Environnement distant : seulement `LLM_PROVIDER` et `OPENROUTER_MODEL` ; aucune clé fournisseur renseignée dans cet environnement. Aucun changement réalisé.
- Cloudflare : session connectée mais onglet ouvert sur le Worker **livefoot**, autre produit. Ce Worker n'est pas modifié ni réutilisé pour Aïra.
- Resend : session connectée ; clés visibles dédiées à d'autres produits, aucune clé Aïra identifiée. Aucune clé copiée ou créée et aucun e-mail envoyé.
- SasPay : tableau de bord accessible ; aucune transaction créée ni modifiée.
- Recherche de connecteurs natifs Cloudflare / Resend / SasPay : aucun résultat disponible. Les onglets de tableaux de bord ne constituent pas des secrets serveur déjà configurés.

## Dépendances déclarées par le propriétaire

Le propriétaire ne possède pas encore le domaine demandé ni n'a fourni d'adresse destinataire de test. Vérification SPF/DKIM/DMARC, livraison des alertes et DNS de production restent BLOQUÉS. Préparer les configurations et tests locaux ne nécessite aucun changement DNS.

## Référence d'exécution

Premier passage `node --test tests/*.test.mjs` de cette phase : 63/65 passent, les deux contrôles de séparation des bundles échouent car `dist/client/_next/static/chunks` n'existe pas avant compilation. Ils seront relancés après le build sans modifier les assertions. Les tests de chaque module et résultats finaux sont conservés dans `PRODUCTION_READINESS.md`.

La marge de 75 %, une livraison d'e-mail, un débit réel, un remboursement réel et une diffusion publicitaire ne sont jamais déduits des simulations locales.
