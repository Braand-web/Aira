# Questions de cadrage dans le chat

Aïra peut proposer une carte lorsqu’il manque des précisions pour préparer un livrable. Le modèle choisit les questions avec `ask_brief_questions` ; les conversations ordinaires et les demandes déjà précises restent conversationnelles.

La carte affiche une question à la fois. Un choix simple avance à la question suivante, sauf à la dernière question. Les choix multiples et le texte libre attendent une action explicite. Précédent, suivant, passer, fermer, reprendre et recommencer conservent le contrôle de l’utilisateur. Le bouton final « Utiliser ces réponses » ajoute un texte relisible au brouillon existant et lui rend le focus ; il conserve les pièces jointes. L’utilisateur envoie lui-même sa demande.

## Protocole et confidentialité

- Un schéma commun borne le titre, les identifiants, les questions, les choix et le texte libre. Les textes restent échappés dans React.
- Le questionnaire est enregistré dans les messages existants, sans nouvelle table ni migration. L’historique authentifié reconstruit seulement les appels avec un résultat réussi et correspondant, dans le même espace et la même conversation. Les blocs internes d’outil ne sont pas exposés par l’API de lecture.
- Le serveur persiste atomiquement l’appel et ses résultats avant l’émission de la carte. Si un lot contient aussi d’autres outils, ils sont tous suspendus avant leur exécution. Les budgets et les traces d’audit restent applicables.
- Les réponses non utilisées restent dans l’état local de la carte. Après rechargement, les questions sont restaurées ; les choix en cours sont à refaire. Le brouillon préparé suit la conservation habituelle du compositeur.
- Les réponses précisent une demande. Elles n’autorisent aucune génération, publication, dépense ou ouverture d’accès. Les validations existantes restent nécessaires.

## Accessibilité et limites

Les choix utilisent des contrôles natifs avec légende, les cibles tactiles mesurent au moins 44 px et le compteur est annoncé en français. Le focus suit la question active, revient à la reprise et rejoint le compositeur après préparation du brouillon. `prefers-reduced-motion` désactive les transitions et le compteur animé.

Les valeurs sont centralisées dans `lib/brief-questions.ts` : 1 à 5 questions, 2 à 8 choix distincts par question, titre de 160 caractères, question de 240 caractères, choix de 120 caractères, réponse libre de 1 000 caractères et texte préparé de 12 000 caractères au maximum. Aucune dépendance ajoutée.

## Vérification manuelle

1. Demander une création dont le public ou le format manque. Vérifier que la carte proposée par l’agent apparaît dans sa réponse. Elle n’est pas systématique.
2. Répondre par choix simple, choix multiples et texte libre ; revenir en arrière, masquer puis reprendre. Vérifier les valeurs conservées.
3. Sur la dernière question, sélectionner un choix : aucune demande ne doit partir. Utiliser le bouton final et vérifier le brouillon, son texte précédent et les pièces jointes.
4. Recharger la discussion : retrouver les questions dans l’historique, sans exposer de bloc d’outil. Tester clavier, mobile et réduction des animations.

## Description de PR

Ajoute des questions de cadrage structurées dans le chat lorsqu’Aïra manque de précisions. La carte française présente une question à la fois et prépare un brouillon relisible, sans envoyer de demande ni autoriser d’action. Les cartes sont restaurées depuis l’historique authentifié ; le serveur suspend les autres outils d’un lot contenant des questions.

Validation : schémas et formatage, pause atomique et protocole en SQLite, hydratation par l’API réelle, parcours navigateur sur ordinateur et mobile, préservation du brouillon et des pièces jointes, clavier, réduction du mouvement et textes échappés. Les fournisseurs externes sont simulés dans les tests.
