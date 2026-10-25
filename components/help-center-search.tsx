"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { HELP_ARTICLES, HELP_CATEGORIES, searchHelpArticles, type HelpCategoryId } from "@/lib/help-content";
import styles from "./help-center.module.css";

export function HelpCenterSearch() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategoryId | "all">("all");
  const results = useMemo(() => searchHelpArticles(query, category), [query, category]);
  const visibleCategories = useMemo(() => {
    const matching = new Set(searchHelpArticles(query).map((article) => article.category));
    return HELP_CATEGORIES.filter((item) => matching.has(item.id));
  }, [query]);

  return (
    <section aria-label="Rechercher dans le centre d’aide">
      <label className={styles.search}>
        <Search size={19} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une réponse"
          aria-label="Rechercher un article d’aide"
        />
        {query ? <button type="button" className={styles.clearSearch} onClick={() => setQuery("")} aria-label="Effacer la recherche"><X size={17} /></button> : null}
      </label>
      <div className={styles.filters} role="group" aria-label="Filtrer les articles par thème">
        <button type="button" className={styles.filter} aria-pressed={category === "all"} onClick={() => setCategory("all")}>Tous</button>
        {visibleCategories.map((item) => (
          <button key={item.id} type="button" className={styles.filter} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>
        ))}
      </div>
      <p className={styles.resultsCount} aria-live="polite">{results.length} {results.length === 1 ? "thème" : "thèmes"}</p>
      {results.length ? (
        <div className={styles.grid}>
          {results.map((article) => {
            const categoryLabel = HELP_CATEGORIES.find((item) => item.id === article.category)?.label ?? "Aide";
            return (
              <Link key={article.slug} className={styles.card} href={`/aide/${article.slug}`}>
                <span className={styles.cardCategory}>{categoryLabel}</span>
                <strong>{article.title}</strong>
                <span>{article.excerpt}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty} role="status">Aucun article ne correspond à cette recherche. Essayez un autre mot ou effacez le filtre.</div>
      )}
      <span className="sr-only">{HELP_ARTICLES.length} articles disponibles dans le centre d’aide.</span>
    </section>
  );
}
