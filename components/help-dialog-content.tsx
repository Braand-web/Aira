"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Plug, Search, X, CreditCard, ArrowUpRight } from "lucide-react";
import { HELP_CATEGORIES, HELP_FAQS, helpCategoryLabel, type HelpCategoryId, type HelpDestination } from "@/lib/help-content";
import styles from "./help-dialog.module.css";

export function HelpDialogContent({ onNavigate }: { onNavigate: (destination: HelpDestination) => void }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategoryId | "all">("all");
  const [apple, setApple] = useState(false);
  const faqs = useMemo(() => {
    const terms = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim().split(/\s+/).filter(Boolean);
    return HELP_FAQS.filter((faq) => {
      if (category !== "all" && faq.category !== category) return false;
      const searchable = [faq.question, faq.answer, ...(faq.keywords ?? [])].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
      return terms.every((term) => searchable.includes(term));
    });
  }, [query, category]);
  const visibleCategories = useMemo(() => {
    const matching = new Set(faqs.map((faq) => faq.category));
    return HELP_CATEGORIES.filter((item) => matching.has(item.id));
  }, [faqs]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
      setApple(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent));
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  const shortcutPrefix = apple ? "⌘" : "Ctrl";
  const accessItems = [
    { destination: "files" as const, label: "Mes fichiers", icon: FileText },
    { destination: "connectors" as const, label: "Mes connecteurs", icon: Plug },
    { destination: "billing" as const, label: "Facturation", icon: CreditCard },
  ];

  return (
    <div className={styles.content}>
      <p className={styles.lede}>Trouvez une réponse rapidement ou ouvrez le guide détaillé correspondant.</p>
      <section className={styles.section} aria-labelledby="help-faq-title">
        <h3 id="help-faq-title">FAQ</h3>
        <label className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une réponse" aria-label="Rechercher dans la FAQ" />
          {query ? <button className={styles.clear} type="button" aria-label="Effacer la recherche" onClick={() => setQuery("")}><X size={16} /></button> : null}
        </label>
        <div className={styles.categories} role="group" aria-label="Filtrer par catégorie">
          <button type="button" className={styles.category} aria-pressed={category === "all"} onClick={() => setCategory("all")}>Tous</button>
          {visibleCategories.map((item) => <button key={item.id} type="button" className={styles.category} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}
        </div>
        {faqs.length ? (
          <div className={styles.faqList} aria-live="polite">
            {visibleCategories.map((item) => {
              const categoryFaqs = faqs.filter((faq) => faq.category === item.id);
              if (!categoryFaqs.length) return null;
              return <div key={item.id}><h4 className={styles.faqCategory}>{helpCategoryLabel(item.id)}</h4>{categoryFaqs.map((faq) => <details className={styles.faq} key={faq.id}><summary>{faq.question}</summary><div className={styles.answer}><p>{faq.answer}</p><Link href={`/aide/${faq.articleSlug}`} target="_blank" rel="noopener noreferrer">Lire l’article complet : {faq.articleTitle} <ArrowUpRight size={13} aria-hidden="true" /></Link></div></details>)}</div>;
            })}
          </div>
        ) : <p className={styles.empty} role="status">Aucune réponse ne correspond. Essayez un autre mot ou effacez la recherche.</p>}
      </section>
      <section className={styles.section} aria-labelledby="help-shortcuts-title">
        <h3 id="help-shortcuts-title">Raccourcis clavier</h3>
        <div className={styles.shortcuts}>
          <div className={styles.shortcut}><span>Rechercher</span><kbd>{shortcutPrefix} K</kbd></div>
          <div className={styles.shortcut}><span>Ouvrir l’aide</span><kbd>{shortcutPrefix} /</kbd></div>
          <div className={styles.shortcut}><span>Envoyer une demande</span><kbd>Entrée</kbd></div>
          <div className={styles.shortcut}><span>Ajouter une ligne</span><kbd>Maj + Entrée</kbd></div>
          <div className={styles.shortcut}><span>Fermer une fenêtre ou un menu</span><kbd>Échap</kbd></div>
        </div>
      </section>
      <section className={styles.section} aria-labelledby="help-access-title">
        <h3 id="help-access-title">Accès utiles</h3>
        <div className={styles.access}>
          {accessItems.map(({ destination, label, icon: Icon }) => <button type="button" key={destination} onClick={() => onNavigate(destination)}><Icon size={17} aria-hidden="true" /><span>{label}</span><ChevronRight size={16} aria-hidden="true" /></button>)}
        </div>
      </section>
      <Link className={styles.centerLink} href="/aide" target="_blank" rel="noopener noreferrer">Voir le centre d’aide <ArrowUpRight size={15} aria-hidden="true" /></Link>
    </div>
  );
}
