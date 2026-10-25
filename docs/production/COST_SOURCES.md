# Tarifs, marge et dépendances — relevé du 18 octobre 2026

Ce relevé est documentaire. Il ne configure aucune clé, ne lance aucune génération, ne remplace pas les contrats marchands et n'active aucune vente. Les tarifs publics ne constituent pas des factures réelles d'Braand. Les plafonds et prix Braand proviennent du catalogue interne `lib/billing-core.mjs`, version `2026-10-16.1` ; ce ne sont pas des quotas fournisseurs.

## Modèle conversationnel

Sources officielles consultées le **2026-10-18** : [Anthropic Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview), [OpenRouter Opus 5.5](https://openrouter.ai/anthropic/claude-opus-5.5/), [frais OpenRouter](https://openrouter.ai/pricing).

L'identifiant configuré par défaut existe : `anthropic/claude-opus-5.5` chez OpenRouter ; `claude-opus-5-5` en direct. Tarifs standard USD par million de tokens : entrée **4**, sortie **20**, écriture cache 5 minutes **5**, écriture cache 1 heure **8**, lecture cache **0,20**. Les variantes rapides et régionales ont des prix distincts ; ce relevé ne les autorise pas. Les frais d'achat de crédits OpenRouter sont **5,5 %** Standard ou **8 %** Business ; les taxes et conditions du compte doivent encore être rapprochées. Un taux USD/XAF, sa source, sa date et le coût de conversion réel restent nécessaires. Aucun taux de change n'a été inventé.

La documentation n'est pas une preuve d'appel réussi avec la clé du client. Le code exige un `*_RATE_JSON` correspondant au modèle, âgé de moins de 24 heures. Les coûts observés OpenRouter sont rapprochés via l'API génération ; une consommation inconnue conserve sa réservation. Pas d'appel payant exécuté pour ce relevé.

## Médias fal.ai

Sources officielles consultées le **2026-10-18** : [tarifs fal](https://fal.ai/pricing), [API de tarifs](https://fal.ai/docs/platform-apis/v1/models/pricing).

Exemples de tarifs publics USD, **candidats à évaluation et non modèles validés dans Braand** : `fal-ai/nano-banana-2` **0,08/image** ; `fal-ai/nano-banana` **0,0398/image** ; `fal-ai/z-image/turbo` **0,005/mégapixel** ; `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` **0,07/seconde** ; `minimax/h3-max/text-to-video` **0,05/seconde**. Les paramètres, la résolution et la durée peuvent modifier le coût final. Aucun de ces prix n'est une enveloppe universelle par requête.

L'API authentifiée `GET https://api.fal.ai/v1/models/pricing?endpoint_id=...` retourne unité, devise et tarif du compte. Elle est à relever pour chaque modèle et ensemble de paramètres réellement activé, puis à comparer aux événements de facturation. `FAL_CATALOG_JSON` reste vide tant que schéma, qualité et coût maximal ne sont pas validés. Aucun rendu réel effectué ici.

## Composio et Instant

Sources officielles consultées le **2026-10-18** : [tarifs plateforme](https://composio.dev/pricing), [Instant](https://docs.composio.dev/docs/instant-tools).

Le catalogue public distingue les appels avec sa propre application des applications OAuth gérées et des outils Instant. Pour une application propre, le niveau Hobby affiche **100 000 appels/mois**, puis le niveau Pro **0,0003 USD/appel** au-delà de l'inclus ; Pro affiche **29 USD/mois** avec crédit d'usage. Les applications gérées affichent une sous-allocation de **20 000 appels**, puis **0,0005 USD/appel**. Ce sont des règles globales du compte, pas une allocation garantie par utilisateur Braand. La recherche par méta-outils est annoncée gratuite ; l'exécution, les options et les déclencheurs nécessitent leur imputation réelle.

**Instant doit rester désactivé.** Ses prix dépendent de l'outil et ses descriptions ne garantissent pas un plafond machine. Une simple bannière « 1 500+ » n'est pas un forfait gratuit. Aucune dépense Instant ni activation payante n'a eu lieu durant cet audit.

## Paiements SasPay et publicité Meta

Sources officielles consultées le **2026-10-18** : [SasPay](https://www.saspay.me/), [checkout SasPay](https://docs.saspay.me/api-reference/payments/checkout-create), [Meta Reels et enchères](https://www.facebook.com/business/ads/facebook-instagram-reels-ads).

La page publique SasPay mentionne le Cameroun, MTN MoMo, Orange Money, un taux « dès **1,75 %** » et carte bancaire **5 %**. Le minimum affiché ne constitue pas le coût de chaque méthode ; il ne prouve pas l'activation du compte marchand. Les frais réellement déduits, de retrait, de conversion, les taxes, les remboursements et contestations doivent être confirmés dans le contrat/compte. Les frais inconnus bloquent la preuve de marge. Le checkout ne doit pas devenir une source de taux supposés.

La diffusion Meta est facturée selon le marché publicitaire et le compte de l'annonceur : aucun CPC/CPA fixe n'est inventé. Les dépenses publicitaires du client payées directement à Meta restent hors du revenu et du coût d'exécution Braand ; les appels Composio et le travail IA pour gérer ces campagnes restent des coûts Braand. L'accès à certaines pages d'aide Meta redirige vers la connexion : aucune affirmation de gratuité générale de la Marketing API n'est fondée sur ce relevé.

## Hébergement et notifications

Sources officielles consultées le **2026-10-18** : [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/), [Resend](https://resend.com/pricing?product=transactional).

Cloudflare direct, USD : Workers Paid minimum **5/mois** ; inclus **10 millions requêtes** et **30 millions ms CPU/mois**, dépassements **0,30/million requêtes** et **0,02/million ms CPU**. D1 Paid : **25 milliards lignes lues** et **50 millions écrites/mois**, puis **0,001/million lues**, **1/million écrites**, stockage au-delà de **5 Go : 0,75/Go-mois**. R2 Standard : **0,015/Go-mois**, opérations A **4,50/million**, B **0,36/million**, sortie réseau annoncée gratuite ; arrondis et autres services restent à intégrer. Ces prix directs ne sont pas automatiquement ceux d'un hébergeur revendeur.

Resend transactionnel, USD : Free **3 000 e-mails/mois**, plafond **100/jour** ; Pro **20/mois** pour **50 000 e-mails**, dépassement **0,90/1 000**. Le coût réel dépend du forfait choisi et du partage du quota. Ne pas déduire un coût nul durable du quota gratuit. Le domaine, le forfait du compte et la réception réelle d'un message test ne sont pas prouvés par cette page.

## Marge : preuve bloquée, sensibilité disponible

Formule : `(revenu reconnu HT net des remboursements - coûts variables attribuables) / revenu reconnu HT net des remboursements`. Un remboursement réduit déjà le revenu ; seuls les frais irrécupérables associés s'ajoutent aux coûts. Les coûts comprennent modèle, médias, connecteurs, infrastructure, e-mails, paiement, conversion/reversement, support et pertes. Les taxes, frais marchands réels, usages par mission, incidents et support sont encore inconnus : **aucune offre n'a une marge de 75 % prouvée**.

Le plafond interne de conception est **4 XAF/crédit** ; il n'est ni un tarif fournisseur, ni un coût observé. La simulation ci-dessous impose consommation intégrale, taux de carte public de 5 %, hypothèse fiscale de 0 % **pour sensibilité seulement**. Les montants sont le budget maximal restant pour **tous** les coûts variables non couverts, pour conserver 75 %, pas une marge réelle :

- Pro 30 jours : prix 9 900 XAF, 200 crédits → plafond d'exécution 800, paiement 495, budget restant **1 180 XAF**.
- Pro annuel : prix 99 000 XAF, 2 400 crédits → plafond 9 600, paiement 4 950, budget restant **10 200 XAF/an**.
- Business 30 jours : prix 29 900 XAF, 600 crédits → plafond 2 400, paiement 1 495, budget restant **3 580 XAF**.
- Business annuel : prix 299 000 XAF, 7 200 crédits → plafond 28 800, paiement 14 950, budget restant **31 000 XAF/an**.

La fiscalité peut réduire ce budget. Le moteur `lib/production-economics.mjs` distingue ce scénario d'une preuve : `assessMeasuredMargin` refuse les coûts manquants et les zéros sans justificatif. Il n'active aucune vente. Exécuter `node --test tests/production-economics.test.mjs` ; utiliser des montants réels reconnus et des références de factures/mesures pour conclure.

Avant validation économique : mesurer les parcours prévus, compter les sous-agents et reprises, relever les taux du compte, rapprocher les factures, tester les scénarios annuels à consommation intégrale. Si les coûts dépassent 25 % du revenu net, réduire le coût évitable, revoir le plafond d'usage ou proposer un nouveau prix avant une future vente ; aucun remplacement silencieux du modèle.
