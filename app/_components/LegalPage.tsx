/* eslint-disable @next/next/no-html-link-for-pages */
import { ProductHeader } from './ProductHeader';

type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
};

export function LegalPage({ eyebrow, title, summary, updated, sections }: LegalPageProps) {
  return (
    <main className="legal-page">
      <ProductHeader context="Assessment platform" />
      <article className="legal-shell">
        <header className="legal-hero">
          <div>
            <p className="page-label">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{summary}</p>
          </div>
          <aside>
            <span>Last updated</span>
            <strong>{updated}</strong>
            <a href="mailto:caciitg@gmail.com">caciitg@gmail.com</a>
          </aside>
        </header>

        <div className="legal-layout">
          <nav aria-label={`${title} sections`}>
            <strong>On this page</strong>
            {sections.map((section, index) => (
              <a href={`#section-${index + 1}`} key={section.title}>{section.title}</a>
            ))}
          </nav>
          <div className="legal-copy">
            {sections.map((section, index) => (
              <section id={`section-${index + 1}`} key={section.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h2>{section.title}</h2>
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
              </section>
            ))}
          </div>
        </div>
      </article>
      <footer className="legal-footer">
        <p>Consulting &amp; Analytics Club · IIT Guwahati</p>
        <nav aria-label="Legal navigation"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/">C&amp;Assess home</a></nav>
      </footer>
    </main>
  );
}

