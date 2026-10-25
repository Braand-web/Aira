// Fictional, local preview records. This module never connects to a hosted database.
import { createHash } from "node:crypto";

const DAY = 86_400_000;
export const DEMO_WORKSPACE_ID = "braand_local_preview";
export const DEMO_BRAND = "Maison Naya";
export const DEMO_SEED_VERSION = "maison-naya-1";

export const DEMO_ASSETS = Object.freeze([
  "cacao", "cafe", "hibiscus", "collection", "story", "packaging",
]);

export const DEMO_FILES = Object.freeze([
  {
    id: "demo-file-brand", name: "brief-marque.md", mime: "text/markdown",
    storageKey: "braand_local_preview/demo/files/brief-marque.md",
    content: "# Maison Naya — brief de marque\n\nDOCUMENT FICTIF · DÉMONSTRATION BRAAND\n\n## Notre idée\nDes saveurs simples et des moments de partage : cacao, café et hibiscus. Maison Naya est une marque imaginaire utilisée pour présenter votre espace de travail.\n\n## Notre voix\nChaleureuse, concrète et accueillante. Parler des gestes, des saveurs et des petites attentions. Éviter les promesses de santé, les urgences inventées et les faux témoignages.\n\n## Notre offre\nCollection Origines : trois saveurs, trois rituels. Coffret Découverte : exemple fictif à 18 000 FCFA.\n\n## Avant toute publication réelle\nConfirmer les caractéristiques des produits, les prix, le stock, les modalités de livraison et les droits des visuels. Aucun élément de ce document ne prouve leur disponibilité.\n",
  },
  {
    id: "demo-file-calendar", name: "calendrier-editorial.csv", mime: "text/csv",
    storageKey: "braand_local_preview/demo/files/calendrier-editorial.csv",
    content: "semaine;jour;canal;theme;format;statut\nDémonstration;Lundi;Instagram;Le rituel du matin;Visuel café;Brouillon fictif\nDémonstration;Mercredi;Instagram;Trois gestes pour son cacao;Carrousel;Brouillon fictif\nDémonstration;Vendredi;Facebook;Coffret Découverte;Visuel collection;Brouillon fictif\nDémonstration;Dimanche;Instagram;Quelle est votre saveur ?;Story;Brouillon fictif\nDémonstration;Mardi;Email;Bienvenue chez Maison Naya;Email de bienvenue;Aucun envoi\n",
  },
  {
    id: "demo-file-catalog", name: "catalogue-produits.txt", mime: "text/plain",
    storageKey: "braand_local_preview/demo/files/catalogue-produits.txt",
    content: "MAISON NAYA · CATALOGUE DE DÉMONSTRATION\n\nTous les produits, prix et références ci-dessous sont fictifs.\n\nORIGINES CACAO\nUne pause douce et généreuse. Référence de démonstration : NY-CA-01.\n\nORIGINES CAFÉ\nPour les matins tranquilles. Référence de démonstration : NY-CF-01.\n\nORIGINES HIBISCUS\nUne parenthèse fraîche à partager. Référence de démonstration : NY-HI-01.\n\nCOFFRET DÉCOUVERTE\nLes trois saveurs réunies et une carte à personnaliser. Prix illustratif : 18 000 FCFA.\n\nDisponibilités, quantités, ingrédients, conditions de conservation et livraisons : à confirmer avant tout usage commercial. Aucun achat n’est possible dans cette démonstration.\n",
  },
].map(file => Object.freeze({ ...file, size: Buffer.byteLength(file.content, "utf8"), sha256: createHash("sha256").update(file.content, "utf8").digest("hex") })));

