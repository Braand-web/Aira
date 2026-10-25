"use client";

import { useEffect, useState } from "react";
import { FILE_POLICY } from "@/lib/file-policy.mjs";
import type { OfficePreviewResult, OfficePreviewState } from "./office-reader-types";

const messages: Record<string, string> = {
  FILE_PASSWORD: "Ce document Office est protégé par mot de passe. Téléchargez-le pour l’ouvrir avec votre mot de passe.",
  FILE_CORRUPT: "Le document Office est incomplet ou endommagé. Vous pouvez le télécharger pour essayer de le réparer.",
  FILE_TOO_LARGE: "Le contenu décompressé dépasse la limite sûre de l’aperçu.",
  FILE_REJECTED_SECURITY: "L’archive contient une structure ou un contenu non autorisé pour l’aperçu.",
  FILE_UNSUPPORTED: "Cette compression ou structure Office n’est pas prise en charge par ce navigateur.",
  EXTRACTION_TIMEOUT: "L’aperçu a pris trop de temps. Téléchargez le document pour l’ouvrir autrement.",
};

export function useOfficePreview(mime: string, contentUrl: string, onError: (message: string) => void): OfficePreviewState {
  const [savedState, setSavedState] = useState<{ url: string; state: OfficePreviewState } | null>(null);
  const state = savedState?.url === contentUrl ? savedState.state : { status: "loading" as const };
  useEffect(() => {
    if (!contentUrl) return;
    let active = true;
    let worker: Worker | null = null;
    let timer = 0;
    let requestId = "";
    const stop = () => {
      if (timer) window.clearTimeout(timer);
      worker?.terminate();
      worker = null;
    };
    void fetch(contentUrl, { credentials: "same-origin", cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("FILE_CORRUPT");
      const bytes = await response.arrayBuffer();
      if (!active) return;
      if (bytes.byteLength === 0 || bytes.byteLength > FILE_POLICY.maxFileBytes) throw new Error("FILE_TOO_LARGE");
      requestId = crypto.randomUUID();
      worker = new Worker(new URL("./office-preview.worker.ts", import.meta.url), { type: "module", name: "braand-office-preview" });
      worker.onmessage = event => {
        if (!active || event.data?.id !== requestId) return;
        stop();
        if (event.data.ok) setSavedState({ url: contentUrl, state: { status: "ready", result: event.data.result as OfficePreviewResult } });
        else {
          const message = messages[String(event.data.code)] || messages.FILE_CORRUPT;
          setSavedState({ url: contentUrl, state: { status: "error", code: String(event.data.code || "FILE_CORRUPT"), message } });
          onError(message);
        }
      };
      worker.onerror = () => {
        if (!active) return;
        stop();
        const message = messages.FILE_CORRUPT;
        setSavedState({ url: contentUrl, state: { status: "error", code: "FILE_CORRUPT", message } });
        onError(message);
      };
      timer = window.setTimeout(() => {
        if (!active) return;
        stop();
        const message = messages.EXTRACTION_TIMEOUT;
        setSavedState({ url: contentUrl, state: { status: "error", code: "EXTRACTION_TIMEOUT", message } });
        onError(message);
      }, FILE_POLICY.officeMaxProcessingMs);
      worker.postMessage({ id: requestId, mime, bytes }, [bytes]);
    }).catch(error => {
      if (!active) return;
      const code = error instanceof Error ? error.message : "FILE_CORRUPT";
      const message = messages[code] || messages.FILE_CORRUPT;
      setSavedState({ url: contentUrl, state: { status: "error", code, message } });
      onError(message);
    });
    return () => { active = false; stop(); };
  }, [contentUrl, mime, onError]);
  return state;
}
