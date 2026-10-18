"use client";

import type { OfficePreviewState } from "./office-reader-types";
import { FILE_POLICY } from "@/lib/file-policy.mjs";
import { OfficeReaderState } from "./office-reader-state";
import { useOfficePreview } from "./use-office-preview";

type Props = { mime: string; contentUrl: string; onError: (message: string) => void };

function PptxContent({ state }: { state: OfficePreviewState }) {
  if (state.status !== "ready" || state.result.kind !== "pptx") return null;
  if (state.result.slides.length === 0) return <p className="office-reader-note office-reader-empty">Aucun texte lisible n’a été trouvé dans cette présentation.</p>;
  return <div className="office-slides-content">
    {state.result.slides.map(slide => <article className="office-slide-card" key={slide.number} aria-label={`Diapositive ${slide.number}`}>
      <div className="office-slide-heading"><span>Diapositive {slide.number}</span><h2>{slide.title}</h2></div>
      <div className="office-slide-text">{slide.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{slide.hasImages && <p className="office-reader-note">Cette diapositive contient des images qui ne sont pas affichées dans cet aperçu.</p>}</div>
    </article>)}
    {state.result.truncatedSlides && <p className="office-reader-note">Seules les {FILE_POLICY.officeMaxSlides} premières diapositives sont affichées.</p>}
    {state.result.truncatedByText && <p className="office-reader-note">La limite de texte de l’aperçu est atteinte ; certains contenus ne sont pas affichés.</p>}
  </div>;
}

export function PptxReader({ mime, contentUrl, onError }: Props) {
  const state = useOfficePreview(mime, contentUrl, onError);
  return <div className="office-reader office-reader-pptx"><div className="office-reader-banner">Aperçu simplifié : le texte des diapositives est affiché. Les images et les notes du présentateur ne sont pas incluses.</div><OfficeReaderState state={state}/><PptxContent state={state}/></div>;
}
