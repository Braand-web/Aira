"use client";

import { useMemo, useState } from "react";
import { FILE_POLICY } from "@/lib/file-policy.mjs";
import type { OfficePreviewState, OfficeXlsxSheet } from "./office-reader-types";
import { OfficeReaderState } from "./office-reader-state";
import { useOfficePreview } from "./use-office-preview";

type Props = { mime: string; contentUrl: string; onError: (message: string) => void };

function columnName(index: number) {
  let result = "";
  let current = index + 1;
  while (current > 0) { current--; result = String.fromCharCode(65 + current % 26) + result; current = Math.floor(current / 26); }
  return result;
}

function SheetTable({ sheet }: { sheet: OfficeXlsxSheet }) {
  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = FILE_POLICY.officePreviewRowHeightPx;
  const windowRows = FILE_POLICY.officePreviewWindowRows;
  const firstIndex = Math.min(Math.max(0, Math.floor(scrollTop / rowHeight)), Math.max(0, sheet.rows.length - windowRows));
  const visibleRows = sheet.rows.slice(firstIndex, firstIndex + windowRows);
  const columnCount = useMemo(() => Math.max(0, ...sheet.rows.slice(firstIndex, firstIndex + windowRows).map(row => row.cells.length)), [firstIndex, sheet.rows, windowRows]);
  return <div className="office-sheet-scroll" onScroll={event => setScrollTop(event.currentTarget.scrollTop)} role="region" aria-label={`Données de la feuille ${sheet.name}`} tabIndex={0}>
    <table className="office-sheet-table" style={{ "--office-row-height": `${rowHeight}px` } as React.CSSProperties}><thead><tr><th scope="col" aria-label="Numéro de ligne">#</th>{Array.from({ length: columnCount }, (_, column) => <th scope="col" key={column}>{columnName(column)}</th>)}</tr></thead>
      <tbody>
        {firstIndex > 0 && <tr className="office-sheet-spacer" aria-hidden="true"><td colSpan={columnCount + 1} style={{ height: firstIndex * rowHeight }}/></tr>}
        {visibleRows.map(row => <tr key={row.number}><th scope="row">{row.number}</th>{Array.from({ length: columnCount }, (_, column) => <td key={column} title={row.cells[column] || ""}>{row.cells[column] || ""}</td>)}</tr>)}
        {firstIndex + visibleRows.length < sheet.rows.length && <tr className="office-sheet-spacer" aria-hidden="true"><td colSpan={columnCount + 1} style={{ height: (sheet.rows.length - firstIndex - visibleRows.length) * rowHeight }}/></tr>}
      </tbody>
    </table>
  </div>;
}

function XlsxContent({ state }: { state: OfficePreviewState }) {
  const [activeSheet, setActiveSheet] = useState(0);
  if (state.status !== "ready" || state.result.kind !== "xlsx") return null;
  const sheet = state.result.sheets[activeSheet];
  return <div className="office-workbook-content">
    <div className="office-sheet-tabs" role="tablist" aria-label="Feuilles du classeur">{state.result.sheets.map((item, index) => <button type="button" role="tab" aria-selected={activeSheet === index} id={`office-sheet-tab-${index}`} aria-controls="office-sheet-panel" className={activeSheet === index ? "is-active" : ""} onClick={() => setActiveSheet(index)} key={`${item.name}-${index}`}>{item.name}{item.hidden && <span className="office-hidden-sheet">Masquée</span>}</button>)}</div>
    {sheet && <section id="office-sheet-panel" role="tabpanel" aria-labelledby={`office-sheet-tab-${activeSheet}`} className="office-sheet-panel">
      {sheet.hidden && <p className="office-reader-note">Cette feuille est masquée dans le classeur d’origine.</p>}
      <SheetTable key={sheet.name} sheet={sheet}/>
      {(sheet.truncated || state.result.truncated) && <p className="office-reader-note">L’aperçu affiche au maximum {FILE_POLICY.officeMaxPreviewRowsPerSheet.toLocaleString("fr-FR")} lignes et {FILE_POLICY.officeMaxPreviewColumnsPerSheet} colonnes par feuille ; {state.result.truncated ? `seules les ${FILE_POLICY.officeMaxSheets} premières feuilles sont affichées.` : "les lignes restantes sont omises."}</p>}
    </section>}
    <p className="office-reader-note">Les valeurs enregistrées dans le fichier sont affichées. Aucune formule n’est exécutée.</p>
  </div>;
}

export function XlsxReader({ mime, contentUrl, onError }: Props) {
  const state = useOfficePreview(mime, contentUrl, onError);
  return <div className="office-reader office-reader-xlsx"><div className="office-reader-banner">Aperçu simplifié : seules les valeurs enregistrées sont affichées ; les formules ne sont jamais exécutées.</div><OfficeReaderState state={state}/><XlsxContent state={state}/></div>;
}