/** Seed only a fresh SQLite database, or this exact marked demo database. */
export function seedDemo(sql, { now = Date.now() } = {}) {
  if (!Number.isSafeInteger(now) || now <= 0) throw new Error("Invalid demo seed date.");
  const markerExists = sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_braand_demo_seed'").get();
  const prior = markerExists ? sql.prepare("SELECT version,created_at FROM _braand_demo_seed WHERE id='local-demo'").get() : undefined;
  if (prior && prior.version !== DEMO_SEED_VERSION) throw new Error("This database belongs to another demo seed version.");
  if (!prior) {
    for (const table of ["organizations", "workspaces", "resources", "messages", "credit_lots"]) {
      if (sql.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count > 0) {
        throw new Error("Demo seed refused: use a new, dedicated local database.");
      }
    }
  }
  const anchor = prior?.created_at ?? now;
  const time = (days = 0, minutes = 0) => anchor - days * DAY + minutes * 60_000;
  const workspace = DEMO_WORKSPACE_ID;
  const run = (query, ...values) => sql.prepare(query).run(...values);
  const metadata = { fictional: true, brand: DEMO_BRAND, seed: DEMO_SEED_VERSION };
  const resource = (id, kind, title, data, status = "saved", days = 0, version = 1) => {
    run("INSERT OR IGNORE INTO resources (id,workspace_id,kind,title,data,status,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      id, workspace, kind, title, JSON.stringify({ ...data, demo: metadata }), status, version, time(days), time(days));
    return id;
  };

  sql.exec("BEGIN IMMEDIATE");
  try {
    sql.exec("CREATE TABLE IF NOT EXISTS _braand_demo_seed (id TEXT PRIMARY KEY, version TEXT NOT NULL, created_at INTEGER NOT NULL)");
    run("INSERT OR IGNORE INTO _braand_demo_seed VALUES ('local-demo',?,?)", DEMO_SEED_VERSION, anchor);
    run("INSERT OR IGNORE INTO organizations(id,name,owner_id,created_at) VALUES (?,?,?,?)", workspace, "Maison Naya · Démonstration", workspace, time(8));
    run("INSERT OR IGNORE INTO workspaces(id,name,organization_id,created_at) VALUES (?,?,?,?)", workspace, "Maison Naya", workspace, time(8));
    run("INSERT OR IGNORE INTO organization_members(organization_id,user_id,role) VALUES (?,?,'owner')", workspace, workspace);
    run("INSERT OR IGNORE INTO members(id,workspace_id,user_id,role) VALUES (?,?,?,'owner')", "demo-membership-owner", workspace, workspace);
    for (const [id, role] of [["leila@maison-naya.test", "editor"], ["marc@maison-naya.test", "approver"]]) {
      run("INSERT OR IGNORE INTO organization_members(organization_id,user_id,role) VALUES (?,?,?)", workspace, id, role);
      run("INSERT OR IGNORE INTO members(id,workspace_id,user_id,role) VALUES (?,?,?,?)", "demo-membership-" + role, workspace, id, role);
    }

    // Install Business rights before inserting more than the free plan's two projects.
    // This is a demo entitlement, with no order, invoice, checkout or provider receipt.
    run("INSERT OR IGNORE INTO billing_subscriptions(id,organization_id,plan,cycle,start_at,end_at,status,order_id,catalog_plan,credit_allowance,catalog_version,contract_price) VALUES (?,?,'business','period',?,?,'active',?,'business',600,'2026-10-22.1',24900)",
      "demo-subscription-business", workspace, time(8), time(-22), "demo-entitlement-only");
    const lotId = "allocation:demo-subscription-business:0";
    run("INSERT OR IGNORE INTO credit_lots(id,organization_id,source,source_id,granted,balance,starts_at,expires_at,created_at) VALUES (?,?,'subscription',?,60000,60000,?,?,?)",
      lotId, workspace, "demo-entitlement-only", time(8), time(-22), time(8));
    // Normal reserve/settlement triggers produce a coherent ledger and a 438.50 balance.
    const usage = [
      ["Stratégie de lancement", 1200, 6], ["Visuels de la collection", 2250, 5],
      ["Page Coffret Découverte", 1800, 4], ["Déclinaisons Instagram", 3400, 3],
      ["Plan de campagne", 1500, 2], ["Séquence de bienvenue", 2600, 1],
      ["Bilan et recommandations", 3400, 0],
    ];
    for (const [index, [label, units, days]] of usage.entries()) {
      const id = "demo-consumption-" + (index + 1), reference = "Démonstration · " + label;
      run("INSERT OR IGNORE INTO credit_holds(id,organization_id,workspace_id,actor,reference,units,created_at) VALUES (?,?,?,?,?,?,?)", id, workspace, workspace, workspace, reference, units, time(days));
      run("INSERT OR IGNORE INTO credit_allocations(id,hold_id,lot_id,units,created_at) VALUES (?,?,?,?,?)", id, id, lotId, units, time(days));
      run("UPDATE credit_allocations SET state='settled',charged=? WHERE id=? AND state='reserved'", units, id);
      run("UPDATE credit_holds SET status='settled',actual=? WHERE id=? AND status='reserved'", units, id);
    }
    run("INSERT OR IGNORE INTO billing_notifications(id,organization_id,kind,message,created_at) VALUES (?,?,'demo',?,?)", "demo-billing-notice", workspace, "Données fictives : le forfait et les crédits servent uniquement à prévisualiser Braand. Aucun paiement n’a été effectué.", time(0));

    const projects = [
      ["demo-project-collection", "Collection Origines", "Lancement d’une collection de cacao, café et infusion d’hibiscus. Une identité chaleureuse, trois produits et une histoire commune.", "Finaliser les visuels, la page de vente et le plan de lancement de la collection.", 6],
      ["demo-project-coffret", "Coffret Découverte", "Un coffret de trois saveurs à offrir ou à partager. Offre fictive à 18 000 FCFA, avec une carte personnalisée.", "Préparer une offre claire et recueillir les premières demandes d’information.", 4],
      ["demo-project-fetes", "Les fêtes chez Naya", "Préparation éditoriale de fin d’année : cadeaux, moments de partage et petites attentions.", "Décliner les contenus de saison pour Instagram, Facebook et les emails.", 2],
    ];
    for (const [id, title, description, objective, days] of projects) resource(id, "project", title, { description, objective }, "saved", days);

    const discussions = [
      { id: "demo-chat-launch", title: "Le lancement de Collection Origines", days: 0, turns: [
        ["user", "Préparons le lancement de Collection Origines. Je veux présenter nos trois saveurs sans donner l’impression d’une publicité trop insistante."],
        ["assistant", "Commençons par ce que vos clients vont découvrir : trois saveurs, trois moments de la journée.\n\n1. Le cacao pour une pause réconfortante.\n2. Le café pour les matins qui démarrent doucement.\n3. L’hibiscus pour une parenthèse fraîche à partager.\n\nJe vous propose une semaine de découverte : une histoire de marque, trois portraits de produits, puis une présentation du coffret. Les visuels de démonstration sont enregistrés dans le Studio."],
        ["user", "J’aime cette direction. Quelle accroche utiliser pour le coffret ?"],
        ["assistant", "**Trois saveurs. Une attention qui reste.**\n\nDécouvrez le Coffret Maison Naya : cacao, café et hibiscus réunis pour offrir un moment à soi.\n\nPour la page de vente, gardons un seul appel à l’action : « Découvrir le coffret ». Le prix et les modalités seront à confirmer avant toute publication.\n\nCet échange et les produits présentés sont fictifs, pour explorer votre espace Braand."],
      ] },
      { id: "demo-chat-social", title: "Une semaine de contenus Instagram", days: 1, turns: [
        ["user", "Peux-tu proposer une semaine de contenus Instagram autour du rituel du matin ?"],
        ["assistant", "Voici une première trame éditoriale, à adapter à vos photos :\n\n- **Lundi :** une tasse de café, une lumière douce, la question « Comment commence votre matin ? ».\n- **Mercredi :** trois gestes pour préparer son cacao préféré.\n- **Vendredi :** une courte présentation du Coffret Découverte.\n- **Dimanche :** une story où votre communauté choisit sa saveur.\n\nChaque publication raconte une scène concrète. Les déclinaisons restent des brouillons : aucune publication n’a été envoyée."],
      ] },
      { id: "demo-chat-page", title: "La page du Coffret Découverte", days: 2, turns: [
        ["user", "Je veux une page courte pour présenter le Coffret Découverte à 18 000 FCFA."],
        ["assistant", "La page est organisée autour d’une promesse simple : offrir trois moments de découverte.\n\nElle présente les saveurs, le contenu du coffret et les réponses aux questions fréquentes. Le bouton final invite à demander des informations, sans inventer de stock ou de délai de livraison.\n\nVous pouvez ouvrir « Coffret Découverte — page de vente » dans le Studio pour consulter l’aperçu ordinateur ou téléphone. Le prix est un exemple fictif."],
      ] },
      { id: "demo-chat-emails", title: "Les emails de bienvenue Maison Naya", days: 3, turns: [
        ["user", "Écrivons une séquence de bienvenue simple pour nos nouveaux inscrits."],
        ["assistant", "Je propose trois emails :\n\n1. **Bienvenue chez Maison Naya** — notre histoire et une invitation à choisir sa saveur.\n2. **Votre première pause Naya** — une idée de préparation facile et les réponses aux premières questions.\n3. **À partager, ou à garder pour soi** — le Coffret Découverte, présenté sans pression.\n\nChaque email a un seul objectif. Nous conservons un lien de désinscription et nous attendons une liste de contacts consentants avant tout envoi. Aucun email n’a été envoyé dans cette démonstration."],
      ] },
      { id: "demo-chat-strategy", title: "Nos priorités de croissance ce mois-ci", days: 5, turns: [
        ["user", "Nous avons beaucoup d’idées. Comment choisir ce qui compte ce mois-ci ?"],
        ["assistant", "Pour cette entreprise fictive, je concentrerais les efforts sur une seule offre : le Coffret Découverte.\n\n**Priorité :** rendre la proposition et le prochain geste faciles à comprendre.\n\n**Canal principal :** Instagram, avec les visuels déjà disponibles.\n\n**Test de deux semaines :** comparer deux accroches sur un petit volume, en gardant le même produit et la même destination.\n\nNous suivrons les demandes qualifiées, avec leur source et leur période, plutôt que les clics seuls. Le plan de campagne est enregistré pour relecture ; il n’engage aucune dépense."],
      ] },
    ];
    for (const chat of discussions) {
      resource(chat.id, "conversation", chat.title, { description: "Discussion de démonstration Maison Naya." }, "saved", chat.days);
      for (const [index, [role, text]] of chat.turns.entries()) {
        const runId = role === "assistant" ? `${chat.id}-run-${index}` : null;
        if (runId) run("INSERT OR IGNORE INTO runs(id,workspace_id,conversation_id,status,created_at,updated_at) VALUES (?,?,?,'completed',?,?)", runId, workspace, chat.id, time(chat.days, index), time(chat.days, index));
        run("INSERT OR IGNORE INTO messages(id,workspace_id,conversation_id,role,content,created_at,attachments,run_id) VALUES (?,?,?,?,?,?,'[]',?)", `${chat.id}-message-${index}`, workspace, chat.id, role, JSON.stringify([{ type: "text", text }]), time(chat.days, index), runId);
      }
    }

    const media = [
      ["cacao", "Cacao doux — visuel de collection", 5], ["cafe", "Café des matins tranquilles", 5],
      ["hibiscus", "Hibiscus — une pause colorée", 4], ["collection", "Collection Origines — le trio", 3],
      ["story", "Le rituel du matin — story", 2], ["packaging", "Coffret Découverte — packaging", 1],
    ];
    for (const [asset, title, days] of media) resource("demo-media-" + asset, "media", title, {
      description: "Visuel fictif Maison Naya, créé pour la démonstration.",
      output: { images: [{ url: `/demo-assets/${asset}.svg`, width: 1200, height: 900 }] },
    }, "ready", days);

    const page = (title, description, heading, body, items, accent) => ({
      title, description, accent,
      sections: [
        { type: "hero", heading, body },
        { type: "benefits", heading: "De belles choses, simplement", body: "Une sélection imaginée pour les petits moments qui comptent.", items },
        { type: "faq", heading: "Avant de découvrir", body: "Cette page est un exemple fictif. Les prix, stocks, livraisons et modalités sont à confirmer avant toute mise en ligne.", items: ["Les produits et cette marque sont fictifs.", "Aucune commande ni donnée de contact n’est transmise."] },
        { type: "cta", heading: "Votre prochaine pause commence ici", body: "Découvrez la collection et choisissez votre moment." },
      ],
      cta: { label: "Découvrir Maison Naya", url: "https://maison-naya.example/decouverte" }, noindex: true,
    });
    resource("demo-page-coffret", "page", "Coffret Découverte — page de vente", { current: page("Coffret Découverte Maison Naya", "Trois saveurs réunies dans un coffret fictif à 18 000 FCFA.", "Trois saveurs. Une attention qui reste.", "Cacao, café et hibiscus : trois moments de découverte à offrir ou à partager. Coffret de démonstration · 18 000 FCFA.", ["Trois saveurs à découvrir", "Une carte pour votre message", "Un format à offrir ou à partager"], "#9b6945") }, "draft", 4, 2);
    resource("demo-page-origines", "page", "Collection Origines — présentation", { current: page("Collection Origines — Maison Naya", "Un univers de saveurs et de petits rituels, imaginé pour cette démonstration.", "Prenez le temps du goût.", "Du premier café à l’infusion partagée, Collection Origines célèbre les pauses que l’on choisit.", ["Cacao doux et généreux", "Café pour les matins tranquilles", "Hibiscus frais et coloré"], "#426c59") }, "draft", 3);

    for (const [id, title, objective, dailyBudget, message, days] of [
      ["demo-campaign-coffret", "Coffret Découverte · demandes qualifiées", "Recueillir des demandes d’information sur le coffret.", 2500, "Trois saveurs. Une attention qui reste. Découvrez le Coffret Maison Naya.", 3],
      ["demo-campaign-origines", "Collection Origines · faire découvrir", "Présenter les trois saveurs à une nouvelle audience.", 1500, "Votre matin a sa saveur. Café, cacao ou hibiscus : quel sera votre premier rituel ?", 2],
      ["demo-campaign-fetes", "Petites attentions · sélection de fin d’année", "Tester l’intérêt pour une sélection cadeau de saison.", 2000, "Une petite attention, trois façons de faire plaisir. Préparons vos moments à partager.", 1],
    ]) {
      const preparation = id === 'demo-campaign-coffret' ? {offer:'Coffret fictif de trois saveurs à 18 000 FCFA, avec une carte personnalisée.',audience:'Exemple : personnes à Douala souhaitant offrir un coffret de découverte.',creativeIds:['demo-media-packaging','demo-media-collection'],pageId:'demo-page-coffret'} : id === 'demo-campaign-origines' ? {offer:'Découverte de la collection de cacao, café et hibiscus Maison Naya.',audience:'Exemple : amateurs de nouvelles saveurs à Douala, à confirmer.',creativeIds:['demo-media-cacao','demo-media-cafe','demo-media-hibiscus'],pageId:'demo-page-origines'} : {offer:'Sélection cadeau de fin d’année, conditions et disponibilité à confirmer.'};
      resource(id, "campaign", title, { objective, country: "Cameroun · exemple", currency: "FCFA", dailyBudget, destination: "Page de démonstration Maison Naya", tracking: "Simulation uniquement · aucune publicité diffusée", message, ...preparation, preparationDemoVersion:1 }, "draft", days);
      // Enrich only this explicitly marked, read-only fictional preview, once.
      const stored=sql.prepare("SELECT data FROM resources WHERE id=? AND workspace_id=? AND kind='campaign'").get(id,workspace);
      const current=JSON.parse(stored.data);
      if(current.demo?.seed===DEMO_SEED_VERSION&&current.preparationDemoVersion!==1)run("UPDATE resources SET data=? WHERE id=? AND workspace_id=?",JSON.stringify({...preparation,...current,preparationDemoVersion:1}),id,workspace);
    }

    for (const [id, title, objective, steps, successCriteria, days] of [
      ["demo-mission-launch", "Préparer le lancement Collection Origines", "Assembler un lancement cohérent, de l’offre au contenu.", ["Clarifier la promesse et les trois saveurs", "Relire les visuels et la page de vente", "Préparer le calendrier de lancement"], ["Une promesse compréhensible en une phrase", "Une page et trois contenus relus avant toute publication"], 4],
      ["demo-mission-repurpose", "Décliner les visuels pour les réseaux", "Préparer les formats Instagram et Facebook à partir de la collection.", ["Sélectionner les visuels du Studio", "Rédiger une version par plateforme", "Lister les adaptations à valider"], ["Les formats et textes sont identifiés", "Aucun contenu publié automatiquement"], 2],
      ["demo-mission-growth", "Analyser les résultats de démonstration", "Construire une lecture simple des performances fictives.", ["Vérifier les définitions des indicateurs", "Comparer les trois campagnes", "Proposer une prochaine expérience"], ["Les données restent signalées comme fictives", "Les clics ne sont pas présentés comme des ventes"], 1],
    ]) resource(id, "mission", title, { objective, steps, successCriteria, maxCredits: 25, stopConditions: ["Données manquantes", "Validation humaine nécessaire"], mode: "accompanied" }, "saved", days);

    resource("demo-knowledge-brand", "knowledge", "Maison Naya — notre univers", { content: "Maison Naya est une marque entièrement fictive créée pour explorer Braand. Son univers associe cacao, café et hibiscus, des couleurs naturelles et des moments de partage.\n\nTon : chaleureux, simple et concret. Éviter les promesses de santé, les faux témoignages et les urgences inventées.\n\nMarché de démonstration : Cameroun. Devise d’exemple : FCFA. Le Coffret Découverte est affiché à 18 000 FCFA à titre illustratif. Tous les stocks, prix et modalités doivent être validés avant un usage réel." }, "saved", 6);
    resource("demo-knowledge-offer", "knowledge", "Offre et messages de la collection", { content: "Collection Origines : trois saveurs, trois rituels.\n\nCacao : la pause réconfortante. Café : les matins tranquilles. Hibiscus : la parenthèse fraîche à partager.\n\nAccroche retenue pour le coffret : Trois saveurs. Une attention qui reste.\n\nDonnées de démonstration : aucune disponibilité, livraison ou allégation produit n’est confirmée." }, "saved", 4);

    // The caller writes these exact UTF-8 bytes under its isolated local bucket.
    // Storage keys are constants; no user filename is converted into a path here.
    for (const file of DEMO_FILES) {
      resource(file.id, "file", file.name, { key: file.storageKey, mime: file.mime, size: file.size, text: file.content, sha256: file.sha256 }, "ready", 5);
      run("INSERT OR IGNORE INTO files(id,workspace_id,owner_id,legacy_resource_id,display_name,storage_name,size_bytes,detected_mime,sha256,status,storage_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'ready',?,?,?)",
        file.id, workspace, workspace, file.id, file.name, file.name, file.size, file.mime, file.sha256, file.storageKey, time(5), time(5));
      run("INSERT OR IGNORE INTO billing_meter(id,organization_id,kind,quantity,created_at) VALUES (?,?,'storage',?,?)", "demo-storage-" + file.id, workspace, file.size, time(5));
    }

    sql.exec("COMMIT");
  } catch (error) {
    sql.exec("ROLLBACK");
    throw error;
  }
  const counts = Object.fromEntries(sql.prepare("SELECT kind,COUNT(*) count FROM resources WHERE workspace_id=? GROUP BY kind ORDER BY kind").all(workspace).map(row => [row.kind, Number(row.count)]));
  const wallet = sql.prepare("SELECT SUM(balance-reserved) available,SUM(granted) granted FROM credit_lots WHERE organization_id=?").get(workspace);
  return { ...metadata, workspaceId: workspace, createdAt: anchor, counts, credits: { available: Number(wallet.available) / 100, granted: Number(wallet.granted) / 100 }, assets: DEMO_ASSETS.map(name => `/demo-assets/${name}.svg`), files: DEMO_FILES.map(({ id, name, mime, storageKey, size }) => ({ id, name, mime, storageKey, size })), conversations: discussionsIds() };
}

function discussionsIds() {
  return ["demo-chat-launch", "demo-chat-social", "demo-chat-page", "demo-chat-emails", "demo-chat-strategy"];
}
