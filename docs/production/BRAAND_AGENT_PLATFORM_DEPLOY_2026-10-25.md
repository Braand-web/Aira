# Plateforme agents Braand — livraison du 25 octobre 2026

## Version livrée

- Commit applicatif : `2cf36f9f9079ed788076843845d9905f5832a3d4`, poussé sur `main` et `feat/braand-agent-platform`.
- Production : `https://braand.fun`, version Worker `ad460fe4-fcd2-417f-a5d7-f5838a48be8e`.
- Staging privé : version `63267514-1ffb-4188-a1e7-6f6136b3bdd7`.
- Migration additive `0016_agent_platform.sql` appliquée aux deux bases. Un export privé de production a été conservé avant son application ; aucun export ni manifeste de secrets n’est ajouté à Git.
- Les ressources historiques en service sont conservées : cette livraison ne réalise pas la migration de données vers de nouveaux noms Cloudflare.

## Périmètre du code

Cette version ajoute les contrats de travaux persistants, événements et commandes ; les réservations d’outils et reçus ; les briefs progressifs ; les brouillons par espace ; la recherche documentée ; les méthodes sociales et de navigation ; les médias persistants et le contrat de rendu ; les lots sociaux, validations, programmation, commentaires et statistiques ; ainsi que les vues correspondantes dans Chat, Missions, Studio et les paramètres.

Le catalogue serveur contient 29 méthodes chargées progressivement. L’archive sociale fournie est référencée par empreinte, sans exécution de son script ni attribution d’une licence permissive absente. Les méthodes propriétaires documentaires exclues ne sont pas importées.

Les dernières évolutions de `main` concernant Braand, l’apparence, l’aide, les pièces jointes, le routage et les cycles de facturation ont été intégrées. Le composer conserve sa hauteur de repos de 58 px sur ordinateur. Sur mobile, Publications sélectionne la liste lorsque le calendrier est masqué.

## Vérifications effectuées

- TypeScript, ESLint sans avertissement et compilation de production réussis.
- 186 tests unitaires réussis et suites d’intégration réussies, dont 19 contrôles des services de la nouvelle plateforme sur SQLite migré.
- Contrôles HTTP locaux, fichiers signés, conservation et isolation réussis. Les transports externes des tests sont simulés ou interceptés ; ils ne constituent pas une recette fournisseur.
- Contrôles des bundles réussis : corpus privé, identifiants de configuration sensibles et SDK serveur absents du JavaScript client.
- Vérification visuelle de l’accueil, du composer et de Publications sur ordinateur et à 375 px ; sélection de Liste et absence de débordement horizontal constatées sur mobile.
- En production : santé HTTP 200, accueil et aide accessibles, article inconnu 404, anciennes URL de tarification redirigées vers les paramètres, nouvelles API et déclencheur interne refusés sans authentification.
- Bindings et variables existants comparés avant/après ; noms et types des secrets conservés. Route `braand.fun/*`, tâche historique toutes les cinq minutes, nouveau déclencheur à la minute et files distinctes de staging/production vérifiés.

## Activation et recette restant nécessaires

Cette livraison est une version protégée par des drapeaux. Elle ne constitue pas la validation complète de la définition de terminé du plan.

- Les travaux en arrière-plan et la recherche restent désactivés tant que leurs tests réels de reprise, consommation et rapprochement ne sont pas enregistrés.
- Les quatre réseaux et chaque action sociale restent désactivés. Les recettes Composio doivent être établies à partir des schémas et permissions réellement disponibles pour les comptes de test, puis les publications et réponses doivent être vérifiées individuellement.
- La persistance des générations et le montage payant restent désactivés. Le service FFmpeg est fourni dans le dépôt mais n’est pas hébergé par ce déploiement Worker ; un rendu et un téléchargement réels restent à tester.
- Le navigateur conserve ses drapeaux de fermeture existants. La recette de contrôle humain, expiration, isolation et facturation reste nécessaire avant activation.
- Les scénarios créatifs, la préférence humaine de 75 %, les essais avec cinq à huit utilisateurs francophones, la réussite UX de 80 % et les mesures comparatives de latence ne sont pas présentés comme accomplis. Les parcours complets de finition et de collaboration doivent encore être qualifiés avec ces essais.

Les comptes et plafonds de recette devront être explicitement prévus avant tout envoi social ou dépense externe. Aucune publication, génération payante, transaction ou campagne réelle n’a été exécutée dans cette livraison.

## Arrêt et retour arrière

Fermer d’abord le drapeau de la capacité concernée. Conserver les reçus, réservations et résultats incertains pour rapprochement. Un retour arrière du Worker laisse les tables additives en place ; il ne supprime pas les données utilisateur et ne peut pas annuler une publication externe déjà acceptée.
