import {notFound} from 'next/navigation';
import Link from 'next/link';
import {BrandLogo} from './brand';
import {CONTENT_UPDATED,LEGAL_CONTENT,publicPage} from '@/lib/legal-content';
import {jsonLd,organization,legalPageMetadata as pageMetadata} from '@/lib/legal-metadata';
import {SITE_ORIGIN} from '@/lib/legal-policy.mjs';
import styles from './legal-page.module.css';

export function legalPageMetadata(path:string){const page=publicPage(path);if(!page)notFound();return pageMetadata(page.path,page.title,page.description);}
function Brand(){return <Link prefetch={false} className={styles.brand} href="/" aria-label="Retour à Braand"><BrandLogo height={32}/></Link>;}
export default function LegalPage({path}:{path:string}){
  const page=publicPage(path);if(!page)notFound();
  const url=SITE_ORIGIN+page.path;
  const graph={'@context':'https://schema.org','@graph':[organization,{'@type':'WebPage','@id':url+'#page',url,name:page.heading,headline:page.heading,description:page.description,inLanguage:'fr',dateModified:CONTENT_UPDATED,publisher:{'@id':organization['@id']}}]};
  return <div className={styles.site}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(graph)}}/>
    <a className={styles.skip} href="#contenu">Aller au contenu</a>
    <header className={styles.legalHeader}><Brand/></header>
    <main id="contenu" className={styles.legalMain} tabIndex={-1}>
      <div className={styles.intro}><h1>{page.heading}</h1><p>{page.answer}</p><p className={styles.byline}>Dernière mise à jour : <time dateTime={CONTENT_UPDATED}>24 octobre 2026</time></p><p className={styles.legalNotice}>Document provisoire. Les informations de l’exploitant et les modalités juridiques restent à compléter.</p></div>
      <article className={styles.article} aria-label={page.label}>
        {page.sections.map(section=><section key={section.id} id={section.id}><h2>{section.title}</h2>{section.paragraphs.map(paragraph=><p key={paragraph}>{paragraph}</p>)}{section.items&&<ul>{section.items.map(item=><li key={item}>{item}</li>)}</ul>}</section>)}
        <section className={styles.related}><h2>Documents associés</h2><ul>{page.related.map(path=>{const related=publicPage(path);return related?<li key={path}><Link prefetch={false} href={path}>{related.title}</Link></li>:null;})}</ul></section>
        <section className={styles.next}><h2>Contact</h2><p>Pour toute question relative à ce document : <a href="mailto:novacore629@gmail.com">novacore629@gmail.com</a>.</p><Link prefetch={false} href="/?settings=legal">Retourner aux informations légales dans les paramètres</Link></section>
      </article>
    </main>
    <footer className={styles.footer}><nav aria-label="Documents juridiques">{LEGAL_CONTENT.map(item=><Link prefetch={false} href={item.path} key={item.path} aria-current={page.path===item.path?'page':undefined}>{item.label}</Link>)}</nav></footer>
  </div>;
}
