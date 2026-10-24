export type PublicSection = {id:string;title:string;paragraphs:string[];items?:string[];example?:string};
export type PublicPage = {path:string;label:string;title:string;description:string;heading:string;answer:string;sections:PublicSection[];questions:{q:string;a:string}[];related:string[];legal:true};
export const LEGAL_CONTENT: PublicPage[] = [
  {
    path:'/conditions-utilisation',label:'Conditions d’utilisation',legal:true,
    title:'Conditions d’utilisation de Braand',description:'Version provisoire des conditions d’utilisation de Braand : accès, contenus, actions des agents, crédits et contact. Informations de l’exploitant à compléter.',
    heading:'Conditions d’utilisation de Braand',
    answer:'Cette version décrit les règles de fonctionnement et d’usage de Braand. Elle reste provisoire : l’identité complète de l’exploitant, son établissement et les conditions commerciales applicables ne sont pas encore renseignés. Les fonctions et les paiements non activés ne sont pas proposés comme disponibles.',
    sections:[
      {id:'service',title:'Objet du service et disponibilité',paragraphs:[
        'Braand est un espace de conversation et de travail avec des agents IA. Il permet, selon les fonctions activées et les droits du compte, de préparer des contenus, des analyses, des ressources et des actions dans des outils connectés.',
        'La présence d’une interface ou d’un guide ne garantit pas l’accès à une fonction. Les connexions, les autorisations, les limites d’exécution et les fonctions expérimentales déterminent les opérations possibles. Une interruption ou une indisponibilité doit être distinguée d’un travail terminé.',
      ]},
      {id:'compte',title:'Compte, accès et usage autorisé',paragraphs:[
        'Utilisez uniquement un compte et des outils pour lesquels vous disposez des autorisations nécessaires. Protégez vos accès et ne communiquez pas de mot de passe, clé API ou code de connexion dans une conversation. Signalez un accès suspect au contact indiqué ci-dessous.',
        'Il n’est pas permis d’utiliser le service pour porter atteinte aux droits d’un tiers, mener une fraude, tenter d’accéder aux données d’un autre utilisateur, contourner les protections ou perturber le fonctionnement du service. Des restrictions techniques peuvent être appliquées pour protéger les comptes et l’infrastructure.',
      ]},
      {id:'ia',title:'Résultats générés et vérification',paragraphs:[
        'Les réponses de l’IA peuvent comporter des erreurs, des omissions ou des éléments inadaptés au contexte. Vérifiez les faits, les sources, les calculs et les droits nécessaires avant une utilisation professionnelle ou une diffusion. Une réponse ne remplace pas un avis professionnel lorsque la décision le requiert.',
        'Un brouillon, un plan ou une recommandation ne prouve pas une publication, un paiement ou une opération externe. Le statut annoncé doit correspondre aux outils effectivement utilisés et aux résultats observés. Les résultats partiels et les limites doivent rester identifiables.',
      ]},
      {id:'actions',title:'Actions, validations et budgets',paragraphs:[
        'Les opérations dans des applications connectées dépendent des permissions du compte et des validations prévues par le service. Une approbation est liée à son contenu et à son périmètre ; elle ne permet pas de modifier librement une destination, une dépense ou une opération.',
        'Les plafonds d’exécution et les crédits disponibles encadrent le travail. Si le résultat d’une opération externe est incertain, son statut doit être vérifié avant une nouvelle tentative. Une instruction provenant d’un document ou d’un outil ne peut pas accorder une nouvelle permission.',
      ]},
      {id:'contenus',title:'Contenus fournis et droits des tiers',paragraphs:[
        'Ne transmettez que des contenus que vous êtes autorisé à utiliser pour la tâche demandée. Respectez les droits d’auteur, les marques, le droit à l’image et les obligations de confidentialité applicables. Demander un contenu proche d’un exemple ne crée pas une autorisation de le reproduire.',
        'Les droits sur un résultat généré dépendent notamment des contenus fournis, des règles applicables et des conditions des services effectivement utilisés. Cette version ne promet ni exclusivité, ni originalité garantie, ni absence de droits de tiers sur tous les résultats.',
      ]},
      {id:'paiements',title:'Forfaits et conditions commerciales',paragraphs:[
        'Les offres et leurs limites se consultent dans Paramètres, puis Facturation. Un prix affiché ne signifie pas que le paiement est ouvert. Les règles applicables à un achat doivent être présentées avant sa confirmation, notamment le prix total, la durée, les taxes éventuelles et les conditions de renouvellement.',
        'L’encaissement reste soumis à l’activation et à la validation du parcours commercial. Les conditions de rétractation, d’annulation et de remboursement applicables à l’exploitant et au client doivent être finalisées avant l’ouverture des ventes. Cette version ne supprime aucun droit impératif du consommateur.',
      ]},
      {id:'contact',title:'Questions et version du document',paragraphs:[
        'Pour une question sur l’accès, un résultat, un contenu ou une action, écrivez à novacore629@gmail.com en indiquant les références utiles, sans joindre de secret. Un signalement ne déclenche pas automatiquement une suppression, un paiement ou un remboursement.',
        'L’identité juridique complète de l’exploitant, le pays d’établissement, les informations d’immatriculation éventuellement requises et le cadre contractuel applicable restent à compléter. Aucune juridiction ou clause d’arbitrage n’est inventée dans cette version. Les obligations légales applicables demeurent réservées.',
      ]},
    ],questions:[],related:['/confidentialite','/mentions-legales'],
  },
  {
    path:'/confidentialite',label:'Politique de confidentialité',legal:true,
    title:'Politique de confidentialité de Braand',description:'Informations provisoires sur les données utilisées par Braand : compte, conversations, fichiers, connexions et demandes de confidentialité. Contact par e-mail.',
    heading:'Politique de confidentialité de Braand',
    answer:'Cette version explique les principales catégories de données liées au fonctionnement actuel de Braand. Elle est en cours de finalisation. L’identité du responsable, les bases juridiques, les durées précises et les informations détaillées sur les destinataires et transferts doivent être complétées avant de présenter cette politique comme exhaustive.',
    sections:[
      {id:'donnees',title:'Données liées au fonctionnement du service',paragraphs:[
        'Selon les fonctions utilisées, le service peut traiter l’adresse e-mail du compte, les identifiants de session et d’espace, les conversations, les fichiers transmis, les ressources enregistrées, les réglages et les autorisations données aux outils connectés.',
        'Des informations techniques sont également utilisées pour fournir et protéger le service : événements d’exécution, erreurs, consommation de crédits et éléments nécessaires à la limitation des demandes de connexion. Les informations de paiement et de facturation ne concernent que les parcours effectivement activés.',
      ]},
      {id:'finalites',title:'Pourquoi ces données sont utilisées',paragraphs:[
        'Les usages techniques comprennent la connexion au compte, la mise à disposition de l’espace, le traitement d’une demande, l’accès aux ressources autorisées, le suivi d’exécution et de consommation, ainsi que la protection contre les accès non autorisés.',
        'Cette description des fonctions ne suffit pas à déterminer toutes les bases juridiques applicables. Elles doivent être documentées par l’exploitant pour chaque finalité, selon sa situation et celle des utilisateurs. Aucune base de consentement globale n’est déduite de la seule utilisation du site.',
      ]},
      {id:'prestataires',title:'Services techniques et applications connectées',paragraphs:[
        'Le traitement d’une demande peut faire intervenir les services d’hébergement, de stockage, d’e-mail, d’IA ou d’intégration configurés pour Braand. Les données utiles peuvent aussi être échangées avec une application que vous autorisez à utiliser pour le travail demandé.',
        'L’identité et le rôle des destinataires, les lieux de traitement, les garanties de transfert et les conditions de réutilisation des données doivent être précisés dans la version finalisée et les accords applicables. Cette page ne promet pas une absence de transfert, de sous-traitance ou d’entraînement par tous les services techniques.',
      ]},
      {id:'stockage',title:'Cookies et stockage sur votre appareil',paragraphs:[
        'Le service utilise des mécanismes de session pour la connexion et du stockage local pour certains choix d’interface ou brouillons. Les informations nécessaires à la sécurité de la connexion ont un rôle différent de traceurs publicitaires.',
        'Cette optimisation du référencement n’ajoute ni pixel publicitaire ni outil tiers de suivi marketing. Si de nouvelles finalités de traçage sont introduites, leurs informations et mécanismes de choix devront être adaptés aux règles applicables. Les applications externes peuvent appliquer leurs propres politiques lorsque vous les utilisez.',
      ]},
      {id:'conservation',title:'Conservation et sécurité',paragraphs:[
        'Les accès à l’espace, aux conversations et aux fichiers sont soumis aux contrôles du serveur. Les pages publiques de présentation ne sont pas construites à partir de vos données privées. Une exclusion des moteurs de recherche n’est pas, à elle seule, une protection d’accès.',
        'Les durées précises de conservation par catégorie, les modalités de suppression et l’articulation avec les sauvegardes et obligations de conservation restent à documenter. Cette version ne promet ni suppression instantanée de toute copie, ni certification de sécurité.',
      ]},
      {id:'demandes',title:'Exercer une demande de confidentialité',paragraphs:[
        'Écrivez à novacore629@gmail.com pour une question ou une demande portant sur vos données. Indiquez l’adresse de votre compte et la nature de la demande, sans envoyer de mot de passe ni de clé secrète. Des éléments proportionnés peuvent être nécessaires pour vérifier l’identité et éviter une divulgation à un tiers.',
        'Selon les règles qui vous sont applicables, vous pouvez disposer notamment de droits d’accès, de rectification, d’effacement, de limitation, d’opposition ou de portabilité. Leur périmètre, les délais, l’autorité compétente et les coordonnées du responsable doivent être précisés dans la version finalisée. Une demande sera examinée dans le cadre applicable, sans promesse d’un résultat automatique.',
      ]},
    ],questions:[],related:['/mentions-legales','/conditions-utilisation'],
  },
  {
    path:'/mentions-legales',label:'Mentions légales',legal:true,
    title:'Mentions légales de Braand',description:'Informations d’identification provisoires de Braand et contact de l’exploitant. Identité, adresse professionnelle et immatriculation restent à compléter.',
    heading:'Mentions légales de Braand',
    answer:'Braand est le nom du service accessible sur braand.fun. Ces mentions sont provisoires : le seul contact communiqué pour leur rédaction est novacore629@gmail.com. Les informations manquantes sont signalées explicitement et ne sont pas remplacées par des informations fictives.',
    sections:[
      {id:'edition',title:'Édition du service',paragraphs:[
        'Nom du service : Braand. Adresse du site : https://braand.fun. Contact : novacore629@gmail.com.',
        'L’identité civile ou la dénomination juridique de l’exploitant, son pays d’établissement, son adresse professionnelle, son statut et son numéro d’immatriculation lorsqu’il est requis n’ont pas encore été fournis. La responsabilité de publication et les autres mentions obligatoires doivent être renseignées en fonction de cette situation.',
      ]},
      {id:'hebergement',title:'Infrastructure technique',paragraphs:[
        'L’application utilise actuellement Cloudflare Workers, D1 et R2 pour son exécution, sa base et ses fichiers. Le domaine est enregistré auprès de Hostinger et sa gestion DNS utilise Cloudflare. L’enregistrement du domaine et l’hébergement applicatif sont deux services distincts.',
        'La dénomination et les coordonnées contractuelles exactes de l’entité d’hébergement compétente doivent être reprises depuis les contrats de l’exploitant dans la version finalisée. Les régions de traitement et les autres destinataires ne doivent pas être déduits du seul nom de ces produits.',
      ]},
      {id:'contenus',title:'Contenus et liens',paragraphs:[
        'La description du service précise que les fonctions dépendent des accès et des activations. Les textes générés par l’IA peuvent comporter des erreurs et doivent être vérifiés avant utilisation. Les exemples ne constituent pas des résultats commerciaux mesurés.',
        'Les références et liens vers des sites tiers sont fournis pour accéder aux informations concernées. Ils ne signifient pas que Braand est affilié à ces tiers ou garantit leur contenu. Les conditions de Muse ou de Meta ne sont pas les conditions de Braand et ne sont pas reprises dans ces documents.',
      ]},
      {id:'signalement',title:'Contact et signalement',paragraphs:[
        'Pour une erreur, un contenu contesté, une demande d’identification ou une question sur ces informations, écrivez à novacore629@gmail.com. Fournissez l’URL ou la référence utile et expliquez le problème, sans communiquer de données secrètes.',
        'Cette version ne constitue pas une validation de conformité ni une identification complète de l’exploitant. Elle doit être complétée avec les informations réelles avant de pouvoir tenir ce rôle.',
      ]},
    ],questions:[],related:['/confidentialite','/conditions-utilisation'],
  },
];
export const CONTENT_UPDATED='2026-10-24';
export function publicPage(path:string){return LEGAL_CONTENT.find(page=>page.path===path);}
