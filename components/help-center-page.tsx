import Link from "next/link";
import { HELP_ARTICLES, HELP_CATEGORIES, type HelpArticle } from "@/lib/help-content";
import styles from "./help-center.module.css";

function Brand() {
  return <Link prefetch={false} className={styles.brand} href="/" aria-label="Braand, accueil"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4v32M4 20h32M8.7 8.7l22.6 22.6M8.7 31.3 31.3 8.7" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg><span>Braand</span></Link>;
}

export function HelpSiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.site}>
      <a className={styles.skip} href="#help-main">Aller au contenu</a>
      <header className={styles.header}>
        <Brand />
        <nav className={styles.headerActions} aria-label="Navigation du centre d’aide">
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/?view=chat">Ouvrir Braand</Link>
        </nav>
      </header>
      {children}
      <footer className={styles.footer}>
        <span>Centre d’aide Braand</span>
        <nav aria-label="Informations légales">
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/conditions-utilisation">Conditions d’utilisation</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
        </nav>
      </footer>
    </div>
  );
}

export function HelpHubPage({ children }: { children: React.ReactNode }) {
  return (
    <HelpSiteShell>
      <main id="help-main" className={styles.main} tabIndex={-1}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>Centre d’aide</span>
          <h1>Comment pouvons-nous vous aider ?</h1>
          <p>Des réponses pratiques pour utiliser Braand, organiser votre espace et avancer dans vos projets.</p>
        </div>
        {children}
      </main>
    </HelpSiteShell>
  );
}

export function HelpArticlePage({ article }: { article: HelpArticle }) {
  const category = HELP_CATEGORIES.find((item) => item.id === article.category)?.label ?? "Aide";
  const related = article.related.map((slug) => HELP_ARTICLES.find((item) => item.slug === slug)).filter((item): item is HelpArticle => Boolean(item));

  return (
    <HelpSiteShell>
      <main id="help-main" className={`${styles.main} ${styles.article}`} tabIndex={-1}>
        <nav className={styles.breadcrumb} aria-label="Fil d’Ariane">
          <Link href="/aide">Centre d’aide</Link><span aria-hidden="true">/</span><span aria-current="page">{article.title}</span>
        </nav>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>{category}</span>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>
          <p className={styles.updated}>Mis à jour le <time dateTime="2026-10-25">25 octobre 2026</time></p>
        </div>
        <article>
          {article.questions.map((question) => (
            <section key={question.id} id={question.id}>
              <h2>{question.question}</h2>
              <p>{question.answer}</p>
            </section>
          ))}
          {article.sections.map((section) => (
            <section key={section.id} id={section.id}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.steps ? <ol>{section.steps.map((item) => <li key={item}>{item}</li>)}</ol> : null}
              {section.items ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            </section>
          ))}
        </article>
        {article.action ? <aside className={styles.action}><p>Prêt à continuer dans votre espace ?</p><Link href={article.action.href}>{article.action.label}</Link></aside> : null}
        <section className={styles.related} aria-labelledby="help-related-title">
          <h2 id="help-related-title">À lire aussi</h2>
          <ul>{related.map((item) => <li key={item.slug}><Link href={`/aide/${item.slug}`}>{item.title}</Link></li>)}</ul>
          <p><Link href="/aide">Retourner au centre d’aide</Link></p>
        </section>
      </main>
    </HelpSiteShell>
  );
}
