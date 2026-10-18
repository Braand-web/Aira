"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import type { OfficePreviewState } from "./office-reader-types";

export function OfficeReaderState({ state }: { state: OfficePreviewState }) {
  if (state.status === "loading") return <div className="office-reader-state" role="status"><LoaderCircle className="spin" size={22}/><span>Préparation de l’aperçu Office…</span></div>;
  if (state.status === "error") return <div className="office-reader-state office-reader-error" role="alert"><AlertCircle size={22}/><span>{state.message}</span></div>;
  return null;
}
