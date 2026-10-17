# OpenRouter pour le cerveau d’Aïra

## Secrets de l’hébergement

La clé se configure sur le site Sites **Aïra — Studio de croissance**, dans ses variables d’environnement de production. Ajouter `OPENROUTER_API_KEY` en **secret**. Ne pas l’ajouter au code, à `.openai/hosting.json` ou à une variable préfixée `NEXT_PUBLIC_`.

Configuration du fournisseur :

```text
LLM_PROVIDER=openrouter
OPENROUTER_MODEL=anthropic/claude-opus-5.5
```

La clé et les paramètres de production sont distincts des fichiers locaux. Un déploiement est nécessaire pour appliquer une nouvelle révision des variables Sites. Le branchement conserve aussi l’accès direct Anthropic : `LLM_PROVIDER=anthropic` sélectionne exclusivement sa clé et son modèle. Aucune bascule automatique vers un autre modèle ou fournisseur n’est effectuée en cas d’erreur.

## Mesure et crédits

Renseigner également `OPENROUTER_RATE_JSON` côté serveur. Il contient :

- `model` : exactement `anthropic/claude-opus-5.5` ;
- `input`, `output`, `cacheWrite`, `cacheRead`, `cacheWriteHour` : prix USD par million de tokens ;
- `usdXaf` : taux de change prudent réellement validé pour l’entreprise ;
- `fundingFeeBps` : frais de financement/conversion à intégrer, en points de base, vérifiés sur le compte ;
- `overheadXaf` : coût variable direct supplémentaire par appel ;
- `verifiedAt` : date ISO de vérification, datant de moins de 24 heures.

Le catalogue OpenRouter consulté lors de cette intégration indique 4 USD / million en entrée, 20 en sortie, 0,20 pour la lecture de cache, 5 pour l’écriture de cache 5 minutes et 8 pour une heure. Vérifier les prix actifs avant configuration : le change, les frais de financement et l’infrastructure ne sont pas supposés gratuits. Ces valeurs ne constituent pas une configuration de production complète.

L’utilisateur doit disposer de crédits Aïra et autoriser l’enveloppe de sa demande. Ajouter une clé fournisseur n’attribue pas de crédits gratuits aux clients et n’active pas les encaissements.

## Streaming et outils

Le serveur appelle `https://openrouter.ai/api/v1/messages` avec authentification Bearer. Les messages, images, schémas d’outils et événements de streaming conservent le format Anthropic. Le maître et les spécialistes utilisent ce même branchement. Les clés ne sont renvoyées par aucune API cliente.

OpenRouter ne documente pas l’endpoint Anthropic `count_tokens`. L’application utilise une estimation conservatrice explicitement enregistrée pour la réservation, avec une réserve supplémentaire pour les images. Cette estimation ne constitue pas un décompte fournisseur exact. La facturation client reste plafonnée par la réservation acceptée.

Le serveur conserve `X-Generation-Id`, puis consulte `GET /api/v1/generation?id=…` pour connaître le coût de la génération. Le coût est converti avec le taux fixé pour la mission et les frais configurés. S’il n’est pas encore disponible, la consommation reste estimée ou inconnue : elle n’est pas présentée comme un coût réel confirmé. Le rapprochement est repris avant une nouvelle demande et par le traitement financier planifié, sans soumettre une deuxième génération.

## Vérification

`tests/openrouter.integration.mjs` couvre l’authentification, le modèle demandé, les flux de texte et d’outils, les coûts retardés, les erreurs et l’absence de double débit ou de secret dans les journaux. Les tests utilisent des réponses simulées. Un appel réel reste nécessaire après ajout du secret, des tarifs et des crédits de test autorisés.

Sources officielles : [Messages](https://openrouter.ai/docs/api/api-reference/anthropic-messages/create-messages?explorer=true), [streaming](https://openrouter.ai/docs/api_reference/streaming), [générations](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation), [catalogue](https://openrouter.ai/api/v1/models).
