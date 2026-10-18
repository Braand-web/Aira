"use client";

import type { OfficeBlock, OfficePreviewState } from "./office-reader-types";
import { OfficeReaderState } from "./office-reader-state";
import { useOfficePreview } from "./use-office-preview";

type Props = { mime: string; contentUrl: string; onError: (message: string) => void };

function DocxContent({ state }: { state: OfficePreviewState }) {
  if (state.status !== "ready" || state.result.kind !== "docx") return null;
  return <div className="office-document-content">
    {state.result.blocks.map((block: OfficeBlock, index) => {
      if (block.type === "table") return <div className="office-docx-table-wrap" key={index}><table className="office-docx-table"><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
      if (block.type === "heading") {
        const Tag = (`h${Math.min(Math.max(block.level, 1), 6)}`) as "h1";
        return <Tag className="office-docx-heading" key={index}>{block.text}</Tag>;
      }
      return <p className={block.type === "list" ? "office-docx-list-item" : ""} key={index}>{block.type === "list" && <span aria-hidden="true">• </span>}{block.text}</p>;
    })}
    {state.result.truncated && <p className="office-reader-note">L’aperçu est limité aux premiers blocs du document.</p>}
    {state.result.blocks.length === 0 && <p className="office-reader-note">Aucun texte lisible n’a été trouvé dans ce document.</p>}
  </div>;
}

export function DocxReader({ mime, contentUrl, onError }: Props) {
  const state = useOfficePreview(mime, contentUrl, onError);
  return <div className="office-reader office-reader-docx"><div className="office-reader-banner">Aperçu simplifié : la mise en forme peut différer de Microsoft Office. Les images intégrées ne sont pas affichées.</div><OfficeReaderState state={state}/><DocxContent state={state}/></div>;
}
