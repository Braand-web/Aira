"use client";

import { AudioLines, FileArchive, FileImage, FileText, Film, Headphones, Paperclip, X } from "lucide-react";
import { useFilePreview } from "./file-preview-provider";
import { extensionFor, formatFileSize, previewKind, statusLabel, type PreviewFile } from "./types";

export function FileCard({ file, contextFileIds = [file.id], variant = "grid", onRemove, disabled = false }: {
  file: PreviewFile;
  contextFileIds?: string[];
  variant?: "grid" | "compact";
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const { openPreview } = useFilePreview();
  const kind = previewKind(file.mime);
  const TypeIcon = kind === "image" ? FileImage : kind === "pdf" || kind === "text" ? FileText : kind === "audio" ? Headphones : kind === "video" ? Film : FileArchive;
  const ready = file.status === "ready" && !disabled;
  return <article className={`file-card file-card-${variant}`}>
    <button type="button" className="file-card-open" onClick={() => openPreview(file.id, { contextFileIds })} disabled={!ready} aria-label={`${ready ? "Ouvrir l’aperçu de" : "Fichier indisponible :"} ${file.name}`}>
      <span className={`file-card-icon file-card-icon-${kind}`}><TypeIcon size={variant === "grid" ? 25 : 19} aria-hidden="true"/><span>{extensionFor(file.name)}</span></span>
      <span className="file-card-copy"><strong title={file.name}>{file.name}</strong><small>{formatFileSize(file.size)} · {statusLabel(file.status)}</small></span>
    </button>
    {onRemove && <button type="button" className="file-card-remove" onClick={onRemove} aria-label={`Retirer ${file.name}`}><X size={15}/></button>}
    {variant === "grid" && <span className="file-card-kind"><Paperclip size={12}/>{kind === "unsupported" ? "Téléchargement" : kind === "pdf" ? "PDF" : kind === "text" ? "Document texte" : kind === "docx" ? "Document Word" : kind === "xlsx" ? "Classeur Excel" : kind === "pptx" ? "Présentation PowerPoint" : kind === "image" ? "Image" : kind === "audio" ? "Audio" : "Vidéo"}</span>}
    {kind === "audio" && variant === "compact" && <AudioLines size={14} aria-hidden="true"/>}
  </article>;
}
