# Actualisation des tarifs de l’assistant

Le 26 octobre 2026, le catalogue configuré le 24 octobre à 18:30 UTC avait dépassé sa validité de 24 heures. Le contrôle des coûts refusait donc les demandes avant leur génération. Un nouveau déploiement conservant les variables ne renouvelait pas ces tarifs.

Le Worker vérifie désormais les modèles configurés depuis `https://openrouter.ai/api/v1/models` et le cours vendeur USD/XAF daté publié par `https://www.beac.int/`. La date de valeur bancaire est distincte de la date de vérification ; une référence de plus de sept jours ou située dans le futur est refusée.

Une vérification réussie renouvelle les seuls tarifs des modèles déjà activés. Elle conserve les frais décidés par Braand et les limites configurées. Une limite peut être réduite si le fournisseur annonce un seuil de prix supérieur ou un contexte plus petit. Les modèles, outils et dépenses ne sont jamais activés automatiquement.

Le cache mémoire se renouvelle après six heures. Le même instantané est conservé dans le bucket privé, sous `internal/model-pricing/v1/`, avec une empreinte de la configuration. Il ne contient aucune clé API. Les requêtes authentifiées, les tâches planifiées et les consommateurs de tâches préparent ce cache avant leurs opérations. Les demandes simultanées partagent une actualisation. La reprise après un démarrage à froid lit d’abord le cache persistant.

Une panne des sources conserve uniquement un instantané encore valide, avec cinq minutes entre tentatives. Aucun échec ne prolonge sa date. La limite de 24 heures reste appliquée : des coûts non vérifiés bloquent toujours la génération plutôt que de permettre une dépense non maîtrisée.

Chaque appel garde son propre tarif dans `provider_usage.rate`. L’actualisation des appels futurs ne change ni les consommations antérieures, ni les reçus réels utilisés pour rapprocher et débiter les crédits.

`GET /api/health?check=assistant` déclenche la préparation et renvoie uniquement `assistantReady`, sans noms de fournisseurs, tarifs ou clés. Le contrôle de santé habituel conserve sa réponse existante. Les tests couvrent les week-ends, les seuils de contexte, les métadonnées incomplètes, la concurrence, les démarrages à froid, les changements de configuration, la panne des sources et l’expiration définitive d’un instantané.
