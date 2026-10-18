"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function PdfReader({ loadData, page, zoom, onPageCount, onPassword, onError }: {
  loadData: () => Promise<Uint8Array>;
  page: number;
  zoom: number;
  onPageCount: (count: number) => void;
  onPassword: () => void;
  onError: (message: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const taskRef = useRef<pdfjs.PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await loadData();
        const task = pdfjs.getDocument({ data, enableXfa: false, stopAtErrors: true });
        taskRef.current = task;
        task.onPassword = () => { onPassword(); };
        const pdf = await task.promise;
        if (cancelled) { await task.destroy(); return; }
        pdfRef.current = pdf;
        onPageCount(pdf.numPages);
        setReady(true);
      } catch (error) {
        if (!cancelled) onError(error instanceof Error ? error.message : "Ce document PDF ne peut pas être ouvert.");
      }
    })();
    return () => {
      cancelled = true;
      void taskRef.current?.destroy();
      pdfRef.current = null;
      taskRef.current = null;
    };
  }, [loadData, onError, onPageCount, onPassword]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      const textHost = textRef.current;
      if (!ready || !pdf || !canvas || !textHost || page < 1 || page > pdf.numPages) return;
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const viewport = pdfPage.getViewport({ scale: zoom });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.ceil(viewport.width * dpr);
        canvas.height = Math.ceil(viewport.height * dpr);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;
        textHost.replaceChildren();
        textHost.style.width = `${Math.ceil(viewport.width)}px`;
        textHost.style.height = `${Math.ceil(viewport.height)}px`;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Le navigateur ne peut pas afficher cette page PDF.");
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        const renderTask = pdfPage.render({ canvas, canvasContext: context, viewport, background: "#ffffff" });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        if (cancelled) return;
        const textContent = await pdfPage.getTextContent();
        const layer = new pdfjs.TextLayer({ textContentSource: textContent, container: textHost, viewport });
        await layer.render();
      } catch (error) {
        if (!cancelled) onError(error instanceof Error ? error.message : "Impossible d’afficher cette page.");
      }
    })();
    return () => { cancelled = true; renderTaskRef.current?.cancel(); renderTaskRef.current = null; };
  }, [onError, page, ready, zoom]);

  return <div className="pdf-page-frame" aria-label={`Page ${page}`}><canvas ref={canvasRef}/><div className="pdf-text-layer" ref={textRef}/></div>;
}
